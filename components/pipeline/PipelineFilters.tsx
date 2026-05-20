"use client";

import { useState, useEffect } from "react";
import { Search, RefreshCw, Plus } from "lucide-react";

interface PipelineFiltersProps {
  onSearchChange: (query: string) => void;
  onStatusChange?: (status: string) => void;
  onRefresh: () => void;
  onAddProspect?: () => void;
  loading: boolean;
  currentStatus?: string;
}

export default function PipelineFilters({ onSearchChange, onRefresh, onAddProspect, loading }: PipelineFiltersProps) {
  const [searchInput, setSearchInput] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(searchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput, onSearchChange]);

  return (
    <div className="flex items-center gap-3 mb-4">
      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search journeys & territories..."
          className="w-full bg-bg-secondary border border-border-default rounded-md pl-9 pr-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-nah-orange focus:outline-none"
        />
      </div>

      {/* Refresh */}
      <button onClick={onRefresh} className="btn-ghost p-2" title="Refresh pipeline" disabled={loading}>
        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
      </button>

      {/* Add Prospect */}
      {onAddProspect && (
        <button
          onClick={onAddProspect}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-nah-orange text-white text-body-sm font-medium rounded-md hover:bg-nah-orange/90 transition-colors"
        >
          <Plus size={14} />
          Add Journey
        </button>
      )}
    </div>
  );
}
