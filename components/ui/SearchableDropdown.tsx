"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, X, Loader2 } from "lucide-react";

export interface DropdownOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface SearchableDropdownProps {
  /** Current selected value (option id) */
  value: string | null;
  /** Display label for the current value (used when options aren't loaded yet) */
  valueLabel?: string;
  /** Called when user selects an option */
  onChange: (option: DropdownOption | null) => void;
  /** Static options — if provided, search filters locally */
  options?: DropdownOption[];
  /** Async search function — if provided, fetches options on input */
  onSearch?: (query: string) => Promise<DropdownOption[]>;
  /** Placeholder when nothing is selected */
  placeholder?: string;
  /** Label above the dropdown */
  label?: string;
  /** Debounce ms for async search (default 300) */
  debounceMs?: number;
  /** Allow clearing selection */
  clearable?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

export default function SearchableDropdown({
  value,
  valueLabel,
  onChange,
  options: staticOptions,
  onSearch,
  placeholder = "Select...",
  label,
  debounceMs = 300,
  clearable = true,
  disabled = false,
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DropdownOption[]>(staticOptions ?? []);
  const [loading, setLoading] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Derive display label
  const selectedLabel =
    valueLabel ??
    staticOptions?.find((o) => o.id === value)?.label ??
    results.find((o) => o.id === value)?.label ??
    null;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Filter static options locally
  useEffect(() => {
    if (staticOptions && !onSearch) {
      const q = query.toLowerCase().trim();
      if (!q) {
        setResults(staticOptions);
      } else {
        setResults(
          staticOptions.filter(
            (o) => o.label.toLowerCase().includes(q) || (o.sublabel && o.sublabel.toLowerCase().includes(q))
          )
        );
      }
      setHighlightIdx(0);
    }
  }, [query, staticOptions, onSearch]);

  // Async search with debounce
  const doSearch = useCallback(
    (q: string) => {
      if (!onSearch) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!q.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const r = await onSearch(q);
          setResults(r);
          setHighlightIdx(0);
        } catch {
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, debounceMs);
    },
    [onSearch, debounceMs]
  );

  function handleOpen() {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    if (staticOptions) setResults(staticOptions);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleSelect(option: DropdownOption) {
    onChange(option);
    setOpen(false);
    setQuery("");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[highlightIdx]) {
      e.preventDefault();
      handleSelect(results[highlightIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="block text-caption text-text-tertiary mb-1">{label}</label>}

      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className="w-full text-left bg-bg-primary/50 border border-border-glass rounded-md px-3 py-2 text-body-sm flex items-center gap-2 disabled:opacity-50"
      >
        <span className="flex-1 truncate">
          {selectedLabel ?? <span className="text-text-tertiary">{placeholder}</span>}
        </span>
        {clearable && value && !disabled && (
          <X size={14} className="text-text-tertiary hover:text-text-primary flex-shrink-0" onClick={handleClear} />
        )}
        <ChevronDown
          size={14}
          className={`text-text-tertiary flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-border-glass rounded-md shadow-lg max-h-64 overflow-hidden flex flex-col">
          {/* Search input */}
          <div className="px-3 py-2 border-b border-border-glass flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (onSearch) doSearch(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type to search..."
              className="flex-1 bg-transparent text-body-sm outline-none placeholder:text-text-tertiary"
            />
            {loading && <Loader2 size={14} className="text-text-tertiary animate-spin" />}
          </div>

          {/* Results */}
          <div className="overflow-y-auto flex-1">
            {results.length === 0 && !loading && (
              <div className="px-3 py-3 text-caption text-text-tertiary text-center">
                {query.trim() ? "No results" : onSearch ? "Type to search" : "No options"}
              </div>
            )}
            {results.map((option, idx) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelect(option)}
                className={`w-full text-left px-3 py-2 text-body-sm transition-colors ${
                  idx === highlightIdx ? "bg-bg-hover" : "hover:bg-bg-hover"
                } ${option.id === value ? "font-medium text-nah-blue" : ""}`}
              >
                <div className="truncate">{option.label}</div>
                {option.sublabel && <div className="text-caption text-text-tertiary truncate">{option.sublabel}</div>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
