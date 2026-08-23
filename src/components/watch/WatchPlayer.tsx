"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Info, RotateCcw } from "lucide-react";
import type { TrackingEventPayload, TrackingEventType } from "@/src/types/tracking";

type YouTubeStateChangeEvent = { data: number };
type YouTubeErrorEvent = { data?: number };
type YouTubeReadyEvent = { target: YouTubePlayer };
type YouTubePlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  playVideo: () => void;
  pauseVideo: () => void;
  destroy: () => void;
};
type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
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

declare global {
  interface Window {
    YT?: YouTubeApi;
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

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
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
    const timeoutId = window.setTimeout(() => {
      finish(new Error("Timed out loading the YouTube IFrame API"));
    }, 15000);
  });

  return youtubeApiPromise;
}

function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be" || parsed.hostname.endsWith(".youtu.be")) {
      return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      if (parsed.pathname.startsWith("/embed/")) return parsed.pathname.split("/")[2] ?? null;
      if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/")[2] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match ? match[1] : null;
}

function buildEmbedUrl(sourceType: string, sourceUrl: string): string {
  if (sourceType === "vimeo") {
    const id = extractVimeoId(sourceUrl);
    if (id) return `https://player.vimeo.com/video/${id}?api=1`;
  }
  return sourceUrl;
}

function createClientEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface PlaybackSnapshot {
  position: number;
  duration: number | null;
}

interface WatchPlayerProps {
  watchLinkToken: string;
  title: string;
  sourceType: string;
  sourceUrl: string;
  duration: number | null;
}

