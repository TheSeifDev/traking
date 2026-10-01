/**
 * TrackUp Authentication Rate Limiter & Brute-Force Defense
 *
 * Implements sliding window rate-limiting for login attempts based on IP and identifier.
 * Provides fast in-memory rate limiting with database durability fallback.
 */

import { createAdminClient } from "@/utils/supabase/admin";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory sliding window cache
const memoryCache = new Map<string, RateLimitEntry>();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Periodic memory cache cleanup
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryCache.entries()) {
      if (entry.resetAt <= now) {
        memoryCache.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS).unref?.();
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Checks and records an attempt for a given key (e.g. IP or identifier).
 *
 * @param key Unique key to rate limit (e.g. "ip:192.168.1.1" or "user:admin")
 * @param maxAttempts Maximum allowed attempts within window
 * @param windowSeconds Window duration in seconds
 */
export async function checkRateLimit(
  key: string,
  maxAttempts = 10,
  windowSeconds = 900 // 15 minutes
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  // 1. Fast in-memory check
  const entry = memoryCache.get(key);
  if (entry && entry.resetAt > now) {
    if (entry.count >= maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetInSeconds: Math.ceil((entry.resetAt - now) / 1000),
      };
    }
    entry.count += 1;
    return {
      allowed: true,
      remaining: maxAttempts - entry.count,
      resetInSeconds: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  // Create new window in memory
  const newEntry: RateLimitEntry = {
    count: 1,
    resetAt: now + windowMs,
  };
  memoryCache.set(key, newEntry);

  // 2. Best-effort database synchronization for multi-instance deployments
  try {
    const supabase = createAdminClient();
    const expiresAt = new Date(now + windowMs).toISOString();

    const { data: dbEntry } = await supabase
      .from("auth_rate_limits")
      .select("attempts, expires_at")
      .eq("key", key)
      .maybeSingle();

    if (dbEntry && new Date(dbEntry.expires_at).getTime() > now) {
      if (dbEntry.attempts >= maxAttempts) {
        // Sync local memory with DB
        newEntry.count = dbEntry.attempts + 1;
        newEntry.resetAt = new Date(dbEntry.expires_at).getTime();
        return {
          allowed: false,
          remaining: 0,
          resetInSeconds: Math.ceil((newEntry.resetAt - now) / 1000),
        };
      }
      await supabase
        .from("auth_rate_limits")
        .update({ attempts: dbEntry.attempts + 1 })
        .eq("key", key);
    } else {
      await supabase.from("auth_rate_limits").upsert({
        key,
        attempts: 1,
        first_attempt_at: new Date(now).toISOString(),
        expires_at: expiresAt,
      });
    }
  } catch {
    // Database rate limit failure fails open to in-memory to prevent breaking login
  }

  return {
    allowed: true,
    remaining: maxAttempts - 1,
    resetInSeconds: windowSeconds,
  };
}

/**
 * Resets rate limit for a key upon successful login.
 */
export async function resetRateLimit(key: string): Promise<void> {
  memoryCache.delete(key);
  try {
    const supabase = createAdminClient();
    await supabase.from("auth_rate_limits").delete().eq("key", key);
  } catch {
    // Non-critical
  }
}
