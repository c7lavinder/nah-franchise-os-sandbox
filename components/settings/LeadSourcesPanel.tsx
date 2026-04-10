"use client";

/**
 * LeadSourcesPanel — manage Lead Sources + Sub Sources in Settings.
 * CRUD against lead_sources / lead_sub_sources tables.
 */

import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Loader2, Tag } from "lucide-react";

interface SubSource {
  id: string;
  lead_source_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

interface LeadSource {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  subSources: SubSource[];
}

export default function LeadSourcesPanel() {
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newSourceName, setNewSourceName] = useState("");
  const [addingSource, setAddingSource] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);

  async function fetchSources() {
    const res = await fetch("/api/settings/lead-sources");
    if (res.ok) {
      const d = await res.json();
      setSources(d.sources ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { void fetchSources(); }, []);

  async function handleAddSource() {
    if (!newSourceName.trim()) return;
    setAddingSource(true);
    const res = await fetch("/api/settings/lead-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSourceName.trim(), sort_order: sources.length + 1 }),
    });
    if (res.ok) {
      setNewSourceName("");
      await fetchSources();
    }
    setAddingSource(false);
  }

  async function handleAddSub(sourceId: string) {
    if (!newSubName.trim()) return;
    setAddingSubFor(sourceId);
    const parent = sources.find((s) => s.id === sourceId);
    const res = await fetch("/api/settings/lead-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_source_id: sourceId,
        name: newSubName.trim(),
        sort_order: (parent?.subSources.length ?? 0) + 1,
      }),
    });
    if (res.ok) {
      setNewSubName("");
      await fetchSources();
    }
    setAddingSubFor(null);
  }

  async function handleDelete(id: string, type: "source" | "sub_source") {
    const res = await fetch("/api/settings/lead-sources", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type }),
    });
    if (res.ok) await fetchSources();
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-text-tertiary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Tag size={16} className="text-nah-blue" />
        <h3 className="text-body-sm font-semibold text-text-primary">Lead Sources</h3>
        <span className="text-caption text-text-tertiary ml-auto">{sources.length} sources</span>
      </div>

      {/* Source list */}
      <div className="space-y-1">
        {sources.map((src) => {
          const isOpen = expanded === src.id;
          return (
            <div key={src.id} className="border border-border-default rounded-lg overflow-hidden">
              {/* Source row */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-bg-secondary hover:bg-bg-hover transition-colors">
                <button onClick={() => setExpanded(isOpen ? null : src.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                  {isOpen ? <ChevronDown size={14} className="text-text-tertiary flex-shrink-0" /> : <ChevronRight size={14} className="text-text-tertiary flex-shrink-0" />}
                  <span className="text-body-sm font-medium text-text-primary truncate">{src.name}</span>
                  <span className="text-[10px] text-text-tertiary flex-shrink-0">{src.subSources.length} sub</span>
                </button>
                <button
                  onClick={() => void handleDelete(src.id, "source")}
                  className="p-1 text-text-tertiary hover:text-danger transition-colors flex-shrink-0"
                  title="Delete source"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Sub-sources */}
              {isOpen && (
                <div className="border-t border-border-default">
                  {src.subSources.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-2 pl-10 pr-4 py-2 hover:bg-bg-hover/50 transition-colors">
                      <span className="text-body-sm text-text-secondary flex-1 truncate">{sub.name}</span>
                      <button
                        onClick={() => void handleDelete(sub.id, "sub_source")}
                        className="p-1 text-text-tertiary hover:text-danger transition-colors flex-shrink-0"
                        title="Delete sub-source"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}

                  {/* Add sub-source */}
                  <div className="flex items-center gap-2 pl-10 pr-4 py-2 border-t border-border-default">
                    <input
                      value={addingSubFor === src.id ? newSubName : ""}
                      onChange={(e) => { setAddingSubFor(src.id); setNewSubName(e.target.value); }}
                      onFocus={() => setAddingSubFor(src.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleAddSub(src.id); }}
                      placeholder="Add sub-source..."
                      className="flex-1 bg-transparent text-body-sm text-text-primary placeholder:text-text-tertiary outline-none"
                    />
                    <button
                      onClick={() => void handleAddSub(src.id)}
                      disabled={addingSubFor !== src.id || !newSubName.trim()}
                      className="p-1 text-nah-blue hover:text-blue-700 disabled:opacity-30 transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add new source */}
      <div className="flex items-center gap-2 border border-dashed border-border-default rounded-lg px-4 py-2.5">
        <input
          value={newSourceName}
          onChange={(e) => setNewSourceName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleAddSource(); }}
          placeholder="New lead source name..."
          className="flex-1 bg-transparent text-body-sm text-text-primary placeholder:text-text-tertiary outline-none"
        />
        <button
          onClick={() => void handleAddSource()}
          disabled={addingSource || !newSourceName.trim()}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-nah-blue text-white text-caption font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {addingSource ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Add Source
        </button>
      </div>
    </div>
  );
}
