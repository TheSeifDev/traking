"use client";

/**
 * WatchPlayer — Client-side video player with tracking integration.
 *
 * Tracking strategy:
 *   - play, pause, seek: emitted immediately
 *   - heartbeat: throttled every 5 seconds while playing
 *   - complete: emitted when video reaches 95%+ for the first time
 *   - ended: emitted on video end event
 *   - session end: sent on unmount + beforeunload with final metrics
 *
 * Provider limitations:
 *   - YouTube/Vimeo: embed API available but limited. For MVP we use
 *     iframe embeds and cannot intercept granular seek/play events without
 *     the provider JS SDK. YouTube IFrame API events (onStateChange) are
 *     supported for basic play/pause/end. Full segment tracking requires
 *     the YouTube Player API postMessage protocol.
 *   - direct_url: full HTML5 video element events available.
 *   - google_drive, telegram: iframe only, no event API — completion
 *     cannot be tracked accurately. Sessions are recorded but events
 *     are limited. This is a known limitation documented here.
 */
import { useEffect, useRef, useState, useCallback } from "react";

interface WatchPlayerProps {
  watchLinkToken: string;
  title: string;
  sourceType: string;
  sourceUrl: string;
  duration: number | null;
}

// Build the embed URL for supported providers
function buildEmbedUrl(sourceType: string, sourceUrl: string): string {
  if (sourceType === "youtube") {
    const id = extractYouTubeId(sourceUrl);
    if (id) return `https://www.youtube.com/embed/${id}?enablejsapi=1&rel=0`;
  }
  if (sourceType === "vimeo") {
    const id = extractVimeoId(sourceUrl);
    if (id) return `https://player.vimeo.com/video/${id}?api=1`;
  }
  // google_drive, telegram, direct_url (non-video file) → use source_url directly as iframe
  return sourceUrl;
}

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

function extractVimeoId(url: string): string | null {
  try {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export default function WatchPlayer({
  watchLinkToken,
  title,
  sourceType,
  sourceUrl,
  duration,
}: WatchPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const watchTimeRef = useRef<number>(0);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completionSentRef = useRef<boolean>(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirectUrl = sourceType === "direct_url";
  const embedUrl = isDirectUrl ? null : buildEmbedUrl(sourceType, sourceUrl);

  // --- Tracking helpers ---

  const sendEvent = useCallback(
    async (
      eventType: string,
      position: number,
      fromPosition?: number
    ) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      try {
        await fetch("/api/tracking/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            event_type: eventType,
            position,
            from_position: fromPosition ?? null,
          }),
        });
      } catch {
        // Best-effort; do not crash player on network error
      }
    },
    []
  );

  const endSession = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    const watchTime = watchTimeRef.current;
    const completion =
      duration && duration > 0
        ? Math.min(100, Math.round((watchTime / duration) * 100))
        : 0;
    try {
      // Use sendBeacon for reliability on page unload
      const body = JSON.stringify({
        watch_time_seconds: watchTime,
        completion_percentage: completion,
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          `/api/tracking/session/${sessionId}/end`,
          new Blob([body], { type: "application/json" })
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
      // Best-effort
    }
  }, [duration]);

  // --- Session creation ---

  useEffect(() => {
    let cancelled = false;

    async function initSession() {
      try {
        const res = await fetch("/api/tracking/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            watch_link_token: watchLinkToken,
            viewer_hint: navigator.userAgent?.slice(0, 64) ?? null,
          }),
        });
        if (!res.ok) {
          setError("Unable to start watch session.");
          return;
        }
        const data = await res.json();
        if (!cancelled && data.session_id) {
          sessionIdRef.current = data.session_id;
          startTimeRef.current = Date.now();
          setSessionReady(true);
        }
      } catch {
        if (!cancelled) setError("Network error starting watch session.");
      }
    }

    void initSession();
    return () => { cancelled = true; };
  }, [watchLinkToken]);

  // --- Session cleanup ---

  useEffect(() => {
    const onBeforeUnload = () => { void endSession(); };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      void endSession();
    };
  }, [endSession]);

  // --- HTML5 video event handlers ---

  const handlePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    void sendEvent("play", video.currentTime);

    // Start heartbeat
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    const playStart = Date.now();
    heartbeatIntervalRef.current = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.paused) return;
      void sendEvent("heartbeat", v.currentTime);
      // Accumulate watch time
      watchTimeRef.current += (Date.now() - playStart) / 1000;
    }, 5000);
  }, [sendEvent]);

  const handlePause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    void sendEvent("pause", video.currentTime);
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, [sendEvent]);

  const prevTimeRef = useRef<number>(0);
  const handleSeeked = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    void sendEvent("seek", video.currentTime, prevTimeRef.current);
  }, [sendEvent]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    prevTimeRef.current = video.currentTime;

    // Completion detection at 95%
    if (!completionSentRef.current && duration && duration > 0) {
      const pct = (video.currentTime / duration) * 100;
      if (pct >= 95) {
        completionSentRef.current = true;
        void sendEvent("complete", video.currentTime);
      }
    }
  }, [sendEvent, duration]);

  const handleEnded = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    void sendEvent("ended", video.currentTime);
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    void endSession();
  }, [sendEvent, endSession]);

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-white/5 aspect-video text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (isDirectUrl) {
    return (
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        <video
          ref={videoRef}
          src={sourceUrl}
          controls
          className="w-full h-full"
          onPlay={sessionReady ? handlePlay : undefined}
          onPause={sessionReady ? handlePause : undefined}
          onSeeked={sessionReady ? handleSeeked : undefined}
          onTimeUpdate={sessionReady ? handleTimeUpdate : undefined}
          onEnded={sessionReady ? handleEnded : undefined}
          title={title}
        />
        {!sessionReady && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white/60 text-sm">Loading...</span>
          </div>
        )}
      </div>
    );
  }

  // Iframe embed (YouTube, Vimeo, Google Drive, Telegram, etc.)
  // Note: For YouTube/Vimeo, the postMessage API can be used for events
  // in a future iteration. For MVP, we record session start/end only.
  return (
    <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
      {embedUrl && (
        <iframe
          src={embedUrl}
          title={title}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
      {!sessionReady && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
          <span className="text-white/60 text-sm">Loading session...</span>
        </div>
      )}
    </div>
  );
}
