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
   * Restore auth on mount.
   *
   * We first hydrate from localStorage for a fast paint, then ask the server
   * whether an httpOnly MasterSuite JWT cookie is already present. This allows
   * production SSO: a user who logged in through MasterSuite can enter FranDev
   * without using FranDev's local login form.
   */
  useEffect(() => {
    let cancelled = false;

    const storedUser = localStorage.getItem(USER_KEY);
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as SessionUser;
        setUser(parsed);
      } catch {
        clearAuth();
      }
    }

    async function restoreFromServerCookie() {
      try {
        const response = await fetch(`${BASE_PATH}/api/auth/me`, { credentials: "include" });
        if (!response.ok) {
          if (!cancelled && !storedUser) clearAuth();
          return;
        }

        const data = (await response.json()) as { user?: SessionUser };
        if (!cancelled && data.user) {
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          setUser(data.user);
        }
      } catch {
        // Network/auth restore failures should not crash the shell.
        if (!cancelled && !storedUser) clearAuth();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restoreFromServerCookie();

    return () => {
      cancelled = true;
    };
  }, [clearAuth]);

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
