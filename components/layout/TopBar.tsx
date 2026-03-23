"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, User, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

interface TopBarProps {
  pageTitle: string;
  userName: string;
  onMenuToggle?: () => void;
}

/** Top navigation bar — logo, page title, and user menu */
export default function TopBar({ pageTitle, userName, onMenuToggle }: TopBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-topbar bg-bg-secondary border-b border-border-default z-50 flex items-center px-4">
      {/* Mobile menu toggle */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden mr-3 p-1.5 rounded-md text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        aria-label="Toggle menu"
      >
        <Menu size={20} />
      </button>

      {/* Logo */}
      <div className="flex items-center gap-2 mr-6">
        <div className="w-8 h-8 rounded-md bg-nah-orange flex items-center justify-center">
          <span className="text-white font-bold text-body-sm">NAH</span>
        </div>
        <span className="text-text-primary font-semibold text-body hidden sm:block">
          Franchise OS
        </span>
      </div>

      {/* Page title */}
      <h1 className="text-h2 text-text-primary flex-1">{pageTitle}</h1>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-bg-hover transition-colors"
        >
          {/* Avatar circle */}
          <div className="w-8 h-8 rounded-full bg-scout-purple flex items-center justify-center">
            <span className="text-white text-caption font-semibold">
              {userName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </span>
          </div>
          <span className="text-body text-text-primary hidden md:block">
            {userName}
          </span>
          <ChevronDown size={14} className="text-text-tertiary hidden md:block" />
        </button>

        {/* Dropdown menu */}
        {dropdownOpen && (
          <>
            {/* Backdrop to close dropdown */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setDropdownOpen(false)}
            />
            <div className="absolute right-0 top-full mt-1 w-48 bg-bg-tertiary border border-border-default rounded-lg shadow-lg z-50 py-1">
              <button className="w-full flex items-center gap-2 px-3 py-2 text-body text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors">
                <User size={16} />
                Profile
              </button>
              <div className="border-t border-border-default my-1" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-body text-danger hover:bg-bg-hover transition-colors"
              >
                <LogOut size={16} />
                Log Out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
