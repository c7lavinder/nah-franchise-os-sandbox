/**
 * Authenticated fetch wrapper for client-side API calls.
 * With httpOnly cookies, the browser automatically sends auth cookies.
 * On 401, redirects to login (MasterSuite JWT is 30-day, no refresh).
 */

import { BASE_PATH } from "@/lib/base-path";

/** Clear client-side user state and redirect to login. */
function forceLogout() {
  localStorage.removeItem("nah_user");
  if (typeof window !== "undefined" && !window.location.pathname.startsWith(`${BASE_PATH}/login`)) {
    window.location.href = `${BASE_PATH}/login`;
  }
}

export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const resolvedUrl = url.startsWith("/") ? `${BASE_PATH}${url}` : url;

  // Browser sends httpOnly cookies automatically with credentials: "include"
  const res = await fetch(resolvedUrl, { ...init, credentials: "include" });

  // On 401, session expired — redirect to login
  if (res.status === 401) {
    forceLogout();
  }

  return res;
}
