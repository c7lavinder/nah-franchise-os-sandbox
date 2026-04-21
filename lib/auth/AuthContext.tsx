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
  }, []);

  /**
   * Refresh the access token using the stored refresh_token. Supabase JWTs
   * expire in ~1 hour, so without this every API call after an idle period
   * returns 401. Returns true on success, false if the refresh token is
   * also expired (forces re-login).
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
      if (!res.ok) {
        clearAuth();
        return false;
      }
      const data = (await res.json()) as { token: string; refreshToken: string };
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(REFRESH_KEY, data.refreshToken);
      setToken(data.token);
      return true;
    } catch {
      return false;
    }
  }, [clearAuth]);

  /** Restore session from localStorage on mount + refresh the access token. */
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedToken && storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as SessionUser;
        setToken(storedToken);
        setUser(parsed);
        // Eagerly refresh so an idle-overnight token doesn't 401 the first API call.
        void refreshAccessToken();
      } catch {
        clearAuth();
      }
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

      // Store session
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(REFRESH_KEY, data.refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));

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
