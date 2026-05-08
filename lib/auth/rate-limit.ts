/**
 * In-memory rate limiter for API routes.
 *
 * Uses a sliding window counter per key (typically user ID).
 * Suitable for single-instance deployments (Vercel serverless resets on
 * cold starts, which is an acceptable trade-off — limits still protect
 * within a warm instance's lifetime).
 *
 * For multi-instance deployments, replace with Redis-backed limiter.
 */

import { NextResponse } from "next/server";

interface RateWindow {
  count: number;
  resetAt: number;
}

const windows = new Map<string, RateWindow>();

// Cleanup stale entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, window] of windows) {
      if (now > window.resetAt) {
        windows.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

/** Pre-built configs for common use cases */
export const RATE_LIMITS = {
  /** Scout chat: 20 messages per minute per user */
  scoutChat: { maxRequests: 20, windowSeconds: 60 },
  /** Scout action execution: 10 per minute */
  scoutAction: { maxRequests: 10, windowSeconds: 60 },
  /** Contact creation: 30 per minute */
  contactCreate: { maxRequests: 30, windowSeconds: 60 },
  /** General API: 100 per minute */
  general: { maxRequests: 100, windowSeconds: 60 },
  /** Lead intake (public): 10 per minute per IP */
  leadIntake: { maxRequests: 10, windowSeconds: 60 },
} as const;

/**
 * Check rate limit for a given key. Returns null if under limit,
 * or a 429 Response if limit exceeded.
 *
 * @param key  — unique identifier (userId, IP, etc.)
 * @param config — rate limit configuration
 */
export function checkRateLimit(key: string, config: RateLimitConfig): Response | null {
  const now = Date.now();
  const windowKey = `${key}:${config.maxRequests}:${config.windowSeconds}`;
  const existing = windows.get(windowKey);

  if (!existing || now > existing.resetAt) {
    // New window
    windows.set(windowKey, {
      count: 1,
      resetAt: now + config.windowSeconds * 1000,
    });
    return null;
  }

  existing.count++;

  if (existing.count > config.maxRequests) {
    const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(config.maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(existing.resetAt / 1000)),
        },
      }
    );
  }

  return null;
}
