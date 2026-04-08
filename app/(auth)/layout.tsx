"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AppShell } from "@/components/layout";
import { ToastProvider } from "@/components/ui/Toast";

/** Map pathname to page title for the top bar */
function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    "/scout": "Scout AI",
    "/daily-hq": "Daily HQ",
    "/pipeline": "Pipeline",
    "/leads": "Leads",
    "/dashboard": "Dashboard",
    "/knowledge": "Knowledge Base",
    "/settings": "Settings",
    "/workflows": "Workflows",
    "/onboarding": "Onboarding",
  };
  // Check exact match first, then prefix match for dynamic routes
  if (titles[pathname]) return titles[pathname];
  if (pathname.startsWith("/workflows/")) return "Workflow Builder";
  if (pathname.startsWith("/leads/")) return "Lead Detail";
  return "Franchise OS";
}

/**
 * Authenticated layout — protects all child routes.
 * Redirects to /login if not authenticated.
 * Wraps pages in the AppShell (sidebar + top bar).
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // Show loading state while checking auth
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-nah-orange flex items-center justify-center">
            <span className="text-white font-bold text-body-sm">NAH</span>
          </div>
          <p className="text-text-secondary text-body">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <AppShell
        pageTitle={getPageTitle(pathname)}
        userName={user.fullName}
        userRole={user.role}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
