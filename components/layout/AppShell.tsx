"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import { QuickAsk } from "@/components/scout";
import type { UserRole } from "@/types/database";

interface AppShellProps {
  children: React.ReactNode;
  pageTitle: string;
  userName: string;
  userRole: UserRole;
}

/** Main app shell — sidebar rail + main content, no top bar */
export default function AppShell({
  children,
  userName,
  userRole,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const isScoutPage = pathname === "/scout";

  return (
    <div className="flex min-h-screen">
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-[200] p-2 rounded-xl bg-surface-glass backdrop-blur-lg border border-border-glass"
        aria-label="Open menu"
      >
        <Menu size={20} className="text-text-primary" />
      </button>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-[150] lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed top-4 right-4 z-[200] lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-xl bg-surface-glass backdrop-blur-lg border border-border-glass"
            >
              <X size={20} className="text-text-primary" />
            </button>
          </div>
        </>
      )}

      {/* Sidebar — always visible on desktop, toggled on mobile */}
      <div className={`${mobileMenuOpen ? "block" : "hidden"} lg:block`}>
        <Sidebar userRole={userRole} onNavClick={() => setMobileMenuOpen(false)} />
      </div>

      {/* Main content */}
      <main className="flex-1 ml-0 lg:ml-[80px] min-h-screen">
        <div className="max-w-content mx-auto px-4 md:px-8 py-6">
          {/* Persistent Scout Ask bar — hidden on Scout AI page */}
          {!isScoutPage && (
            <div className="mb-4">
              <QuickAsk context={pathname} />
            </div>
          )}
          {children}
        </div>
      </main>

    </div>
  );
}
