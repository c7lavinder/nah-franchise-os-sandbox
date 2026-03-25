"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookOpen, Plus, Pencil, Trash2, Save, X, RefreshCw,
  Loader2, ChevronDown, ChevronRight,
} from "lucide-react";
import type { KnowledgeCategory } from "@/types/database";

interface KnowledgeDoc {
  id: string;
  title: string;
  category: KnowledgeCategory;
  content: string;
  is_active: boolean;
  priority: number;
  token_count: number | null;
  updated_at: string;
}

const CATEGORIES: { value: KnowledgeCategory; label: string; color: string }[] = [
  { value: "brand", label: "Brand", color: "bg-nah-orange/15 text-nah-orange" },
  { value: "pipeline", label: "Pipeline", color: "bg-info/15 text-info" },
  { value: "objections", label: "Objections", color: "bg-warning/15 text-warning" },
  { value: "competitors", label: "Competitors", color: "bg-danger/15 text-danger" },
  { value: "industry", label: "Industry", color: "bg-success/15 text-success" },
  { value: "fdd", label: "FDD", color: "bg-scout-purple/15 text-scout-purple" },
  { value: "contact-notes", label: "Contact Notes", color: "bg-bg-tertiary text-text-tertiary" },
];

function categoryBadge(cat: KnowledgeCategory): string {
  return CATEGORIES.find((c) => c.value === cat)?.color ?? "bg-bg-tertiary text-text-tertiary";
}

