"use client";

/**
 * MentionAutocomplete — dropdown overlay for @-mention user selection.
 * Shown when user types @ in the message composer.
 */

import { useState, useEffect, useRef } from "react";

export interface MentionUser {
  id: string;
  name: string;
}

interface MentionAutocompleteProps {
  query: string; // text after @
  users: MentionUser[];
  onSelect: (user: MentionUser) => void;
  onClose: () => void;
  anchorRect: { top: number; left: number } | null;
}

export default function MentionAutocomplete({
  query,
  users,
  onSelect,
  onClose,
  anchorRect,
}: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(query.toLowerCase())
  );

  // Reset selection when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered.length > 0) {
        e.preventDefault();
        onSelect(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filtered, selectedIndex, onSelect, onClose]);

  if (filtered.length === 0 || !anchorRect) return null;

  return (
    <div
      ref={listRef}
      className="absolute z-50 bg-bg-tertiary border border-border-default rounded-lg shadow-lg py-1 min-w-[180px] max-h-[200px] overflow-y-auto"
      style={{ bottom: "100%", left: 0, marginBottom: 4 }}
    >
      {filtered.map((user, i) => (
        <button
          key={user.id}
          onMouseDown={(e) => {
            e.preventDefault(); // Prevent textarea blur
            onSelect(user);
          }}
          className={`w-full text-left px-3 py-2 text-body-sm transition-colors ${
            i === selectedIndex
              ? "bg-nah-blue/10 text-nah-blue"
              : "text-text-primary hover:bg-bg-hover"
          }`}
        >
          {user.name}
        </button>
      ))}
    </div>
  );
}
