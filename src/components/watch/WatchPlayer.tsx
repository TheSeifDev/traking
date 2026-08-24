"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Info, RotateCcw } from "lucide-react";
import type { TrackingEventPayload, TrackingEventType } from "@/src/types/tracking";
import type { VideoSourceType } from "@/src/types/video";
import { getProviderAdapter, getYouTubeId } from "@/src/lib/playback/providers";
import { UniversalTrackingEngine, type PlaybackSnapshot } from "@/src/lib/playback/tracking-engine";

type YouTubeStateChangeEvent = { data: number };
type YouTubeErrorEvent = { data?: number };
type YouTubeReadyEvent = { target: YouTubePlayer };
type YouTubePlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlaybackRate?: () => number;
  getVolume?: () => number;
  isMuted?: () => boolean;
  getPlaybackQuality?: () => string;
  playVideo: () => void;
  pauseVideo: () => void;
  destroy: () => void;
};
type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId?: string;
      playerVars?: Record<string, number | string>;
      events: {
        onReady: (event: YouTubeReadyEvent) => void;
        onStateChange: (event: YouTubeStateChangeEvent) => void;
        onError?: (event?: YouTubeErrorEvent) => void;
      };
    },
  ) => YouTubePlayer;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
  };
};

type VimeoEventData = {
  seconds?: number;
  duration?: number;
  playbackRate?: number;
  volume?: number;
  message?: string;
  name?: string;
};
type VimeoPlayer = {
  on: (event: string, callback: (data?: unknown) => void) => void;
  off?: (event: string, callback?: (data?: unknown) => void) => void;
  getCurrentTime: () => Promise<number>;
  getDuration: () => Promise<number>;
  getPlaybackRate: () => Promise<number>;
  getVolume: () => Promise<number>;
  getPaused?: () => Promise<boolean>;
  isMuted?: () => Promise<boolean>;
  destroy: () => Promise<void> | void;
};
type VimeoApi = { Player: new (element: HTMLElement | HTMLIFrameElement, options?: Record<string, unknown>) => VimeoPlayer };

declare global {
  interface Window {
    YT?: YouTubeApi;
    Vimeo?: VimeoApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null;
function loadYouTubeApi(): Promise<YouTubeApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("YouTube API requires a browser"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearInterval(pollId);
      window.clearTimeout(timeoutId);
      if (error) {
        youtubeApiPromise = null;
        reject(error);
      } else if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        youtubeApiPromise = null;
        reject(new Error("YouTube IFrame API did not initialize"));
      }
    };
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      finish();
    };
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => finish(new Error("Unable to load the YouTube IFrame API"));
      document.head.appendChild(script);
    }
    const pollId = window.setInterval(() => {
      if (window.YT?.Player) finish();
    }, 100);
    const timeoutId = window.setTimeout(() => finish(new Error("Timed out loading the YouTube IFrame API")), 15000);
  });
  return youtubeApiPromise;
}

let vimeoApiPromise: Promise<VimeoApi> | null = null;
function loadVimeoApi(): Promise<VimeoApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("Vimeo API requires a browser"));
  if (window.Vimeo?.Player) return Promise.resolve(window.Vimeo);
  if (vimeoApiPromise) return vimeoApiPromise;
  vimeoApiPromise = new Promise<VimeoApi>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://player.vimeo.com/api/player.js"]');
    const finish = () => window.Vimeo?.Player ? resolve(window.Vimeo) : reject(new Error("Vimeo Player API did not initialize"));
    if (existingScript) {
      existingScript.addEventListener("load", finish, { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Unable to load Vimeo Player API")), { once: true });
      if (window.Vimeo?.Player) finish();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://player.vimeo.com/api/player.js";
    script.async = true;
    script.onload = finish;
    script.onerror = () => reject(new Error("Unable to load Vimeo Player API"));
    document.head.appendChild(script);
  }).catch((error) => {
    vimeoApiPromise = null;
    throw error;
  });
  return vimeoApiPromise;
}

function createClientEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function asVimeoData(value: unknown): VimeoEventData {
  return value && typeof value === "object" ? value as VimeoEventData : {};
}

interface WatchPlayerProps {
  watchLinkToken: string;
  title: string;
  sourceType: VideoSourceType;
  sourceUrl: string;
  duration: number | null;
}

export default function WatchPlayer({ watchLinkToken, title, sourceType, sourceUrl, duration }: WatchPlayerProps) {
  const adapter = getProviderAdapter(sourceType);
  const isDirectUrl = adapter.playback_kind === "native_html5";
  const isYouTube = adapter.playback_kind === "youtube_iframe_api";
  const isVimeo = adapter.playback_kind === "vimeo_player_sdk";
  const hasPlaybackTelemetry = adapter.capabilities.detailed_tracking;
  const embedUrl = adapter.build_embed_url(sourceUrl);

  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubeContainerRef = useRef<HTMLDivElement>(null);
  const vimeoContainerRef = useRef<HTMLDivElement>(null);
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const vimeoPlayerRef = useRef<VimeoPlayer | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const sessionStartRequestRef = useRef<Promise<boolean> | null>(null);
  const sessionEndedRef = useRef(false);
  const sessionEngineRef = useRef<UniversalTrackingEngine | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sequenceNumberRef = useRef(0);
  const pendingEventsRef = useRef<TrackingEventPayload[]>([]);
  const eventFlushRequestRef = useRef<Promise<boolean> | null>(null);
  const flushEventsRef = useRef<((keepalive?: boolean) => Promise<boolean>) | null>(null);
  const durationRef = useRef<number | null>(duration);
  const lastPositionRef = useRef<number | null>(null);
  const lastDurationRef = useRef<number | null>(duration);
  const lastPlaybackRateRef = useRef<number | null>(null);
  const lastVolumeRef = useRef<number | null>(null);
  const lastMutedRef = useRef<boolean | null>(null);
  const lastQualityRef = useRef<string | null>(null);
  const seekFromRef = useRef<number | null>(null);
  const [playerReady, setPlayerReady] = useState(!isYouTube && !isVimeo);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const updateSnapshot = useCallback((snapshot: PlaybackSnapshot): PlaybackSnapshot => {
    const safeDuration = typeof snapshot.duration === "number" && Number.isFinite(snapshot.duration) && snapshot.duration > 0 ? snapshot.duration : durationRef.current;
    const safePosition = typeof snapshot.position === "number" && Number.isFinite(snapshot.position) ? Math.max(0, snapshot.position) : 0;
    const normalized = { position: safeDuration ? Math.min(safeDuration, safePosition) : safePosition, duration: safeDuration ?? null };
    lastPositionRef.current = normalized.position;
    if (normalized.duration) {
      durationRef.current = normalized.duration;
      lastDurationRef.current = normalized.duration;
    }
    return normalized;
  }, []);

  const flushEvents = useCallback(async (keepalive = false): Promise<boolean> => {
    const sessionId = sessionIdRef.current;
    const sessionToken = sessionTokenRef.current;
    if (!sessionId || !sessionToken || pendingEventsRef.current.length === 0) return true;
    if (eventFlushRequestRef.current) return eventFlushRequestRef.current;
    const batch = pendingEventsRef.current.splice(0, 50);
    const request = (async () => {
      try {
        const response = await fetch("/api/tracking/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, session_token: sessionToken, events: batch }),
          keepalive,
        });
        if (!response.ok) pendingEventsRef.current = [...batch, ...pendingEventsRef.current].slice(-100);
        return response.ok;
      } catch {
        pendingEventsRef.current = [...batch, ...pendingEventsRef.current].slice(-100);
        return false;
      }
    })();
    eventFlushRequestRef.current = request;
    try {
      return await request;
    } finally {
      eventFlushRequestRef.current = null;
      if (pendingEventsRef.current.length > 0 && !sessionEndedRef.current) void flushEventsRef.current?.(keepalive);
    }
  }, []);

  useEffect(() => {
    flushEventsRef.current = flushEvents;
    return () => { flushEventsRef.current = null; };
  }, [flushEvents]);

  const sendEvent = useCallback((eventType: TrackingEventType, snapshot: PlaybackSnapshot, fromPosition?: number | null, metadata?: Record<string, string | number | boolean | null>, telemetryFields?: Pick<TrackingEventPayload, "playback_rate" | "from_rate" | "to_rate">) => {
    const sessionId = sessionIdRef.current;
    const sessionToken = sessionTokenRef.current;
    if (!sessionId || !sessionToken || sessionEndedRef.current) return;
    const event: TrackingEventPayload = {
      session_id: sessionId,
      session_token: sessionToken,
      event_type: eventType,
      position: snapshot.position,
      duration: snapshot.duration,
      from_position: fromPosition ?? null,
      client_event_id: createClientEventId(),
      sequence_number: sequenceNumberRef.current++,
      occurred_at: new Date().toISOString(),
      playback_rate: telemetryFields?.playback_rate ?? lastPlaybackRateRef.current,
      from_rate: telemetryFields?.from_rate,
      to_rate: telemetryFields?.to_rate,
      metadata,
    };
    pendingEventsRef.current.push(event);
    if (eventType !== "playback_progress" || pendingEventsRef.current.length >= 5) void flushEvents();
  }, [flushEvents]);

  const startSession = useCallback(async (): Promise<boolean> => {
    if (sessionIdRef.current && sessionTokenRef.current) return true;
    if (sessionStartRequestRef.current) return sessionStartRequestRef.current;
    const request = (async () => {
      try {
        const response = await fetch("/api/tracking/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ watch_link_token: watchLinkToken }) });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403) {
          setError("Your viewer access has expired. Reopen this private link to continue watching.");
          return false;
        }
        if (!response.ok || typeof data.session_id !== "string" || typeof data.session_token !== "string") {
          setError("Unable to start the private watch session.");
          return false;
        }
        sessionIdRef.current = data.session_id;
        sessionTokenRef.current = data.session_token;
        sessionEndedRef.current = false;
        return true;
      } catch {
        setError("Network error while starting the watch session.");
        return false;
      } finally {
        sessionStartRequestRef.current = null;
      }
    })();
    sessionStartRequestRef.current = request;
    return request;
  }, [watchLinkToken]);

  const stopProgressPolling = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const readYouTubeSnapshot = useCallback((): PlaybackSnapshot | null => {
    const player = youtubePlayerRef.current;
    if (!player) return null;
    const position = Number(player.getCurrentTime());
    const rawDuration = Number(player.getDuration());
    if (!Number.isFinite(position)) return null;
    return updateSnapshot({ position, duration: Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : durationRef.current });
  }, [updateSnapshot]);

  const readDirectSnapshot = useCallback((): PlaybackSnapshot | null => {
    const video = videoRef.current;
    if (!video) return null;
    return updateSnapshot({ position: video.currentTime, duration: Number.isFinite(video.duration) && video.duration > 0 ? video.duration : durationRef.current });
  }, [updateSnapshot]);

  const readVimeoSnapshot = useCallback(async (data?: VimeoEventData): Promise<PlaybackSnapshot | null> => {
    const player = vimeoPlayerRef.current;
    if (!player) return null;
    try {
      const [position, rawDuration] = await Promise.all([
        typeof data?.seconds === "number" ? Promise.resolve(data.seconds) : player.getCurrentTime(),
        typeof data?.duration === "number" ? Promise.resolve(data.duration) : player.getDuration(),
      ]);
      return updateSnapshot({ position, duration: rawDuration });
    } catch {
      return null;
    }
  }, [updateSnapshot]);

  const readCurrentSnapshot = useCallback((): PlaybackSnapshot | null => {
    if (isYouTube) return readYouTubeSnapshot();
    if (isDirectUrl) return readDirectSnapshot();
    if (isVimeo && lastPositionRef.current !== null) return { position: lastPositionRef.current, duration: lastDurationRef.current };
    return null;
  }, [isDirectUrl, isVimeo, isYouTube, readDirectSnapshot, readYouTubeSnapshot]);

  const finishTrackedSession = useCallback(async (snapshot: PlaybackSnapshot | null, completed: boolean, watchTimeSeconds: number) => {
    if (sessionEndedRef.current) return;
    const sessionId = sessionIdRef.current;
    const sessionToken = sessionTokenRef.current;
    if (!sessionId || !sessionToken) return;
    sessionEndedRef.current = true;
    stopProgressPolling();
    const finalSnapshot = snapshot ? updateSnapshot(snapshot) : readCurrentSnapshot();
    await flushEvents(true);
    const body = JSON.stringify({
      session_id: sessionId,
      session_token: sessionToken,
      watch_time_seconds: Math.max(0, watchTimeSeconds),
      completion_percentage: completed ? 100 : 0,
      position: finalSnapshot?.position ?? lastPositionRef.current,
      duration: finalSnapshot?.duration ?? lastDurationRef.current,
      final_event: { client_event_id: createClientEventId(), sequence_number: sequenceNumberRef.current++, occurred_at: new Date().toISOString() },
    });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon(`/api/tracking/session/${sessionId}/end`, new Blob([body], { type: "application/json" }));
      else await fetch(`/api/tracking/session/${sessionId}/end`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    } catch {
      // Best effort during page close.
    }
  }, [flushEvents, readCurrentSnapshot, stopProgressPolling, updateSnapshot]);

  const handleNormalized = useCallback(async (event: Parameters<UniversalTrackingEngine["handle"]>[0]): Promise<boolean> => {
    const engine = sessionEngineRef.current;
    if (!engine) return false;
    return engine.handle(event);
  }, []);

  const pollYouTubeAuxiliaryState = useCallback((snapshot: PlaybackSnapshot) => {
    const player = youtubePlayerRef.current;
    if (!player) return;
    const nextRate = player.getPlaybackRate?.();
    if (typeof nextRate === "number" && Number.isFinite(nextRate) && nextRate > 0 && nextRate !== lastPlaybackRateRef.current) {
      const previousRate = lastPlaybackRateRef.current;
      lastPlaybackRateRef.current = nextRate;
      void handleNormalized({ type: "rate_changed", snapshot, fromRate: previousRate, toRate: nextRate });
    }
    const nextVolume = player.getVolume?.();
    if (typeof nextVolume === "number" && Number.isFinite(nextVolume) && nextVolume !== lastVolumeRef.current) {
      const previousVolume = lastVolumeRef.current;
      lastVolumeRef.current = nextVolume;
      void handleNormalized({ type: "volume_changed", snapshot, fromVolume: previousVolume, toVolume: nextVolume });
    }
    const nextMuted = player.isMuted?.();
    if (typeof nextMuted === "boolean" && nextMuted !== lastMutedRef.current) {
      const previousMuted = lastMutedRef.current;
      lastMutedRef.current = nextMuted;
      void handleNormalized({ type: "mute_changed", snapshot, fromMuted: previousMuted, toMuted: nextMuted });
    }
    const nextQuality = player.getPlaybackQuality?.();
    if (typeof nextQuality === "string" && nextQuality && nextQuality !== lastQualityRef.current) {
      const previousQuality = lastQualityRef.current;
      lastQualityRef.current = nextQuality;
      void handleNormalized({ type: "quality_changed", snapshot, fromQuality: previousQuality, toQuality: nextQuality });
    }
  }, [handleNormalized]);

  const startProgressPolling = useCallback(() => {
    if (progressTimerRef.current) return;
    progressTimerRef.current = setInterval(() => {
      if (isVimeo) {
        void readVimeoSnapshot().then((snapshot) => snapshot && void handleNormalized({ type: "progress", snapshot, provider_state: "playing" }));
        return;
      }
      const snapshot = readCurrentSnapshot();
      if (snapshot) {
        void handleNormalized({ type: "progress", snapshot, provider_state: "playing" });
        if (isYouTube) pollYouTubeAuxiliaryState(snapshot);
      }
    }, 1000);
  }, [handleNormalized, isYouTube, isVimeo, pollYouTubeAuxiliaryState, readCurrentSnapshot, readVimeoSnapshot]);

  const reportProviderError = useCallback((providerCode: number, snapshot: PlaybackSnapshot | null, metadata?: Record<string, string | number | boolean | null>) => {
    const sessionId = sessionIdRef.current;
    const sessionToken = sessionTokenRef.current;
    if (!sessionId || !sessionToken || !Number.isInteger(providerCode)) return;
    const safeSnapshot = snapshot ?? readCurrentSnapshot() ?? { position: lastPositionRef.current ?? 0, duration: lastDurationRef.current };
    void handleNormalized({ type: "error", snapshot: safeSnapshot, providerCode, provider: sourceType });
    void fetch("/api/tracking/provider-error", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sessionId, session_token: sessionToken, source_type: sourceType, provider_code: providerCode, metadata }), keepalive: true }).catch(() => undefined);
  }, [handleNormalized, readCurrentSnapshot, sourceType]);

  useEffect(() => {
    if (!hasPlaybackTelemetry) return;
    sessionEngineRef.current = new UniversalTrackingEngine({ ensureSession: startSession, sendEvent, endSession: finishTrackedSession }, 5000);
    return () => {
      stopProgressPolling();
      const snapshot = readCurrentSnapshot();
      void sessionEngineRef.current?.end(snapshot);
      sessionEngineRef.current = null;
    };
  }, [finishTrackedSession, hasPlaybackTelemetry, readCurrentSnapshot, sendEvent, startSession, stopProgressPolling]);

  useEffect(() => {
    if (!isYouTube || !youtubeContainerRef.current) return;
    let cancelled = false;
    let player: YouTubePlayer | null = null;
    void loadYouTubeApi().then((api) => {
      if (cancelled || !youtubeContainerRef.current) return;
      const videoId = getYouTubeId(sourceUrl);
      if (!videoId) {
        setError("This YouTube URL could not be embedded safely.");
        return;
      }
      const iframe = document.createElement("iframe");
      iframe.title = title;
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?enablejsapi=1&rel=0&playsinline=1&origin=${encodeURIComponent(window.location.origin)}&widget_referrer=${encodeURIComponent(window.location.origin)}`;
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      iframe.className = "h-full w-full";
      youtubeContainerRef.current.replaceChildren(iframe);
      player = new api.Player(iframe, {
        events: {
          onReady: (readyEvent) => {
            youtubePlayerRef.current = readyEvent.target;
            const initialDuration = Number(readyEvent.target.getDuration());
            if (Number.isFinite(initialDuration) && initialDuration > 0) updateSnapshot({ position: 0, duration: initialDuration });
            lastPlaybackRateRef.current = readyEvent.target.getPlaybackRate?.() ?? null;
            lastVolumeRef.current = readyEvent.target.getVolume?.() ?? null;
            lastMutedRef.current = readyEvent.target.isMuted?.() ?? null;
            lastQualityRef.current = readyEvent.target.getPlaybackQuality?.() ?? null;
            setPlayerReady(true);
          },
          onStateChange: (event: YouTubeStateChangeEvent) => {
            const snapshot = readYouTubeSnapshot();
            if (!snapshot) return;
            if (event.data === api.PlayerState.PLAYING) {
              void handleNormalized({ type: "play", snapshot, provider_state: "playing" }).then((started) => { if (started) startProgressPolling(); else youtubePlayerRef.current?.pauseVideo(); });
            } else if (event.data === api.PlayerState.PAUSED) {
              stopProgressPolling();
              void handleNormalized({ type: "pause", snapshot });
            } else if (event.data === api.PlayerState.BUFFERING) {
              stopProgressPolling();
              void handleNormalized({ type: "buffering_started", snapshot, provider_state: "buffering" });
            } else if (event.data === api.PlayerState.ENDED) {
              stopProgressPolling();
              void handleNormalized({ type: "ended", snapshot });
            }
          },
          onError: (providerError) => {
            const snapshot = readYouTubeSnapshot();
            setError("YouTube could not load this video inside TrackUp.");
            reportProviderError(providerError?.data ?? 0, snapshot);
          },
        },
      });
    }).catch(() => {
      if (!cancelled) setError("Unable to load the YouTube player inside TrackUp.");
    });
    return () => {
      cancelled = true;
      player?.destroy();
      youtubePlayerRef.current = null;
    };
  }, [handleNormalized, isYouTube, readYouTubeSnapshot, reportProviderError, retryNonce, sourceUrl, startProgressPolling, stopProgressPolling, title, updateSnapshot]);

  useEffect(() => {
    if (!isVimeo || !vimeoContainerRef.current || !embedUrl) return;
    let cancelled = false;
    let player: VimeoPlayer | null = null;
    void loadVimeoApi().then((api) => {
      if (cancelled || !vimeoContainerRef.current) return;
      const iframe = document.createElement("iframe");
      iframe.src = embedUrl;
      iframe.title = title;
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.allow = "autoplay; fullscreen; picture-in-picture";
      iframe.allowFullscreen = true;
      iframe.className = "h-full w-full";
      vimeoContainerRef.current.replaceChildren(iframe);
      player = new api.Player(iframe);
      vimeoPlayerRef.current = player;
      const snapshotFrom = (data?: unknown) => readVimeoSnapshot(asVimeoData(data));
      player.on("loaded", (data) => { void snapshotFrom(data).then((snapshot) => { if (snapshot) setPlayerReady(true); }); });
      player.on("durationchange", (data) => { void snapshotFrom(data); });
      player.on("play", (data) => { void snapshotFrom(data).then((snapshot) => snapshot && handleNormalized({ type: "play", snapshot, provider_state: "playing" }).then((started) => { if (started) startProgressPolling(); })); });
      player.on("pause", (data) => { stopProgressPolling(); void snapshotFrom(data).then((snapshot) => snapshot && handleNormalized({ type: "pause", snapshot })); });
      player.on("seeking", (data) => { void snapshotFrom(data).then((snapshot) => { if (snapshot) { seekFromRef.current = lastPositionRef.current; void handleNormalized({ type: "seek_started", snapshot, fromPosition: seekFromRef.current }); } }); });
      player.on("seeked", (data) => { const fromPosition = seekFromRef.current; void player?.getPaused?.().then((paused) => snapshotFrom(data).then((snapshot) => snapshot && handleNormalized({ type: "seek_completed", snapshot, fromPosition, resumeAfterSeek: paused !== true }).then((started) => { if (started) startProgressPolling(); }))).catch(() => undefined); seekFromRef.current = null; });
      player.on("timeupdate", (data) => { void snapshotFrom(data).then((snapshot) => snapshot && handleNormalized({ type: "progress", snapshot, provider_state: "playing" })); });
      player.on("bufferstart", (data) => { stopProgressPolling(); void snapshotFrom(data).then((snapshot) => snapshot && handleNormalized({ type: "buffering_started", snapshot, provider_state: "buffering" })); });
      player.on("bufferend", (data) => { void snapshotFrom(data).then((snapshot) => snapshot && handleNormalized({ type: "buffering_ended", snapshot }).then(() => { if (sessionEngineRef.current?.isPlaying) startProgressPolling(); })); });
      player.on("playbackratechange", (data) => { const event = asVimeoData(data); if (typeof event.playbackRate === "number") void snapshotFrom(event).then((snapshot) => snapshot && handleNormalized({ type: "rate_changed", snapshot, fromRate: lastPlaybackRateRef.current, toRate: event.playbackRate as number })); });
      player.on("volumechange", (data) => { const event = asVimeoData(data); if (typeof event.volume === "number") void snapshotFrom(event).then((snapshot) => snapshot && handleNormalized({ type: "volume_changed", snapshot, fromVolume: lastVolumeRef.current, toVolume: event.volume as number })); });
      player.on("ended", (data) => { stopProgressPolling(); void snapshotFrom(data).then((snapshot) => snapshot && handleNormalized({ type: "ended", snapshot })); });
      player.on("error", (data) => { const event = asVimeoData(data); setError("Vimeo could not load this video inside TrackUp."); void snapshotFrom(event).then((snapshot) => { reportProviderError(1, snapshot, { provider_message: event.message ?? event.name ?? "unknown" }); }); });
    }).catch(() => { if (!cancelled) setError("Unable to load the Vimeo player inside TrackUp."); });
    return () => {
      cancelled = true;
      stopProgressPolling();
      void player?.destroy();
      vimeoPlayerRef.current = null;
    };
  }, [embedUrl, handleNormalized, isVimeo, readVimeoSnapshot, reportProviderError, retryNonce, startProgressPolling, stopProgressPolling, title]);

  useEffect(() => {
    if (!hasPlaybackTelemetry) return;
    const onFullscreenChange = () => {
      const snapshot = readCurrentSnapshot();
      if (snapshot) void handleNormalized({ type: "fullscreen_changed", snapshot, fullscreen: Boolean(document.fullscreenElement) });
    };
    const onVisibilityChange = () => {
      const snapshot = readCurrentSnapshot();
      if (snapshot) void handleNormalized({ type: "visibility_changed", snapshot, visibility: document.visibilityState === "hidden" ? "hidden" : "visible" });
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [handleNormalized, hasPlaybackTelemetry, readCurrentSnapshot]);

  useEffect(() => {
    if (!hasPlaybackTelemetry) return;
    const onBeforeUnload = () => { void sessionEngineRef.current?.end(readCurrentSnapshot()); };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasPlaybackTelemetry, readCurrentSnapshot]);

  const handleDirectPlay = useCallback(() => {
    const snapshot = readDirectSnapshot();
    if (!snapshot) return;
    void handleNormalized({ type: "play", snapshot, provider_state: "playing" }).then((started) => { if (started) startProgressPolling(); else videoRef.current?.pause(); });
  }, [handleNormalized, readDirectSnapshot, startProgressPolling]);
  const handleDirectPause = useCallback(() => {
    stopProgressPolling();
    const snapshot = readDirectSnapshot();
    if (snapshot) void handleNormalized({ type: "pause", snapshot });
  }, [handleNormalized, readDirectSnapshot, stopProgressPolling]);
  const handleDirectSeeking = useCallback(() => {
    const snapshot = readDirectSnapshot();
    if (snapshot) { seekFromRef.current = snapshot.position; void handleNormalized({ type: "seek_started", snapshot, fromPosition: snapshot.position }); }
  }, [handleNormalized, readDirectSnapshot]);
  const handleDirectSeeked = useCallback(() => {
    const snapshot = readDirectSnapshot();
    if (snapshot) void handleNormalized({ type: "seek_completed", snapshot, fromPosition: seekFromRef.current, resumeAfterSeek: videoRef.current ? !videoRef.current.paused : false }).then((started) => { if (started) startProgressPolling(); });
    seekFromRef.current = null;
  }, [handleNormalized, readDirectSnapshot, startProgressPolling]);
  const handleDirectWaiting = useCallback(() => {
    stopProgressPolling();
    const snapshot = readDirectSnapshot();
    if (snapshot) void handleNormalized({ type: "buffering_started", snapshot, provider_state: "waiting" });
  }, [handleNormalized, readDirectSnapshot, stopProgressPolling]);
  const handleDirectCanPlay = useCallback(() => {
    const snapshot = readDirectSnapshot();
    if (snapshot) void handleNormalized({ type: "buffering_ended", snapshot }).then(() => { if (sessionEngineRef.current?.isPlaying) startProgressPolling(); });
  }, [handleNormalized, readDirectSnapshot, startProgressPolling]);
  const handleDirectRate = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const nextRate = event.currentTarget.playbackRate;
    const snapshot = readDirectSnapshot();
    if (snapshot) void handleNormalized({ type: "rate_changed", snapshot, fromRate: lastPlaybackRateRef.current, toRate: nextRate });
    lastPlaybackRateRef.current = nextRate;
  }, [handleNormalized, readDirectSnapshot]);
  const handleDirectVolume = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    const nextVolume = Math.round(video.volume * 100);
    const snapshot = readDirectSnapshot();
    if (snapshot) void handleNormalized({ type: "volume_changed", snapshot, fromVolume: lastVolumeRef.current, toVolume: nextVolume });
    lastVolumeRef.current = nextVolume;
    if (lastMutedRef.current !== video.muted && snapshot) void handleNormalized({ type: "mute_changed", snapshot, fromMuted: lastMutedRef.current, toMuted: video.muted });
    lastMutedRef.current = video.muted;
  }, [handleNormalized, readDirectSnapshot]);
  const handleDirectEnded = useCallback(() => {
    stopProgressPolling();
    const snapshot = readDirectSnapshot();
    if (snapshot) void handleNormalized({ type: "ended", snapshot });
  }, [handleNormalized, readDirectSnapshot, stopProgressPolling]);

  const capabilityMessage = adapter.playback_kind === "native_html5"
    ? "TrackUp controls native HTML5 playback and records play, pause, seek origin/destination, sampled progress, buffering, rate, volume, fullscreen, visibility, completion, and end."
    : adapter.playback_kind === "youtube_iframe_api"
      ? "TrackUp controls YouTube through the official IFrame Player API and records only valid API state changes, sampled position/duration, detectable seeks, rate, volume, buffering, completion, and end."
      : adapter.playback_kind === "vimeo_player_sdk"
        ? "TrackUp controls Vimeo through the official Player SDK and records only valid SDK state changes, sampled position/duration, seeks, rate, volume, buffering, completion, and end."
        : "This provider is embedded inside TrackUp, but it does not expose a reliable playback API here. TrackUp records no fabricated playback metrics or watched ranges for this source.";

  if (error) {
    return <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-2xl border border-red-400/20 bg-[#120b22] px-6 text-center shadow-2xl shadow-black/25"><AlertCircle size={25} className="text-red-300" /><p className="text-sm text-red-100">{error}</p><button onClick={() => { setError(null); setPlayerReady(!isYouTube && !isVimeo); setRetryNonce((value) => value + 1); }} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 transition hover:bg-white/8 hover:text-white"><RotateCcw size={13} />Try again</button></div>;
  }

  return <div className="space-y-3"><div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/25">{isDirectUrl ? <video ref={videoRef} src={sourceUrl} controls className="h-full w-full" onLoadedMetadata={(event) => { const value = event.currentTarget.duration; if (Number.isFinite(value) && value > 0) updateSnapshot({ position: event.currentTarget.currentTime, duration: value }); lastPlaybackRateRef.current = event.currentTarget.playbackRate; lastVolumeRef.current = Math.round(event.currentTarget.volume * 100); lastMutedRef.current = event.currentTarget.muted; setPlayerReady(true); }} onPlay={handleDirectPlay} onPause={handleDirectPause} onSeeking={handleDirectSeeking} onSeeked={handleDirectSeeked} onWaiting={handleDirectWaiting} onCanPlay={handleDirectCanPlay} onRateChange={handleDirectRate} onVolumeChange={handleDirectVolume} onEnded={handleDirectEnded} title={title} /> : isYouTube ? <div ref={youtubeContainerRef} className="h-full w-full" aria-label={title} /> : isVimeo ? <div ref={vimeoContainerRef} className="h-full w-full" aria-label={title} /> : embedUrl ? <iframe src={embedUrl} title={title} className="h-full w-full" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/50">This video source cannot be embedded by TrackUp.</div>}{hasPlaybackTelemetry && !playerReady && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60"><span className="text-sm text-white/60">Preparing TrackUp player...</span></div>}</div><p className="flex items-start gap-2 rounded-xl border border-white/8 bg-white/[0.025] px-3.5 py-3 text-xs leading-5 text-white/45"><Info size={14} className="mt-0.5 shrink-0 text-violet-300/70" />{capabilityMessage}</p></div>;
}
