"use client";

import { useEffect } from "react";

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

export default function PresenceHeartbeat() {
  useEffect(() => {
    let lastSentAt = 0;
    let inFlight = false;

    const sendHeartbeat = async () => {
      if (inFlight || Date.now() - lastSentAt < HEARTBEAT_INTERVAL_MS) return;
      inFlight = true;
      try {
        const response = await fetch("/api/auth/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          cache: "no-store",
          credentials: "same-origin",
        });
        if (response.ok) lastSentAt = Date.now();
      } catch {
        // A missed heartbeat is not an online claim; the next interval retries.
      } finally {
        inFlight = false;
      }
    };

    void sendHeartbeat();
    const timer = window.setInterval(() => void sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void sendHeartbeat();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
