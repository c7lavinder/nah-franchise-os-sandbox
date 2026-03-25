"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  GitBranch,
  Users,
  Phone,
  Activity,
  BarChart2,
  BookOpen,
  Settings,
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

const NAV_ITEMS: NavItem[] = [
  { label: "Daily HQ", href: "/daily-hq", icon: LayoutDashboard, roles: ["rep", "leadership"] },
  { label: "Scout AI", href: "/scout", icon: Bot, roles: ["rep", "marketing", "leadership"] },
  { label: "Pipeline", href: "/pipeline", icon: GitBranch, roles: ["rep", "leadership"] },
  { label: "Leads", href: "/leads", icon: Users, roles: ["rep", "leadership"] },
  { label: "Calls", href: "/calls", icon: Phone, roles: ["rep", "leadership"] },
  { label: "Activity", href: "/activity", icon: Activity, roles: ["rep", "leadership"] },
  { label: "Dashboard", href: "/dashboard", icon: BarChart2, roles: ["leadership"] },
  { label: "Knowledge", href: "/knowledge", icon: BookOpen, roles: ["leadership"] },
  { label: "Settings", href: "/settings", icon: Settings, roles: ["rep", "marketing", "leadership"] },
];

interface SidebarProps {
  userRole: UserRole;
  onNavClick?: () => void;
}

export default function Sidebar({ userRole, onNavClick }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(userRole));

  const initials = (user?.fullName ?? "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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
        {/* Logo */}
        <div className="flex items-center gap-2.5 pl-1 pb-6 min-h-[60px]">
          <div className="w-10 h-10 rounded-lg bg-nah-blue flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-[10px]">NAH</span>
          </div>
          <Image
            src="/images/nah-logo.svg"
            alt="New Again Houses"
            width={140}
            height={36}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100"
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

        {/* User profile */}
        <div className="flex items-center gap-3 pl-3 pt-4 mt-auto rounded-xl">
          <div className="w-9 h-9 rounded-full bg-nah-blue text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
            {initials}
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 whitespace-nowrap">
            <p className="text-sm font-semibold text-text-primary">{user?.fullName ?? "User"}</p>
            <p className="text-xs text-text-secondary capitalize">{user?.role ?? "rep"}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
