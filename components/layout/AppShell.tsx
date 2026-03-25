"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import type { UserRole } from "@/types/database";

interface AppShellProps {
  children: React.ReactNode;
  pageTitle: string;
  userName: string;
  userRole: UserRole;
}

/** Main app shell — wraps all authenticated pages with sidebar + top bar */
export default function AppShell({
  children,
  pageTitle,
  userName,
  userRole,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Top navigation bar */}
      <TopBar
        pageTitle={pageTitle}
        userName={userName}
        onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile unless toggled */}
      <div
        className={`lg:block ${mobileMenuOpen ? "block" : "hidden"}`}
      >
        <Sidebar userRole={userRole} onNavClick={() => setMobileMenuOpen(false)} />
      </div>

      {/* Main content area */}
      <main className="pt-topbar lg:pl-sidebar transition-all duration-200">
        <div className="max-w-content mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
