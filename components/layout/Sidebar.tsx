"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  GitBranch,
  Phone,
  BarChart2,
  Workflow,
  Bell,
  BookOpen,
  Settings,
  LogOut,
  ChevronUp,
} from "lucide-react";
import type { UserRole } from "@/types/database";
import { useAuth } from "@/lib/auth/AuthContext";

/** Navigation item definition */
interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  roles: UserRole[];
}

/** Main nav — core pages only. Dashboard + Workflows moved to user pullout per §1.12 */
const NAV_ITEMS: NavItem[] = [
  { label: "Daily HQ", href: "/daily-hq", icon: LayoutDashboard, roles: ["rep", "leadership"] },
  { label: "Pipeline", href: "/pipeline", icon: GitBranch, roles: ["rep", "leadership"] },
  { label: "Calls", href: "/calls", icon: Phone, roles: ["rep", "leadership"] },
];

interface SidebarProps {
  userRole: UserRole;
  onNavClick?: () => void;
}

export default function Sidebar({ userRole, onNavClick }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [alertCount, setAlertCount] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setAlertCount(data.count ?? 0);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    void fetchAlerts();
    const interval = setInterval(() => void fetchAlerts(), 60000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(userRole));

  const initials = (user?.fullName ?? "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <aside
      className="group fixed left-0 top-0 bottom-0 z-[100] w-[80px] hover:w-[280px] overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{
        background: "rgba(255, 255, 255, 0.6)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderRight: "1px solid rgba(255, 255, 255, 0.6)",
      }}
    >
      <div className="w-[280px] h-full flex flex-col py-6 px-4">
        {/* Logo — icon when collapsed, full logo on hover */}
        <div className="flex items-center justify-center pb-6 min-h-[60px]">
          <Image
            src="/images/nah-icon.svg"
            alt="NAH"
            width={36}
            height={36}
            className="block group-hover:hidden flex-shrink-0"
          />
          <Image
            src="/images/nah-logo.svg"
            alt="New Again Houses"
            width={170}
            height={44}
            className="hidden group-hover:block"
            style={{ objectFit: "contain" }}
          />
        </div>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col gap-1">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavClick}
                className={`flex items-center gap-3 h-12 pl-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-nah-blue text-white"
                    : "text-text-secondary hover:bg-[rgba(0,161,225,0.08)] hover:text-nah-blue"
                }`}
              >
                <Icon size={20} className="flex-shrink-0" />
                <span className="text-nav opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 whitespace-nowrap">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Notification bell */}
        <Link
          href="/activity"
          onClick={onNavClick}
          className="relative flex items-center gap-3 h-12 pl-3 rounded-xl text-text-secondary hover:bg-[rgba(0,161,225,0.08)] hover:text-nah-blue transition-all duration-200 mt-auto"
        >
          <Bell size={20} className="flex-shrink-0" />
          {alertCount > 0 && (
            <span className="absolute top-2 left-8 min-w-[16px] h-4 px-1 rounded-full bg-[#f5a800] text-white text-[10px] font-bold flex items-center justify-center">
              {alertCount > 99 ? "99+" : alertCount}
            </span>
          )}
          <span className="text-nav opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 whitespace-nowrap">
            Alerts {alertCount > 0 ? `(${alertCount})` : ""}
          </span>
        </Link>

        {/* User profile + dropdown */}
        <div className="relative pt-3">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-full flex items-center gap-3 pl-3 py-2 rounded-xl hover:bg-[rgba(0,161,225,0.05)] transition-all duration-200"
          >
            <div className="w-9 h-9 rounded-full bg-nah-blue text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
              {initials}
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 whitespace-nowrap flex-1 text-left">
              <p className="text-sm font-semibold text-text-primary">{user?.fullName ?? "User"}</p>
              <p className="text-xs text-text-secondary capitalize">{user?.role ?? "rep"}</p>
            </div>
            <ChevronUp
              size={14}
              className={`text-text-tertiary opacity-0 group-hover:opacity-100 transition-all duration-200 delay-100 ${
                profileOpen ? "" : "rotate-180"
              }`}
            />
          </button>

          {/* Dropdown menu */}
          {profileOpen && (
            <div
              className="absolute bottom-full left-0 w-full mb-1 rounded-xl overflow-hidden"
              style={{
                background: "rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(0, 0, 0, 0.06)",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
              }}
            >
              {/* Dashboard + Workflows — parked per §1.12, accessible here */}
              <Link
                href="/dashboard"
                onClick={() => { setProfileOpen(false); onNavClick?.(); }}
                className="flex items-center gap-3 px-4 py-3 text-text-secondary hover:bg-[rgba(0,161,225,0.05)] hover:text-nah-blue transition-colors"
              >
                <BarChart2 size={16} />
                <span className="text-sm font-medium">Dashboard</span>
              </Link>
              <Link
                href="/workflows"
                onClick={() => { setProfileOpen(false); onNavClick?.(); }}
                className="flex items-center gap-3 px-4 py-3 text-text-secondary hover:bg-[rgba(0,161,225,0.05)] hover:text-nah-blue transition-colors"
              >
                <Workflow size={16} />
                <span className="text-sm font-medium">Workflows</span>
              </Link>
              <div style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }} />
              <Link
                href="/knowledge"
                onClick={() => { setProfileOpen(false); onNavClick?.(); }}
                className="flex items-center gap-3 px-4 py-3 text-text-secondary hover:bg-[rgba(0,161,225,0.05)] hover:text-nah-blue transition-colors"
              >
                <BookOpen size={16} />
                <span className="text-sm font-medium">Knowledge Base</span>
              </Link>
              <Link
                href="/settings"
                onClick={() => { setProfileOpen(false); onNavClick?.(); }}
                className="flex items-center gap-3 px-4 py-3 text-text-secondary hover:bg-[rgba(0,161,225,0.05)] hover:text-nah-blue transition-colors"
              >
                <Settings size={16} />
                <span className="text-sm font-medium">Settings</span>
              </Link>
              <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }} />
              <button
                onClick={() => { setProfileOpen(false); handleLogout(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-danger hover:bg-[rgba(239,68,68,0.05)] transition-colors"
              >
                <LogOut size={16} />
                <span className="text-sm font-medium">Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
