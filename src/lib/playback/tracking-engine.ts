import type { TrackingEventType } from "@/src/types/tracking";
import type { VideoSourceType } from "@/src/types/video";

export interface PlaybackSnapshot {
  position: number;
  duration: number | null;
}

export interface TrackingSink {
  ensureSession: () => Promise<boolean>;
  sendEvent: (
    eventType: TrackingEventType,
    snapshot: PlaybackSnapshot,
    fromPosition?: number | null,
    metadata?: Record<string, string | number | boolean | null>,
    telemetryFields?: { playback_rate?: number | null; from_rate?: number | null; to_rate?: number | null },
  ) => void;
  endSession: (snapshot: PlaybackSnapshot | null, completed: boolean, watchTimeSeconds: number) => Promise<void>;
}

export type NormalizedPlaybackEvent =
  | { type: "ready"; snapshot: PlaybackSnapshot }
  | { type: "metadata_loaded"; snapshot: PlaybackSnapshot }
  | { type: "play"; snapshot: PlaybackSnapshot; provider_state?: string }
  | { type: "pause"; snapshot: PlaybackSnapshot }
  | { type: "seek_started"; snapshot: PlaybackSnapshot; fromPosition?: number | null }
  | { type: "seek_completed"; snapshot: PlaybackSnapshot; fromPosition?: number | null; resumeAfterSeek?: boolean }
  | { type: "progress"; snapshot: PlaybackSnapshot; provider_state?: string }
  | { type: "buffering_started"; snapshot: PlaybackSnapshot; provider_state?: string }
  | { type: "buffering_ended"; snapshot: PlaybackSnapshot }
  | { type: "rate_changed"; snapshot: PlaybackSnapshot; fromRate?: number | null; toRate: number }
  | { type: "volume_changed"; snapshot: PlaybackSnapshot; fromVolume?: number | null; toVolume: number }
  | { type: "mute_changed"; snapshot: PlaybackSnapshot; fromMuted?: boolean | null; toMuted: boolean }
  | { type: "fullscreen_changed"; snapshot: PlaybackSnapshot; fullscreen: boolean }
  | { type: "visibility_changed"; snapshot: PlaybackSnapshot; visibility: "visible" | "hidden" }
  | { type: "quality_changed"; snapshot: PlaybackSnapshot; fromQuality?: string | null; toQuality: string }
  | { type: "error"; snapshot: PlaybackSnapshot; providerCode: number; provider: VideoSourceType }
  | { type: "ended"; snapshot: PlaybackSnapshot };

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeSnapshot(snapshot: PlaybackSnapshot): PlaybackSnapshot {
  const duration = finite(snapshot.duration);
  const position = Math.max(0, finite(snapshot.position) ?? 0);
  return { position: duration && duration > 0 ? Math.min(duration, position) : position, duration: duration && duration > 0 ? duration : null };
}

/**
 * Provider-neutral state machine. Provider adapters only translate their native
 * callbacks into NormalizedPlaybackEvent; this class owns TrackUp semantics.
 * Sessions are deliberately opened on the first actual play/resume transition.
 */
export class UniversalTrackingEngine {
  private playing = false;
  private sessionStarted = false;
  private completionSent = false;
  private pendingSeekFrom: number | null = null;
  private pendingBuffer = false;
  private resumeAfterBuffer = false;
  private lastPosition: number | null = null;
  private lastDuration: number | null = null;
  private lastProgressAt = 0;
  private activeSince: number | null = null;
  private watchTimeSeconds = 0;
  private hasPlayed = false;
  private observedProgress = false;
  private suppressNextDiscontinuity = false;
  private readonly progressIntervalMs: number;

  constructor(private readonly sink: TrackingSink, progressIntervalMs = 5000) {
    this.progressIntervalMs = Math.max(0, progressIntervalMs);
  }

