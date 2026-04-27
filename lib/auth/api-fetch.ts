/**
 * Authenticated fetch wrapper for client-side API calls.
 * Reads the JWT from localStorage and attaches it as a Bearer token.
 * Falls through to a normal fetch when no token is stored (pre-login).
 */

const TOKEN_KEY = "nah_auth_token";

export function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  if (!token) return fetch(url, init);

  const headers = new Headers(init.headers);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(url, { ...init, headers });
}
