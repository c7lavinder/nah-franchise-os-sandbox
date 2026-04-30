"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { UserRole } from "@/types/database";
import { BASE_PATH } from "@/lib/base-path";

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
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: () => {},
});

/** Hook to access auth state from any component */
export function useAuth() {
  return useContext(AuthContext);
}

const USER_KEY = "nah_user";

/** Auth provider — wraps the app and manages login/logout/session state */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  /** Clear client-side user state */
  const clearAuth = useCallback(() => {
    setUser(null);
    localStorage.removeItem(USER_KEY);
  }, []);

  /**
   * Refresh the session via the server. Cookies are sent automatically.
   * Returns true on success, false otherwise.
   */
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE_PATH}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  /** Restore user from localStorage on mount + refresh the access token. */
  useEffect(() => {
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as SessionUser;
        setUser(parsed);
        // Eagerly refresh so an idle-overnight token doesn't 401 the first API call
        void refreshSession();
      } catch {
        clearAuth();
      }
    }
    setLoading(false);
  }, [clearAuth, refreshSession]);

  /** Refresh the access token every 45 min while the tab is open. */
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(
      () => {
        void refreshSession();
      },
      45 * 60 * 1000
    );
    return () => clearInterval(interval);
  }, [user, refreshSession]);

  /** Log in with email and password */
  async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${BASE_PATH}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error ?? "Login failed" };
      }

      // Store user profile in localStorage (for hydration on next page load)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);

      return { success: true };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  }

  /** Log out */
  function logout() {
    fetch(`${BASE_PATH}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    clearAuth();
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}
