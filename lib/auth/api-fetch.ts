/**
 * Authenticated fetch wrapper for client-side API calls.
 * Reads the JWT from localStorage and attaches it as a Bearer token.
 * On 401, automatically refreshes the token and retries once.
 * If refresh also fails, clears auth state and redirects to login.
 */

const TOKEN_KEY = "nah_auth_token";
const REFRESH_KEY = "nah_refresh_token";
const USER_KEY = "nah_user";
const LOGIN_AT_KEY = "nah_login_at";

/** Clear all auth state and redirect to login. */
function forceLogout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(LOGIN_AT_KEY);
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

/** Try to refresh the access token using the stored refresh token. */
async function tryRefresh(): Promise<string | null> {
  const rt = localStorage.getItem(REFRESH_KEY);
  if (!rt) return null;

  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
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
    const newToken = await tryRefresh();
    if (newToken) {
      const [retryUrl, retryInit] = buildRequest(url, init, newToken);
      return fetch(retryUrl, retryInit);
    }
    // Refresh failed — session is dead, force login
    forceLogout();
  }

  return res;
}
