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
  filter,
  onFilterChange,
  onRefresh,
  loading,
  unreadCount,
  searchQuery,
  onSearchChange,
}: InboxFiltersProps) {
  return (
    <div className="px-3.5 pt-3.5 pb-2.5 flex-shrink-0">
      {/* Search */}
      <div className="flex items-center gap-2 bg-[#f1f4f8] rounded-[11px] px-3 py-2.5">
        <Search size={16} className="text-[#9aa3b0] flex-shrink-0" strokeWidth={2} />
        <input
          type="text"
          placeholder="Search conversations…"
          className="bg-transparent text-sm text-[#1c2430] placeholder:text-[#9aa3b0] outline-none flex-1"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => onFilterChange("all")}
          className={`px-3.5 py-[5px] rounded-full text-[13px] font-semibold transition-colors ${
            filter === "all" ? "bg-[#0E96D8] text-white" : "text-[#7a8696] hover:text-[#1c2430]"
          }`}
        >
          All
        </button>
        <button
          onClick={() => onFilterChange("unread")}
          className={`px-3.5 py-[5px] rounded-full text-[13px] font-semibold transition-colors flex items-center gap-1.5 ${
            filter === "unread" ? "bg-[#0E96D8] text-white" : "text-[#7a8696] hover:text-[#1c2430]"
          }`}
        >
          Unread
          {unreadCount > 0 && (
            <span
              className={`min-w-[18px] h-[18px] px-1 rounded-[9px] text-[11px] font-bold flex items-center justify-center ${
                filter === "unread" ? "bg-white text-[#0E96D8]" : "bg-[#0E96D8] text-white"
              }`}
            >
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={onRefresh}
          className="ml-auto p-1 text-[#9aa3b0] hover:text-[#1c2430] transition-colors"
          disabled={loading}
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
}
