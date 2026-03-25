"use client";

import { RefreshCw } from "lucide-react";

interface InboxFiltersProps {
  filter: "all" | "unread";
  onFilterChange: (filter: "all" | "unread") => void;
  onRefresh: () => void;
  loading: boolean;
  unreadCount: number;
}

export default function InboxFilters({ filter, onFilterChange, onRefresh, loading, unreadCount }: InboxFiltersProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border-default flex-shrink-0">
      <button
        onClick={() => onFilterChange("all")}
        className={`px-2.5 py-1 rounded-md text-caption font-medium transition-colors ${
          filter === "all" ? "bg-nah-orange text-white" : "text-text-tertiary hover:text-text-primary"
        }`}
      >
        All
      </button>
      <button
        onClick={() => onFilterChange("unread")}
        className={`px-2.5 py-1 rounded-md text-caption font-medium transition-colors flex items-center gap-1 ${
          filter === "unread" ? "bg-nah-orange text-white" : "text-text-tertiary hover:text-text-primary"
        }`}
      >
        Unread
        {unreadCount > 0 && (
          <span className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${
            filter === "unread" ? "bg-white text-nah-orange" : "bg-nah-orange text-white"
          }`}>
            {unreadCount}
          </span>
        )}
      </button>
      <button
        onClick={onRefresh}
        className="btn-ghost p-1 ml-auto"
        disabled={loading}
      >
        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
      </button>
    </div>
  );
}
