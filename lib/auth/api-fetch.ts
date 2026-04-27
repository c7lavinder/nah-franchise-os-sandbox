/**
 * Authenticated fetch wrapper for client-side API calls.
 * Reads the JWT from localStorage and attaches it as a Bearer token.
 * On 401, automatically refreshes the token and retries once.
 */

const TOKEN_KEY = "nah_auth_token";
const REFRESH_KEY = "nah_refresh_token";

/** Try to refresh the access token using the stored refresh token. */
async function refreshToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;

  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;

    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
    return data.token;
  } catch {
    return null;
  }
}

function buildRequest(url: string, init: RequestInit, token: string): [string, RequestInit] {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return [url, { ...init, headers }];
}

export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  if (!token) return fetch(url, init);

  // First attempt with current token
  const [reqUrl, reqInit] = buildRequest(url, init, token);
  const res = await fetch(reqUrl, reqInit);

  // On 401, try refreshing the token and retry once
  if (res.status === 401) {
    const newToken = await refreshToken();
    if (newToken) {
      const [retryUrl, retryInit] = buildRequest(url, init, newToken);
      return fetch(retryUrl, retryInit);
    }
  }

  return res;
}