function categoryLabel(cat: KnowledgeCategory): string {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

export default function KnowledgePage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [filterCat, setFilterCat] = useState<KnowledgeCategory | "all">("all");
  const [showInactive, setShowInactive] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<KnowledgeCategory>("brand");
  const [formContent, setFormContent] = useState("");
  const [formPriority, setFormPriority] = useState(5);
  const [saving, setSaving] = useState(false);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/knowledge");
      if (res.ok) {
        const data = await res.json();
        setDocs(data.documents ?? []);
      }
    } catch {
      // Keep current state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDocs();
  }, [fetchDocs]);

  const filtered = docs.filter((d) => {
    if (!showInactive && !d.is_active) return false;
    if (filterCat !== "all" && d.category !== filterCat) return false;
    return true;
  });

  function startEdit(doc: KnowledgeDoc) {
    setEditingId(doc.id);
    setFormTitle(doc.title);
    setFormCategory(doc.category);
    setFormContent(doc.content);
    setFormPriority(doc.priority);
    setShowAdd(false);
  }

  function startAdd() {
    setShowAdd(true);
    setEditingId(null);
    setFormTitle("");
    setFormCategory("brand");
    setFormContent("");
    setFormPriority(5);
  }

  function cancelForm() {
    setShowAdd(false);
    setEditingId(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId) {
        // Update
        await fetch("/api/knowledge", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingId,
            title: formTitle,
            category: formCategory,
            content: formContent,
            priority: formPriority,
          }),
        });
      } else {
        // Create
        await fetch("/api/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formTitle,
            category: formCategory,
            content: formContent,
            priority: formPriority,
          }),
        });
      }
      cancelForm();
      await fetchDocs();
    } catch {
      // Keep form open on error
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch("/api/knowledge", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await fetchDocs();
  }

  async function handleReactivate(id: string) {
    await fetch("/api/knowledge", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: true }),
    });
    await fetchDocs();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-1 py-3 flex-shrink-0">
        <BookOpen size={20} className="text-nah-blue" />
        <h1 className="font-headline text-page-title text-text-primary">Knowledge Base</h1>
        <span className="text-caption text-text-tertiary ml-1">
          {filtered.length} {filtered.length === 1 ? "document" : "documents"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => void fetchDocs()}
            className="btn-ghost p-1.5"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={startAdd} className="btn-primary text-caption px-3 py-1.5">
            <Plus size={14} className="mr-1 inline" />
            Add Document
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-1 pb-3 flex-shrink-0 flex-wrap">
        <button
          onClick={() => setFilterCat("all")}
          className={`px-2.5 py-1 rounded-md text-caption font-medium transition-colors ${
            filterCat === "all"
              ? "bg-nah-orange text-white"
              : "text-text-tertiary hover:text-text-primary bg-bg-secondary border border-border-default"
          }`}
        >
          All
        </button>
        {CATEGORIES.filter((c) => c.value !== "contact-notes").map((cat) => (
          <button
            key={cat.value}
            onClick={() => setFilterCat(cat.value)}
            className={`px-2.5 py-1 rounded-md text-caption font-medium transition-colors ${
              filterCat === cat.value
                ? "bg-nah-orange text-white"
                : "text-text-tertiary hover:text-text-primary bg-bg-secondary border border-border-default"
            }`}
          >
            {cat.label}
          </button>
        ))}
        <label className="flex items-center gap-1.5 ml-4 text-caption text-text-tertiary cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-border-default"
          />
          Show inactive
        </label>
      </div>

      {/* Add/Edit Form */}
      {(showAdd || editingId) && (
        <div className="mx-1 mb-3 p-4 bg-bg-secondary border border-border-default rounded-lg flex-shrink-0">
          <h3 className="text-h3 text-text-primary mb-3">
            {editingId ? "Edit Document" : "New Document"}
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Document title..."
                className="input text-body-sm col-span-2"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
              <select
                className="input text-body-sm"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as KnowledgeCategory)}
              >
                {CATEGORIES.filter((c) => c.value !== "contact-notes").map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <textarea
              placeholder="Document content — this will be injected into Scout's knowledge..."
              className="input text-body-sm w-full h-40 resize-y"
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
            />
            <div className="flex items-center gap-4">
              <label className="text-caption text-text-tertiary">
                Priority (1-10):
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="input text-body-sm w-16 ml-2"
                  value={formPriority}
                  onChange={(e) => setFormPriority(parseInt(e.target.value) || 5)}
                />
              </label>
              <span className="text-caption text-text-tertiary">
                ~{Math.ceil(formContent.length / 4)} tokens
              </span>
              <div className="ml-auto flex gap-2">
                <button onClick={cancelForm} className="btn-ghost text-caption px-3 py-1.5">
                  <X size={14} className="mr-1 inline" />
                  Cancel
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={!formTitle || !formContent || saving}
                  className="btn-primary text-caption px-3 py-1.5"
                >
                  {saving ? (
                    <Loader2 size={14} className="mr-1 inline animate-spin" />
                  ) : (
                    <Save size={14} className="mr-1 inline" />
                  )}
                  {editingId ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document List */}
      <div className="flex-1 border border-border-default rounded-lg overflow-hidden min-h-0">
        <div className="h-full overflow-y-auto">
          {loading && docs.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-text-tertiary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <BookOpen size={32} className="text-text-tertiary mb-3" />
              <p className="text-body-sm text-text-tertiary">No documents found</p>
            </div>
          ) : (
            filtered.map((doc) => (
              <div
                key={doc.id}
                className={`border-b border-border-default ${!doc.is_active ? "opacity-50" : ""}`}
              >
                {/* Row */}
                <div
                  onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-bg-hover transition-colors"
                >
                  {expandedId === doc.id ? (
                    <ChevronDown size={14} className="text-text-tertiary flex-shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-text-tertiary flex-shrink-0" />
                  )}
                  <span className="text-body-sm font-medium text-text-primary flex-1 truncate">
                    {doc.title}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${categoryBadge(doc.category)}`}>
                    {categoryLabel(doc.category)}
                  </span>
                  <span className="text-caption text-text-tertiary w-16 text-right">
                    P{doc.priority}
                  </span>
                  <span className="text-caption text-text-tertiary w-20 text-right">
                    {doc.token_count ? `${doc.token_count}t` : "—"}
                  </span>
                  <div className="flex gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => startEdit(doc)}
                      className="btn-ghost p-1"
                      title="Edit"
                    >
                      <Pencil size={13} className="text-text-tertiary" />
                    </button>
                    {doc.is_active ? (
                      <button
                        onClick={() => void handleDelete(doc.id)}
                        className="btn-ghost p-1"
                        title="Deactivate"
                      >
                        <Trash2 size={13} className="text-danger" />
                      </button>
                    ) : (
                      <button
                        onClick={() => void handleReactivate(doc.id)}
                        className="btn-ghost p-1 text-caption text-success"
                        title="Reactivate"
                      >
                        Activate
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded content */}
                {expandedId === doc.id && (
                  <div className="px-4 pb-4 pl-10">
                    <div className="bg-bg-primary/50 border border-border-default rounded-lg p-3">
                      <pre className="text-body-sm text-text-secondary whitespace-pre-wrap font-sans">
                        {doc.content}
                      </pre>
                    </div>
                    <p className="text-caption text-text-tertiary mt-2">
                      Last updated: {new Date(doc.updated_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
