/**
 * Auth cookie helpers — shared options for httpOnly JWT cookie.
 * Stores the MasterSuite JWT (HS512, 30-day expiry).
 */

import { NextResponse } from "next/server";
import { BASE_PATH } from "@/lib/base-path";

const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_PATH = BASE_PATH || "/";

const ACCESS_TOKEN_NAME = "jwt";

/** Set the MasterSuite JWT cookie on a NextResponse */
export function setAuthCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(ACCESS_TOKEN_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: 30 * 24 * 60 * 60, // 30 days (matches MasterSuite JWT expiry)
  });
  return response;
}

/** Clear auth cookie on a NextResponse (logout) */
export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.set(ACCESS_TOKEN_NAME, "", {
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
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ACCESS_TOKEN_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
