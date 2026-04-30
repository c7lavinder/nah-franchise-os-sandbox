"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth/AuthContext";

/** Login page — email + password authentication via Supabase Auth */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { user, login, loading: authLoading } = useAuth();
  const router = useRouter();

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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <Image
            src="/frandev/images/nah-logo.svg"
            alt="New Again Houses"
            width={200}
            height={60}
            className="mx-auto mb-6"
            priority
          />
          <h1 className="font-headline text-page-title text-text-primary">FranDev</h1>
          <p className="text-subtitle text-text-secondary mt-1">Franchise Sales OS</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="card-glass space-y-4">
          {error && (
            <div className="bg-[#fee2e2] border border-[rgba(239,68,68,0.2)] text-danger text-body-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-body text-text-secondary mb-1.5">
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

          <div>
            <label htmlFor="password" className="block text-body text-text-secondary mb-1.5">
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

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-caption text-text-tertiary text-center mt-6">
          New Again Houses® &copy; {new Date().getFullYear()} &middot; FranDev powered by Scout AI
        </p>
      </div>
    </div>
  );
}
