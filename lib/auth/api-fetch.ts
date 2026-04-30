/**
 * Authenticated fetch wrapper for client-side API calls.
 * With httpOnly cookies, the browser automatically sends auth cookies.
 * On 401, automatically refreshes the session and retries once.
 * If refresh also fails, redirects to login.
 */

import { BASE_PATH } from "@/lib/base-path";

/** Clear client-side user state and redirect to login. */
function forceLogout() {
  localStorage.removeItem("nah_user");
  if (typeof window !== "undefined" && !window.location.pathname.startsWith(`${BASE_PATH}/login`)) {
    window.location.href = `${BASE_PATH}/login`;
  }
}

/** Try to refresh the access token via the server (cookies are sent automatically). */
async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_PATH}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const resolvedUrl = url.startsWith("/") ? `${BASE_PATH}${url}` : url;

  // Browser sends httpOnly cookies automatically with credentials: "include"
  const res = await fetch(resolvedUrl, { ...init, credentials: "include" });

  // On 401, try refreshing the session and retry once
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return fetch(resolvedUrl, { ...init, credentials: "include" });
    }
    forceLogout();
  }

  return res;
}
