/**
 * Auth cookie helpers — shared options for httpOnly JWT cookies.
 */

import { NextResponse } from "next/server";
import { BASE_PATH } from "@/lib/base-path";

const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_PATH = BASE_PATH || "/";

const ACCESS_TOKEN_NAME = "nah_access_token";
const REFRESH_TOKEN_NAME = "nah_refresh_token";

/** Set access + refresh token cookies on a NextResponse */
export function setAuthCookies(response: NextResponse, accessToken: string, refreshToken: string): NextResponse {
  response.cookies.set(ACCESS_TOKEN_NAME, accessToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: 3600, // 1 hour (Supabase JWT expiry)
  });
  response.cookies.set(REFRESH_TOKEN_NAME, refreshToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
  return response;
}

/** Clear auth cookies on a NextResponse (logout) */
export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.set(ACCESS_TOKEN_NAME, "", {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: 0,
  });
  response.cookies.set(REFRESH_TOKEN_NAME, "", {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: 0,
  });
  return response;
}

/** Read the access token from a Request's cookies */
export function getAccessTokenFromCookies(request: Request): string | null {
  // NextRequest has a .cookies helper, but plain Request does not.
  // Parse from the Cookie header for compatibility.
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ACCESS_TOKEN_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Read the refresh token from a Request's cookies */
export function getRefreshTokenFromCookies(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${REFRESH_TOKEN_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
