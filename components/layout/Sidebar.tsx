"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  LayoutDashboard,
  Kanban,
  Users,
  BarChart3,
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  Phone,
  Activity,
} from "lucide-react";
import type { UserRole } from "@/types/database";

/** Navigation item definition */
interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  /** Which roles can see this nav item */
  roles: UserRole[];
}

/** All navigation items with role-based visibility */
const NAV_ITEMS: NavItem[] = [
  {
    label: "Scout AI",
    href: "/scout",
    icon: MessageSquare,
    roles: ["rep", "marketing", "leadership"],
  },
  {
    label: "Daily HQ",
    href: "/daily-hq",
    icon: LayoutDashboard,
    roles: ["rep", "leadership"],
  },
  {
    label: "Pipeline",
    href: "/pipeline",
    icon: Kanban,
    roles: ["rep", "leadership"],
  },
  {
    label: "Leads",
    href: "/leads",
    icon: Users,
    roles: ["rep", "leadership"],
  },
  {
    label: "Calls",
    href: "/calls",
    icon: Phone,
    roles: ["rep", "leadership"],
  },
  {
    label: "Activity",
    href: "/activity",
    icon: Activity,
    roles: ["rep", "leadership"],
  },
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: BarChart3,
    roles: ["leadership"],
  },
  {
    label: "Knowledge",
    href: "/knowledge",
    icon: BookOpen,
    roles: ["leadership"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["rep", "marketing", "leadership"],
  },
];

interface SidebarProps {
  userRole: UserRole;
}

/** Main sidebar navigation — collapses to icons on desktop, drawer on mobile */
export default function Sidebar({ userRole }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  // Filter nav items based on user role
  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <aside
      className={`fixed left-0 top-topbar h-[calc(100vh-56px)] bg-bg-secondary border-r border-border-default
        transition-all duration-200 ease-in-out z-40
        ${collapsed ? "w-sidebar-collapsed" : "w-sidebar"}`}
    >
      <nav className="flex flex-col h-full py-3">
        {/* Navigation items */}
        <div className="flex-1 space-y-1 px-2">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors duration-150
                  ${
                    isActive
                      ? "bg-nah-orange/10 text-nah-orange"
                      : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  }
                  ${collapsed ? "justify-center" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={20} className="flex-shrink-0" />
                {!collapsed && (
                  <span className="text-body font-medium">{item.label}</span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Collapse toggle button */}
        <div className="px-2 pt-2 border-t border-border-default">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full px-3 py-2 rounded-md
              text-text-tertiary hover:bg-bg-hover hover:text-text-secondary
              transition-colors duration-150"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!collapsed && (
              <span className="ml-2 text-body-sm">Collapse</span>
            )}
          </button>
        </div>
      </nav>
    </aside>
  );
}
