/**
 * Base path prefix for the app (e.g. '/frandev').
 * Used by apiFetch, AuthContext, and any code that builds URLs manually.
 * Next.js Link/router/redirect handle basePath automatically — this
 * constant is only for raw fetch() calls and window.location assignments.
 */
export const BASE_PATH = "/frandev";