  get hasSession(): boolean {
    return this.sessionStarted;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  private remember(snapshot: PlaybackSnapshot): PlaybackSnapshot {
    const normalized = normalizeSnapshot(snapshot);
    this.lastPosition = normalized.position;
    this.lastDuration = normalized.duration;
    return normalized;
  }

  private maybeComplete(snapshot: PlaybackSnapshot): void {
    if (this.completionSent || !snapshot.duration || snapshot.duration <= 0) return;
    if (snapshot.position / snapshot.duration >= 0.95) {
      this.completionSent = true;
      this.sink.sendEvent("complete", snapshot);
    }
  }

  private async ensureActualSession(): Promise<boolean> {
    if (this.sessionStarted) return true;
    const started = await this.sink.ensureSession();
    if (started) {
      this.sessionStarted = true;
      this.lastProgressAt = Date.now();
    }
    return started;
  }

  private stopActiveClock(): void {
    if (this.activeSince === null) return;
    this.watchTimeSeconds += Math.max(0, (Date.now() - this.activeSince) / 1000);
    this.activeSince = null;
  }

  private startActiveClock(): void {
    if (this.activeSince === null) this.activeSince = Date.now();
  }

  async handle(event: NormalizedPlaybackEvent): Promise<boolean> {
    const previousPosition = this.lastPosition;
    const snapshot = this.remember(event.snapshot);
    switch (event.type) {
      case "ready":
      case "metadata_loaded":
        // Player readiness alone is not a view and cannot open a session.
        return this.sessionStarted;
      case "play": {
        const started = await this.ensureActualSession();
        if (!started) return false;
        if (this.pendingBuffer) {
          this.pendingBuffer = false;
          this.sink.sendEvent("buffering_ended", snapshot, null, { state: "end" });
        }
        if (this.playing) return true;
        this.playing = true;
        this.startActiveClock();
        const eventType: TrackingEventType = this.hasPlayed ? "resume" : "play";
        this.hasPlayed = true;
        this.sink.sendEvent(eventType, snapshot, null, event.provider_state ? { provider_state: event.provider_state } : undefined);
        this.maybeComplete(snapshot);
        return true;
      }
      case "pause":
        if (!this.sessionStarted) return false;
        this.stopActiveClock();
        this.playing = false;
        this.sink.sendEvent("pause", snapshot);
        return true;
      case "seek_started":
        if (!this.sessionStarted) return false;
        this.pendingSeekFrom = finite(event.fromPosition) ?? snapshot.position;
        this.playing = false;
        this.stopActiveClock();
        this.sink.sendEvent("seek_started", snapshot, this.pendingSeekFrom, { seek_from_seconds: this.pendingSeekFrom });
        return true;
      case "seek_completed":
        if (!this.sessionStarted) return false;
        const seekFrom = finite(event.fromPosition) ?? this.pendingSeekFrom;
        this.pendingSeekFrom = null;
        this.suppressNextDiscontinuity = true;
        this.playing = event.resumeAfterSeek === true;
        if (this.playing) this.startActiveClock();
        this.sink.sendEvent("seek_completed", snapshot, seekFrom, { seek_from_seconds: seekFrom, seek_to_seconds: snapshot.position, seek_delta_seconds: seekFrom === null ? null : snapshot.position - seekFrom });
        return true;
      case "progress":
        if (!this.sessionStarted || !this.playing) return false;
        if (this.observedProgress && !this.suppressNextDiscontinuity && previousPosition !== null && Math.abs(snapshot.position - previousPosition) >= 8) {
          this.sink.sendEvent("seek_completed", snapshot, previousPosition, { inferred: true, detection: "position_discontinuity", seek_from_seconds: previousPosition, seek_to_seconds: snapshot.position, seek_delta_seconds: snapshot.position - previousPosition });
        }
        this.suppressNextDiscontinuity = false;
        if (Date.now() - this.lastProgressAt < this.progressIntervalMs) return true;
        this.lastProgressAt = Date.now();
        this.observedProgress = true;
        this.sink.sendEvent("playback_progress", snapshot, null, { sampling_interval_ms: this.progressIntervalMs, player_state: event.provider_state ?? "playing" });
        this.maybeComplete(snapshot);
        return true;
      case "buffering_started":
        if (!this.sessionStarted) return false;
        this.pendingBuffer = true;
        this.resumeAfterBuffer = this.playing;
        this.stopActiveClock();
        this.playing = false;
        this.sink.sendEvent("buffering_started", snapshot, null, { state: "start", provider_state: event.provider_state ?? "buffering" });
        return true;
      case "buffering_ended":
        if (!this.sessionStarted) return false;
        this.pendingBuffer = false;
        this.playing = this.resumeAfterBuffer;
        this.resumeAfterBuffer = false;
        if (this.playing) this.startActiveClock();
        this.sink.sendEvent("buffering_ended", snapshot, null, { state: "end" });
        return true;
      case "rate_changed":
        if (!this.sessionStarted) return false;
        this.sink.sendEvent("playback_rate_changed", snapshot, null, { previous_rate: event.fromRate ?? null, new_rate: event.toRate }, { playback_rate: event.toRate, from_rate: event.fromRate ?? null, to_rate: event.toRate });
        return true;
      case "volume_changed":
        if (!this.sessionStarted) return false;
        this.sink.sendEvent("volume_changed", snapshot, null, { previous_volume: event.fromVolume ?? null, new_volume: event.toVolume });
        return true;
      case "mute_changed":
        if (!this.sessionStarted) return false;
        this.sink.sendEvent("mute_changed", snapshot, null, { previous_muted: event.fromMuted ?? null, new_muted: event.toMuted });
        return true;
      case "fullscreen_changed":
        if (!this.sessionStarted) return false;
        this.sink.sendEvent(event.fullscreen ? "fullscreen_entered" : "fullscreen_exited", snapshot, null, { fullscreen: event.fullscreen });
        return true;
      case "visibility_changed":
        if (!this.sessionStarted) return false;
        this.sink.sendEvent(event.visibility === "hidden" ? "visibility_hidden" : "visibility_visible", snapshot, null, { new_visibility: event.visibility });
        return true;
      case "quality_changed":
        if (!this.sessionStarted) return false;
        this.sink.sendEvent("quality_changed", snapshot, null, { previous_quality: event.fromQuality ?? null, new_quality: event.toQuality });
        return true;
      case "error":
        if (!this.sessionStarted) return false;
        this.sink.sendEvent("player_error", snapshot, null, { provider: event.provider, error_code: event.providerCode, recoverable: false });
        return true;
      case "ended":
        if (!this.sessionStarted) return false;
        this.maybeComplete(snapshot);
        this.stopActiveClock();
        this.playing = false;
        this.completionSent = true;
        await this.sink.endSession(snapshot, true, Math.round(this.watchTimeSeconds));
        this.sessionStarted = false;
        this.hasPlayed = false;
        this.completionSent = false;
        this.watchTimeSeconds = 0;
        this.observedProgress = false;
        return true;
    }
  }

  async end(snapshot: PlaybackSnapshot | null = null): Promise<void> {
    if (!this.sessionStarted) return;
    this.stopActiveClock();
    this.playing = false;
    await this.sink.endSession(snapshot ? this.remember(snapshot) : (this.lastPosition === null ? null : { position: this.lastPosition, duration: this.lastDuration }), this.completionSent, Math.round(this.watchTimeSeconds));
    this.sessionStarted = false;
    this.hasPlayed = false;
    this.completionSent = false;
    this.watchTimeSeconds = 0;
    this.observedProgress = false;
  }
}
