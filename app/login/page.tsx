"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";

/** Login page — email + password authentication via Supabase Auth */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { user, login, loading: authLoading } = useAuth();
  const router = useRouter();

  // Redirect to Scout if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/scout");
    }
  }, [user, authLoading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      router.replace("/scout");
    } else {
      setError(result.error ?? "Login failed");
    }

    setLoading(false);
  }

  // Don't render login form if we're checking existing session
  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-nah-orange flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-h1">NAH</span>
          </div>
          <h1 className="text-display text-text-primary">Franchise OS</h1>
          <p className="text-body text-text-secondary mt-2">
            Sign in to access your dashboard
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="card space-y-4">
          {/* Error message */}
          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger text-body-sm rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {/* Email field */}
          <div>
            <label
              htmlFor="email"
              className="block text-body text-text-secondary mb-1.5"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@newagainhouses.com"
              required
              className="input w-full"
              autoComplete="email"
            />
          </div>

          {/* Password field */}
          <div>
            <label
              htmlFor="password"
              className="block text-body text-text-secondary mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="input w-full"
              autoComplete="current-password"
            />
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Footer */}
        <p className="text-caption text-text-tertiary text-center mt-6">
          New Again Houses &copy; {new Date().getFullYear()} &middot; Powered by
          Scout AI
        </p>
      </div>
    </div>
  );
}