export default function WatchPlayer({
  watchLinkToken,
  title,
  sourceType,
  sourceUrl,
  duration,
}: WatchPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubeContainerRef = useRef<HTMLDivElement>(null);
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const sessionStartRequestRef = useRef<Promise<boolean> | null>(null);
  const playbackStartRequestRef = useRef<Promise<boolean> | null>(null);
  const sessionEndedRef = useRef(false);
  const hasPlayedRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const watchTimeRef = useRef(0);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completionSentRef = useRef(false);
  const durationRef = useRef<number | null>(duration);
  const lastDurationRef = useRef<number | null>(duration);
  const lastPositionRef = useRef<number | null>(null);
  const pausedPositionRef = useRef<number | null>(null);
  const furthestPositionRef = useRef(0);
  const seekFromRef = useRef<number | null>(null);
  const pendingEventsRef = useRef<TrackingEventPayload[]>([]);
  const eventFlushRequestRef = useRef<Promise<boolean> | null>(null);
  const flushEventsRef = useRef<((keepalive?: boolean) => Promise<boolean>) | null>(null);
  const sequenceNumberRef = useRef(0);
  const [playerReady, setPlayerReady] = useState(sourceType !== "youtube");
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const isDirectUrl = sourceType === "direct_url";
  const isYouTube = sourceType === "youtube";
  const hasPlaybackTelemetry = isDirectUrl || isYouTube;
  const embedUrl = isYouTube ? null : isDirectUrl ? null : buildEmbedUrl(sourceType, sourceUrl);

  const readYouTubeSnapshot = useCallback((): PlaybackSnapshot | null => {
    const player = youtubePlayerRef.current;
    if (!player) return null;
    const position = Number(player.getCurrentTime());
    const rawDuration = Number(player.getDuration());
    if (!Number.isFinite(position)) return null;
    const safeDuration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : durationRef.current;
    return { position: Math.max(0, position), duration: safeDuration };
  }, []);

  const updateSnapshot = useCallback((snapshot: PlaybackSnapshot) => {
    lastPositionRef.current = snapshot.position;
    furthestPositionRef.current = Math.max(furthestPositionRef.current, snapshot.position);
    if (snapshot.duration && snapshot.duration > 0) {
      durationRef.current = snapshot.duration;
      lastDurationRef.current = snapshot.duration;
    }
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

  const sendEvent = useCallback(async (
    eventType: TrackingEventType,
    snapshot: PlaybackSnapshot,
    fromPosition?: number | null,
    metadata?: Record<string, string | number | boolean | null>,
  ) => {
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
      metadata,
    };
    pendingEventsRef.current.push(event);
    if (eventType !== "heartbeat" || pendingEventsRef.current.length >= 5) void flushEvents();
  }, [flushEvents]);

  const startSession = useCallback(async (): Promise<boolean> => {
    if (sessionIdRef.current && sessionTokenRef.current) return true;
    if (sessionStartRequestRef.current) return sessionStartRequestRef.current;

    const request = (async () => {
      try {
        const response = await fetch("/api/tracking/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ watch_link_token: watchLinkToken }),
        });
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

  const reportProviderError = useCallback((providerCode: number) => {
    const sessionId = sessionIdRef.current;
    const sessionToken = sessionTokenRef.current;
    if (!sessionId || !sessionToken || !Number.isInteger(providerCode)) return;
    void fetch("/api/tracking/provider-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, session_token: sessionToken, source_type: sourceType, provider_code: providerCode }),
      keepalive: true,
    }).catch(() => undefined);
  }, [sourceType]);

  const accumulateWatchTime = useCallback((resume: boolean) => {
    const playStartedAt = startTimeRef.current;
    if (playStartedAt === null) return;
    watchTimeRef.current += Math.max(0, (Date.now() - playStartedAt) / 1000);
    startTimeRef.current = resume ? Date.now() : null;
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const endSession = useCallback(async () => {
    if (sessionEndedRef.current) return;
    const sessionId = sessionIdRef.current;
    const sessionToken = sessionTokenRef.current;
    if (!sessionId || !sessionToken) return;

    sessionEndedRef.current = true;
    stopHeartbeat();
    const finalSnapshot = isYouTube
      ? readYouTubeSnapshot()
      : videoRef.current
        ? {
            position: Math.max(0, videoRef.current.currentTime),
            duration: Number.isFinite(videoRef.current.duration) && videoRef.current.duration > 0
              ? videoRef.current.duration
              : durationRef.current,
          }
        : null;
    if (finalSnapshot) updateSnapshot(finalSnapshot);
    accumulateWatchTime(false);
    const finalPosition = finalSnapshot?.position ?? lastPositionRef.current;
    const finalDuration = finalSnapshot?.duration ?? lastDurationRef.current ?? durationRef.current;
    const completion = finalDuration && finalDuration > 0
      ? Math.min(100, Math.round((furthestPositionRef.current / finalDuration) * 100))
      : 0;
    await flushEvents(true);
    const body = JSON.stringify({
      session_id: sessionId,
      session_token: sessionToken,
      watch_time_seconds: watchTimeRef.current,
      completion_percentage: completion,
      position: finalPosition,
      duration: finalDuration,
      final_event: {
        client_event_id: createClientEventId(),
        sequence_number: sequenceNumberRef.current++,
        occurred_at: new Date().toISOString(),
      },
    });

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          `/api/tracking/session/${sessionId}/end`,
          new Blob([body], { type: "application/json" }),
        );
      } else {
        await fetch(`/api/tracking/session/${sessionId}/end`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
      }
    } catch {
      // Best-effort end-of-session delivery on page close.
    }
  }, [accumulateWatchTime, flushEvents, isYouTube, readYouTubeSnapshot, stopHeartbeat, updateSnapshot]);

  const maybeRecordCompletion = useCallback((snapshot: PlaybackSnapshot) => {
    if (completionSentRef.current || !snapshot.duration || snapshot.duration <= 0) return;
    if ((snapshot.position / snapshot.duration) * 100 >= 95) {
      completionSentRef.current = true;
      void sendEvent("complete", snapshot);
    }
  }, [sendEvent]);

  const startPlaybackSegment = useCallback(async (readSnapshot: () => PlaybackSnapshot | null): Promise<boolean> => {
    if (startTimeRef.current !== null) return true;
    if (playbackStartRequestRef.current) return playbackStartRequestRef.current;

    const request = (async () => {
      const initialSnapshot = readSnapshot();
      if (!initialSnapshot) return false;
      const sessionStarted = await startSession();
      if (!sessionStarted) return false;

      const pausedPosition = pausedPositionRef.current;
      updateSnapshot(initialSnapshot);
      startTimeRef.current = Date.now();
      const eventType: TrackingEventType = hasPlayedRef.current ? "resume" : "play";
      hasPlayedRef.current = true;
      if (eventType === "resume" && pausedPosition !== null && Math.abs(initialSnapshot.position - pausedPosition) >= 8) {
        void sendEvent("seek", initialSnapshot, pausedPosition);
      }
      pausedPositionRef.current = null;
      void sendEvent(eventType, initialSnapshot);
      maybeRecordCompletion(initialSnapshot);

      stopHeartbeat();
      heartbeatIntervalRef.current = setInterval(() => {
        const snapshot = readSnapshot();
        if (!snapshot) return;
        const previousPosition = lastPositionRef.current;
        updateSnapshot(snapshot);
        accumulateWatchTime(true);
        if (isYouTube && previousPosition !== null && Math.abs(snapshot.position - previousPosition) >= 8) {
          void sendEvent("seek", snapshot, previousPosition);
        }
        void sendEvent("heartbeat", snapshot);
        maybeRecordCompletion(snapshot);
      }, 5000);
      return true;
    })();

    playbackStartRequestRef.current = request;
    try {
      return await request;
    } finally {
      playbackStartRequestRef.current = null;
    }
  }, [accumulateWatchTime, isYouTube, maybeRecordCompletion, sendEvent, startSession, stopHeartbeat, updateSnapshot]);

  const handleDirectPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    void startPlaybackSegment(() => ({
      position: Math.max(0, video.currentTime),
      duration: Number.isFinite(video.duration) && video.duration > 0 ? video.duration : durationRef.current,
    })).then((started) => {
      if (!started) video.pause();
    });
  }, [startPlaybackSegment]);

  const handleDirectPause = useCallback(() => {
    const video = videoRef.current;
    if (!video || !sessionIdRef.current || startTimeRef.current === null) return;
    const snapshot = {
      position: Math.max(0, video.currentTime),
      duration: Number.isFinite(video.duration) && video.duration > 0 ? video.duration : durationRef.current,
    };
    updateSnapshot(snapshot);
    accumulateWatchTime(false);
    stopHeartbeat();
    void sendEvent("pause", snapshot);
  }, [accumulateWatchTime, sendEvent, stopHeartbeat, updateSnapshot]);

  const handleDirectSeeking = useCallback(() => {
    const video = videoRef.current;
    if (video) seekFromRef.current = video.currentTime;
  }, []);

  const handleDirectSeeked = useCallback(() => {
    const video = videoRef.current;
    if (!video || !sessionIdRef.current || startTimeRef.current === null) return;
    const snapshot = {
      position: Math.max(0, video.currentTime),
      duration: Number.isFinite(video.duration) && video.duration > 0 ? video.duration : durationRef.current,
    };
    updateSnapshot(snapshot);
    void sendEvent("seek", snapshot, seekFromRef.current);
    seekFromRef.current = null;
  }, [sendEvent, updateSnapshot]);

  const handleDirectTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const snapshot = {
      position: Math.max(0, video.currentTime),
      duration: Number.isFinite(video.duration) && video.duration > 0 ? video.duration : durationRef.current,
    };
    updateSnapshot(snapshot);
    maybeRecordCompletion(snapshot);
  }, [maybeRecordCompletion, updateSnapshot]);

  const handleDirectEnded = useCallback(() => {
    const video = videoRef.current;
    if (!video || !sessionIdRef.current) return;
    const snapshot = {
      position: Math.max(0, video.currentTime),
      duration: Number.isFinite(video.duration) && video.duration > 0 ? video.duration : durationRef.current,
    };
    updateSnapshot(snapshot);
    void endSession();
  }, [endSession, updateSnapshot]);

  const handleYouTubeStateChange = useCallback((event: YouTubeStateChangeEvent) => {
    const api = window.YT;
    const snapshot = readYouTubeSnapshot();
    if (!api || !snapshot) return;
    if (event.data === api.PlayerState.PLAYING) {
      void startPlaybackSegment(readYouTubeSnapshot).then((started) => {
        if (!started) youtubePlayerRef.current?.pauseVideo();
      });
      return;
    }
    if (event.data === api.PlayerState.PAUSED) {
      if (!sessionIdRef.current) return;
      updateSnapshot(snapshot);
      pausedPositionRef.current = snapshot.position;
      accumulateWatchTime(false);
      stopHeartbeat();
      void sendEvent("pause", snapshot);
      return;
    }
    if (event.data === api.PlayerState.BUFFERING) {
      if (sessionIdRef.current) void sendEvent("buffer", snapshot, null, { state: "buffering" });
      return;
    }
    if (event.data === api.PlayerState.ENDED) {
      if (!sessionIdRef.current) return;
      updateSnapshot({ ...snapshot, position: snapshot.duration ?? snapshot.position });
      void endSession();
    }
  }, [accumulateWatchTime, endSession, readYouTubeSnapshot, sendEvent, startPlaybackSegment, stopHeartbeat, updateSnapshot]);

  useEffect(() => {
    if (!isYouTube || !youtubeContainerRef.current) return;
    let cancelled = false;
    let player: YouTubePlayer | null = null;

    void loadYouTubeApi().then((api) => {
      if (cancelled || !youtubeContainerRef.current) return;
      const videoId = extractYouTubeId(sourceUrl);
      if (!videoId) {
        setError("This YouTube URL could not be embedded safely.");
        return;
      }
      player = new api.Player(youtubeContainerRef.current, {
        videoId,
        playerVars: {
          rel: 0,
          playsinline: 1,
          origin: window.location.origin,
          widget_referrer: window.location.origin,
        },
        events: {
          onReady: (readyEvent) => {
            youtubePlayerRef.current = readyEvent.target;
            const initialDuration = Number(readyEvent.target.getDuration());
            if (Number.isFinite(initialDuration) && initialDuration > 0) {
              durationRef.current = initialDuration;
              lastDurationRef.current = initialDuration;
            }
            setPlayerReady(true);
          },
          onStateChange: handleYouTubeStateChange,
          onError: (providerError) => {
            setError("YouTube could not load this video inside TrackUp.");
            reportProviderError(providerError?.data ?? 0);
            void endSession();
          },
        },
      });
      const iframe = youtubeContainerRef.current.querySelector<HTMLIFrameElement>("iframe");
      iframe?.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    }).catch(() => {
      if (!cancelled) setError("Unable to load the YouTube player inside TrackUp.");
    });

    return () => {
      cancelled = true;
      stopHeartbeat();
      player?.destroy();
      youtubePlayerRef.current = null;
    };
  }, [endSession, handleYouTubeStateChange, isYouTube, reportProviderError, retryNonce, sourceUrl, stopHeartbeat]);

  useEffect(() => {
    const onBeforeUnload = () => { void endSession(); };
    const onVisibilityChange = () => {
      if (!sessionIdRef.current || sessionEndedRef.current) return;
      const snapshot = isYouTube
        ? readYouTubeSnapshot()
        : videoRef.current
          ? { position: videoRef.current.currentTime, duration: durationRef.current }
          : null;
      if (snapshot) void sendEvent("visibility_change", snapshot, null, { visibility: document.visibilityState });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void endSession();
    };
  }, [endSession, isYouTube, readYouTubeSnapshot, sendEvent]);

  const capabilityMessage = isDirectUrl
    ? "Native HTML5 playback is available. TrackUp records play, pause, seek origin/destination, heartbeat, completion, duration, and end."
    : isYouTube
      ? "YouTube is controlled by the official IFrame Player API inside TrackUp. TrackUp records API state changes, current time, duration, progress heartbeats, detectable seek discontinuities, completion, and end."
      : "This provider is embedded inside TrackUp, but it does not expose a reliable playback API here. TrackUp does not create fabricated sessions or playback metrics for this source.";

  if (error) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-2xl border border-red-400/20 bg-[#120b22] px-6 text-center shadow-2xl shadow-black/25">
        <AlertCircle size={25} className="text-red-300" />
        <p className="text-sm text-red-100">{error}</p>

        <button onClick={() => { setError(null); setPlayerReady(sourceType !== "youtube"); setRetryNonce((value) => value + 1); }} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 transition hover:bg-white/8 hover:text-white"><RotateCcw size={13} />Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/25">
        {isDirectUrl ? (
          <video
            ref={videoRef}
            src={sourceUrl}
            controls
            className="h-full w-full"
            onLoadedMetadata={(event) => {
              const metadataDuration = event.currentTarget.duration;
              if (Number.isFinite(metadataDuration) && metadataDuration > 0) {
                durationRef.current = metadataDuration;
                lastDurationRef.current = metadataDuration;
              }
            }}
            onPlay={handleDirectPlay}
            onPause={handleDirectPause}
            onSeeking={handleDirectSeeking}
            onSeeked={handleDirectSeeked}
            onTimeUpdate={handleDirectTimeUpdate}
            onWaiting={() => { const video = videoRef.current; if (video && sessionIdRef.current) void sendEvent("buffer", { position: video.currentTime, duration: durationRef.current }, null, { state: "waiting" }); }}
            onRateChange={(event) => { const video = videoRef.current; if (video && sessionIdRef.current) void sendEvent("rate_change", { position: video.currentTime, duration: durationRef.current }, null, { rate: event.currentTarget.playbackRate }); }}
            onEnded={handleDirectEnded}
            title={title}
          />
        ) : isYouTube ? (
          <div ref={youtubeContainerRef} className="h-full w-full" aria-label={title} />
        ) : embedUrl ? (
          <iframe
            src={embedUrl}
            title={title}
            className="h-full w-full"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/50">This video source cannot be embedded by TrackUp.</div>
        )}
        {hasPlaybackTelemetry && !playerReady && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="text-sm text-white/60">Preparing TrackUp player...</span>
          </div>
        )}
      </div>
      <p className="flex items-start gap-2 rounded-xl border border-white/8 bg-white/[0.025] px-3.5 py-3 text-xs leading-5 text-white/45"><Info size={14} className="mt-0.5 shrink-0 text-violet-300/70" />{capabilityMessage}</p>
    </div>
  );
}
