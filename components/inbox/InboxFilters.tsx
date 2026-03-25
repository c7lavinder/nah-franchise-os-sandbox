"use client";

import { RefreshCw, Search } from "lucide-react";

interface InboxFiltersProps {
  filter: "all" | "unread";
  onFilterChange: (filter: "all" | "unread") => void;
  onRefresh: () => void;
  loading: boolean;
  unreadCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function InboxFilters({
  filter, onFilterChange, onRefresh, loading, unreadCount, searchQuery, onSearchChange,
}: InboxFiltersProps) {
  return (
    <div className="border-b border-border-default flex-shrink-0">
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-default">
        <Search size={14} className="text-text-tertiary flex-shrink-0" />
        <input
          type="text"
          placeholder="Search conversations..."
          className="bg-transparent text-body-sm text-text-primary placeholder:text-text-tertiary outline-none flex-1"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-3 py-2">
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
    </div>
  );
}
