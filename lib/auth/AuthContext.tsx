"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { UserRole } from "@/types/database";

/** The user object stored in auth context */
export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  ghlUserId: string | null;
}

interface AuthContextValue {
  user: SessionUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: () => {},
});

/** Hook to access auth state from any component */
export function useAuth() {
  return useContext(AuthContext);
}

const TOKEN_KEY = "nah_auth_token";
const REFRESH_KEY = "nah_refresh_token";
const USER_KEY = "nah_user";
/** Last time the user explicitly logged in with credentials. If the stored
 *  session is older than SESSION_MAX_AGE, we force a fresh login even if
 *  refresh tokens would otherwise still work — cap on "remember me" duration. */
const LOGIN_AT_KEY = "nah_login_at";
/** 30 days. User requested: stay signed in for 30 days. */
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Auth provider — wraps the app and manages login/logout/session state */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /** Clear all auth state */
  const clearAuth = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LOGIN_AT_KEY);
  }, []);

  /**
   * Refresh the access token using the stored refresh_token. Supabase JWTs
   * expire in ~1 hour, so without this every API call after an idle period
   * returns 401. Returns true on success, false otherwise. Never clears auth
   * on its own — transient network failures or a 5xx from Supabase should
   * not kick the user out. The mount effect and 30-day cap are the only
   * places that force logout.
   */
  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    const storedRefresh = localStorage.getItem(REFRESH_KEY);
    if (!storedRefresh) return false;

    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: storedRefresh }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { token: string; refreshToken: string };
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(REFRESH_KEY, data.refreshToken);
      setToken(data.token);
      return true;
    } catch {
      return false;
    }
  }, []);

  /** Restore session from localStorage on mount + refresh the access token.
   *  Session is valid for 30 days from the last explicit login. Within that
   *  window, we keep the stored session optimistically — a failed refresh is
   *  treated as "try again later," not "log the user out." */
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    const loginAt = Number(localStorage.getItem(LOGIN_AT_KEY) ?? 0);
    const sessionExpired = loginAt > 0 && Date.now() - loginAt > SESSION_MAX_AGE_MS;

    if (storedToken && storedUser && !sessionExpired) {
      try {
        const parsed = JSON.parse(storedUser) as SessionUser;
        setToken(storedToken);
        setUser(parsed);
        // Eagerly refresh so an idle-overnight token doesn't 401 the first API call.
        // Failures are tolerated — the old token stays in place and API calls
        // that 401 will trigger their own re-auth handling.
        void refreshAccessToken();
      } catch {
        clearAuth();
      }
    } else if (sessionExpired) {
      clearAuth();
    }
    setLoading(false);
  }, [clearAuth, refreshAccessToken]);

  /** Refresh the access token every 45 min while the tab is open. */
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => { void refreshAccessToken(); }, 45 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, refreshAccessToken]);

  /** Log in with email and password */
  async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error ?? "Login failed" };
      }

      // Store session + stamp the "remember me" clock
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(REFRESH_KEY, data.refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      localStorage.setItem(LOGIN_AT_KEY, String(Date.now()));

      setToken(data.token);
      setUser(data.user);

      return { success: true };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /** Log out */
  function logout() {
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearAuth();
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
