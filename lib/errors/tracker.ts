/**
 * Structured error tracking.
 *
 * Assigns a unique error ID to each caught error, logs it with context,
 * and returns the ID so it can be included in the API response.
 * Users can quote the error ID when reporting issues.
 *
 * Also maintains a rolling in-memory window of recent errors for the
 * /api/settings/health endpoint to surface.
 */

import crypto from "crypto";

export interface TrackedError {
  errorId: string;
  route: string;
  method: string;
  userId?: string;
  message: string;
  stack?: string;
  timestamp: string;
}

/** Rolling window of recent errors (last 100, in-memory) */
const recentErrors: TrackedError[] = [];
const MAX_RECENT = 100;

/** Error counts per route in the current hour */
const hourlyCounts = new Map<string, { count: number; hourStart: number }>();

/**
 * Track an error and return a unique error ID.
 * The ID is included in the response so users can reference it.
 */
export function trackError(params: { error: unknown; route: string; method: string; userId?: string }): string {
  const errorId = crypto.randomUUID().slice(0, 8);
  const message = params.error instanceof Error ? params.error.message : String(params.error);
  const stack = params.error instanceof Error ? params.error.stack : undefined;

  const tracked: TrackedError = {
    errorId,
    route: params.route,
    method: params.method,
    userId: params.userId,
    message,
    stack,
    timestamp: new Date().toISOString(),
  };

  // Log to stdout (Vercel captures these)
  console.error(`[${errorId}] ${params.method} ${params.route}: ${message}`);

  // Add to rolling window
  recentErrors.unshift(tracked);
  if (recentErrors.length > MAX_RECENT) {
    recentErrors.pop();
  }

  // Increment hourly counter
  const hourStart = Math.floor(Date.now() / 3600000) * 3600000;
  const key = params.route;
  const entry = hourlyCounts.get(key);
  if (!entry || entry.hourStart !== hourStart) {
    hourlyCounts.set(key, { count: 1, hourStart });
  } else {
    entry.count++;
  }

  return errorId;
}

/** Get recent errors (admin use only) */
export function getRecentErrors(): TrackedError[] {
  return recentErrors.map(({ stack: _stack, ...rest }) => rest);
}

/** Get error rate summary per route */
export function getErrorRates(): { route: string; errorsThisHour: number }[] {
  const hourStart = Math.floor(Date.now() / 3600000) * 3600000;
  const rates: { route: string; errorsThisHour: number }[] = [];

  for (const [route, entry] of hourlyCounts) {
    if (entry.hourStart === hourStart) {
      rates.push({ route, errorsThisHour: entry.count });
    }
  }

  return rates.sort((a, b) => b.errorsThisHour - a.errorsThisHour);
}
