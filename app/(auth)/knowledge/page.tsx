"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BookOpen, Plus, Pencil, Trash2, Save, X, RefreshCw,
  Loader2, Search, TrendingUp, Users, Rocket, Home,
  Sparkles, Clock, FileText, ChevronRight, ArrowLeft,
  BarChart3, Target, Zap, Shield,
} from "lucide-react";
import type { KnowledgeCategory } from "@/types/database";

// ── Types ──────────────────────────────────────────────

interface KnowledgeDoc {
  id: string;
  title: string;
  category: KnowledgeCategory;
  content: string;
  is_active: boolean;
  priority: number;
  token_count: number | null;
  updated_at: string;
  seeded_from: string | null;
  retrieval_count: number | null;
  last_retrieved_at: string | null;
  flagged_as_stale: boolean;
}

// ── Pillar Definitions ──────────────────────────────────

interface Pillar {
  key: string;
  label: string;
  subtitle: string;
  icon: typeof TrendingUp;
  gradient: string;
  iconBg: string;
  borderColor: string;
  categories: { value: KnowledgeCategory; label: string }[];
}

const PILLARS: Pillar[] = [
  {
    key: "leads",
    label: "More Leads",
    subtitle: "Marketing & lead generation",
    icon: TrendingUp,
    gradient: "from-blue-500/10 to-blue-600/5",
    iconBg: "bg-blue-500",
    borderColor: "border-blue-200",
    categories: [
      { value: "marketing", label: "Marketing" },
      { value: "lead_generation", label: "Lead Generation" },
    ],
  },
  {
    key: "conversion",
    label: "Better Conversion",
    subtitle: "Sales pipeline & closing",
    icon: Target,
    gradient: "from-orange-500/10 to-orange-600/5",
    iconBg: "bg-orange-500",
    borderColor: "border-orange-200",
    categories: [
      { value: "pipeline", label: "Pipeline" },
      { value: "objections", label: "Objections" },
      { value: "fdd", label: "FDD" },
      { value: "ideal_candidate", label: "Ideal Candidate" },
      { value: "competitors", label: "Competitors" },
      { value: "conversion_playbook", label: "Conversion Playbook" },
    ],
  },
  {
    key: "onboarding",
    label: "Faster Onboarding",
    subtitle: "Setup, training & launch",
    icon: Rocket,
    gradient: "from-emerald-500/10 to-emerald-600/5",
    iconBg: "bg-emerald-500",
    borderColor: "border-emerald-200",
    categories: [
      { value: "training", label: "Training" },
      { value: "franchisee_playbook", label: "Franchisee Playbook" },
      { value: "onboarding_ops", label: "Onboarding Ops" },
    ],
  },
  {
    key: "houses",
    label: "More Houses",
    subtitle: "Coaching, deals & territory",
    icon: Home,
    gradient: "from-purple-500/10 to-purple-600/5",
    iconBg: "bg-purple-500",
    borderColor: "border-purple-200",
    categories: [
      { value: "coaching", label: "Coaching" },
      { value: "territory", label: "Territory" },
      { value: "industry", label: "Industry" },
      { value: "deal_execution", label: "Deal Execution" },
    ],
  },
];

const CROSS_CUTTING: { value: KnowledgeCategory; label: string }[] = [
  { value: "brand", label: "Brand" },
  { value: "operations", label: "Operations" },
  { value: "business_planning", label: "Business Planning" },
  { value: "governance", label: "Governance" },
  { value: "contact-notes", label: "Contact Notes" },
];

const ALL_CATEGORIES = [...PILLARS.flatMap((p) => p.categories), ...CROSS_CUTTING];

function categoryLabel(cat: KnowledgeCategory): string {
  return ALL_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

function categoryPillar(cat: KnowledgeCategory): Pillar | null {
  return PILLARS.find((p) => p.categories.some((c) => c.value === cat)) ?? null;
}

function categoryColor(cat: KnowledgeCategory): string {
  const pillar = categoryPillar(cat);
  if (pillar?.key === "leads") return "bg-blue-50 text-blue-700 border-blue-200";
  if (pillar?.key === "conversion") return "bg-orange-50 text-orange-700 border-orange-200";
  if (pillar?.key === "onboarding") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (pillar?.key === "houses") return "bg-purple-50 text-purple-700 border-purple-200";
  return "bg-gray-50 text-gray-600 border-gray-200";
}

// ── Time helpers ──────────────────────────────────────────

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function freshness(doc: KnowledgeDoc): { label: string; color: string } {
  if (doc.flagged_as_stale) return { label: "Stale", color: "text-red-500" };
  const days = Math.floor((Date.now() - new Date(doc.updated_at).getTime()) / 86400000);
  if (days <= 7) return { label: "Fresh", color: "text-emerald-500" };
  if (days <= 30) return { label: "Current", color: "text-blue-500" };
  if (days <= 90) return { label: "Aging", color: "text-amber-500" };
  return { label: "Stale", color: "text-red-500" };
}

// ── Main Component ──────────────────────────────────────

type View = "dashboard" | "pillar" | "document" | "search";

export default function KnowledgePage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("dashboard");
  const [activePillar, setActivePillar] = useState<string | null>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<KnowledgeCategory>("brand");
  const [formContent, setFormContent] = useState("");
  const [formPriority, setFormPriority] = useState(5);
  const [saving, setSaving] = useState(false);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/knowledge");
      if (res.ok) {
        const data = await res.json();
        setDocs(data.documents ?? []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchDocs(); }, [fetchDocs]);

  const activeDocs = useMemo(() => docs.filter((d) => d.is_active), [docs]);
  const activeDoc = activeDocId ? docs.find((d) => d.id === activeDocId) : null;

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return activeDocs
      .filter((d) => d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q))
      .slice(0, 20);
  }, [searchQuery, activeDocs]);

  // Pillar stats
  function pillarDocs(pillar: Pillar): KnowledgeDoc[] {
    const cats = new Set(pillar.categories.map((c) => c.value));
    return activeDocs.filter((d) => cats.has(d.category));
  }

  function pillarStats(pillar: Pillar) {
    const pDocs = pillarDocs(pillar);
    const total = pDocs.length;
    const autoExtracted = pDocs.filter((d) => d.seeded_from === "call_extraction").length;
    const curated = total - autoExtracted;
    const stale = pDocs.filter((d) => {
      const days = Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 86400000);
      return days > 90 || d.flagged_as_stale;
    }).length;
    const fresh = pDocs.filter((d) => {
      const days = Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 86400000);
      return days <= 7;
    }).length;
    return { total, autoExtracted, curated, stale, fresh };
  }

  // Form handlers
  function startEdit(doc: KnowledgeDoc) {
    setEditingId(doc.id);
    setFormTitle(doc.title);
    setFormCategory(doc.category);
    setFormContent(doc.content);
    setFormPriority(doc.priority);
    setShowAdd(false);
  }

  function startAdd(category?: KnowledgeCategory) {
    setShowAdd(true);
    setEditingId(null);
    setFormTitle("");
    setFormCategory(category ?? "brand");
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
      const method = editingId ? "PUT" : "POST";
      const body = editingId
        ? { id: editingId, title: formTitle, category: formCategory, content: formContent, priority: formPriority }
        : { title: formTitle, category: formCategory, content: formContent, priority: formPriority };
      await apiFetch("/api/knowledge", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      cancelForm();
      await fetchDocs();
    } catch { /* silent */ }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await apiFetch("/api/knowledge", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (activeDocId === id) { setActiveDocId(null); setView(activePillar ? "pillar" : "dashboard"); }
    await fetchDocs();
  }

  // Navigation
  function openPillar(key: string) { setActivePillar(key); setView("pillar"); setActiveDocId(null); }
  function openDoc(id: string) { setActiveDocId(id); setView("document"); }
  function goBack() {
    if (view === "document" && activePillar) { setView("pillar"); setActiveDocId(null); }
    else { setView("dashboard"); setActivePillar(null); setActiveDocId(null); }
  }

  // ── Render ──────────────────────────────────────────

  if (loading && docs.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* ═══ TOP BAR ═══ */}
      <div className="flex items-center gap-3 mb-6">
        {view !== "dashboard" && (
          <button onClick={goBack} className="btn-ghost p-1.5">
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-nah-blue to-nah-blue/70 flex items-center justify-center">
            <BookOpen size={16} className="text-white" />
          </div>
          <div>
            <h1 className="font-headline text-page-title text-text-primary leading-tight">
              {view === "dashboard" ? "Knowledge Base" : view === "pillar" ? PILLARS.find((p) => p.key === activePillar)?.label : view === "search" ? "Search Results" : activeDoc?.title ?? "Document"}
            </h1>
            {view === "dashboard" && (
              <p className="text-[11px] text-text-tertiary">{activeDocs.length} documents powering Scout across 4 growth pillars</p>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if (e.target.value.trim()) setView("search"); else if (view === "search") setView("dashboard"); }}
              placeholder="Search knowledge..."
              className="bg-bg-secondary border border-border-default rounded-lg pl-8 pr-3 py-1.5 text-body-sm text-text-primary placeholder:text-text-tertiary w-56 focus:ring-1 focus:ring-nah-blue/30 focus:border-nah-blue/30"
            />
          </div>
          <button onClick={() => void fetchDocs()} className="btn-ghost p-1.5" disabled={loading}>
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => startAdd()} className="btn-primary text-caption px-3 py-1.5 flex items-center gap-1">
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {/* ═══ ADD/EDIT FORM (overlay) ═══ */}
      {(showAdd || editingId) && (
        <div className="mb-6 p-5 bg-white border border-border-default rounded-xl shadow-sm">
          <h3 className="text-[15px] font-semibold text-text-primary mb-4">
            {editingId ? "Edit Document" : "New Document"}
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input type="text" placeholder="Document title..." className="input text-body-sm col-span-2" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
              <select className="input text-body-sm" value={formCategory} onChange={(e) => setFormCategory(e.target.value as KnowledgeCategory)}>
                {PILLARS.map((p) => (
                  <optgroup key={p.key} label={p.label}>
                    {p.categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </optgroup>
                ))}
                <optgroup label="Cross-cutting">
                  {CROSS_CUTTING.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </optgroup>
              </select>
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-text-tertiary whitespace-nowrap">Priority</label>
                <input type="number" min={1} max={10} className="input text-body-sm w-16" value={formPriority} onChange={(e) => setFormPriority(parseInt(e.target.value) || 5)} />
              </div>
            </div>
            <textarea placeholder="Document content — this powers Scout's intelligence..." className="input text-body-sm w-full h-48 resize-y font-mono" value={formContent} onChange={(e) => setFormContent(e.target.value)} />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-tertiary">~{Math.ceil(formContent.length / 4)} tokens</span>
              <div className="flex gap-2">
                <button onClick={cancelForm} className="px-3 py-1.5 text-caption text-text-tertiary hover:text-text-primary rounded-lg transition-colors">Cancel</button>
                <button onClick={() => void handleSave()} disabled={!formTitle || !formContent || saving} className="btn-primary text-caption px-4 py-1.5 flex items-center gap-1">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {editingId ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DASHBOARD VIEW ═══ */}
      {view === "dashboard" && (
        <div className="space-y-6">
          {/* Pillar Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PILLARS.map((pillar) => {
              const stats = pillarStats(pillar);
              const Icon = pillar.icon;
              return (
                <button
                  key={pillar.key}
                  onClick={() => openPillar(pillar.key)}
                  className={`group relative overflow-hidden rounded-xl border ${pillar.borderColor} bg-gradient-to-br ${pillar.gradient} p-5 text-left transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99]`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl ${pillar.iconBg} flex items-center justify-center shadow-sm`}>
                      <Icon size={20} className="text-white" />
                    </div>
                    <ChevronRight size={16} className="text-text-tertiary group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <h3 className="text-[15px] font-bold text-text-primary mb-0.5">{pillar.label}</h3>
                  <p className="text-[11px] text-text-tertiary mb-4">{pillar.subtitle}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="text-[18px] font-bold text-text-primary">{stats.total}</div>
                      <div className="text-[9px] uppercase tracking-wider text-text-tertiary font-medium">Docs</div>
                    </div>
                    <div>
                      <div className="text-[18px] font-bold text-emerald-600">{stats.fresh}</div>
                      <div className="text-[9px] uppercase tracking-wider text-text-tertiary font-medium">Fresh</div>
                    </div>
                    <div>
                      <div className="text-[18px] font-bold text-scout-purple">{stats.autoExtracted}</div>
                      <div className="text-[9px] uppercase tracking-wider text-text-tertiary font-medium">AI</div>
                    </div>
                  </div>
                  {stats.stale > 0 && (
                    <div className="mt-3 px-2 py-1 rounded-md bg-red-50 border border-red-100 text-[10px] font-medium text-red-600">
                      {stats.stale} stale — needs review
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Cross-cutting + Stats Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Cross-cutting docs */}
            <div className="lg:col-span-2 rounded-xl border border-border-default bg-white p-5">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={16} className="text-text-secondary" />
                <h3 className="text-[13px] font-semibold text-text-primary">Cross-cutting</h3>
                <span className="text-[10px] text-text-tertiary">Brand, Operations, Planning, Governance</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CROSS_CUTTING.map((cat) => {
                  const catDocs = activeDocs.filter((d) => d.category === cat.value);
                  return (
                    <button
                      key={cat.value}
                      onClick={() => { setActivePillar(null); setView("pillar"); /* reuse pillar view filtered by cross-cutting */ }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border-default hover:bg-bg-hover transition-colors text-left"
                    >
                      <FileText size={14} className="text-text-tertiary" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-text-primary">{cat.label}</div>
                        <div className="text-[10px] text-text-tertiary">{catDocs.length} docs</div>
                      </div>
                      {catDocs.length > 0 && (
                        <span className={`text-[10px] font-medium ${freshness(catDocs[0]).color}`}>
                          {timeAgo(catDocs[0].updated_at)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* KB Health Stats */}
            <div className="rounded-xl border border-border-default bg-white p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={16} className="text-text-secondary" />
                <h3 className="text-[13px] font-semibold text-text-primary">KB Health</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-text-secondary">Total Documents</span>
                  <span className="text-[15px] font-bold text-text-primary">{activeDocs.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-text-secondary">AI-Generated</span>
                  <span className="text-[15px] font-bold text-scout-purple">{activeDocs.filter((d) => d.seeded_from === "call_extraction").length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-text-secondary">Human-Curated</span>
                  <span className="text-[15px] font-bold text-nah-blue">{activeDocs.filter((d) => d.seeded_from !== "call_extraction").length}</span>
                </div>
                <div className="border-t border-border-default pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-text-secondary">Fresh (7d)</span>
                    <span className="text-[15px] font-bold text-emerald-600">
                      {activeDocs.filter((d) => (Date.now() - new Date(d.updated_at).getTime()) < 604800000).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[12px] text-red-500">Needs Review (90d+)</span>
                    <span className="text-[15px] font-bold text-red-500">
                      {activeDocs.filter((d) => (Date.now() - new Date(d.updated_at).getTime()) > 7776000000).length}
                    </span>
                  </div>
                </div>
                <div className="border-t border-border-default pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-text-secondary">Most Retrieved</span>
                    <span className="text-[11px] text-text-tertiary truncate max-w-[140px]">
                      {activeDocs.sort((a, b) => (b.retrieval_count ?? 0) - (a.retrieval_count ?? 0))[0]?.title ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recently Updated */}
          <div className="rounded-xl border border-border-default bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={16} className="text-text-secondary" />
              <h3 className="text-[13px] font-semibold text-text-primary">Recently Updated</h3>
              <span className="text-[10px] text-text-tertiary">Latest intelligence from calls</span>
            </div>
            <div className="space-y-1">
              {activeDocs
                .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                .slice(0, 8)
                .map((doc) => {
                  const fresh = freshness(doc);
                  return (
                    <button
                      key={doc.id}
                      onClick={() => openDoc(doc.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors text-left"
                    >
                      {doc.seeded_from === "call_extraction" ? (
                        <Sparkles size={13} className="text-scout-purple flex-shrink-0" />
                      ) : (
                        <FileText size={13} className="text-text-tertiary flex-shrink-0" />
                      )}
                      <span className="text-[12px] font-medium text-text-primary flex-1 truncate">{doc.title}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${categoryColor(doc.category)}`}>
                        {categoryLabel(doc.category)}
                      </span>
                      <span className={`text-[10px] font-medium ${fresh.color} w-14 text-right`}>{timeAgo(doc.updated_at)}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ PILLAR VIEW ═══ */}
      {view === "pillar" && activePillar && (() => {
        const pillar = PILLARS.find((p) => p.key === activePillar);
        if (!pillar) return null;
        const pDocs = pillarDocs(pillar);
        const Icon = pillar.icon;

        return (
          <div className="space-y-4">
            {/* Pillar Header */}
            <div className={`rounded-xl border ${pillar.borderColor} bg-gradient-to-r ${pillar.gradient} p-5 flex items-center gap-4`}>
              <div className={`w-12 h-12 rounded-xl ${pillar.iconBg} flex items-center justify-center shadow-sm`}>
                <Icon size={24} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-[17px] font-bold text-text-primary">{pillar.label}</h2>
                <p className="text-[12px] text-text-tertiary">{pillar.subtitle} — {pDocs.length} documents</p>
              </div>
              <button onClick={() => startAdd(pillar.categories[0]?.value)} className="btn-primary text-caption px-3 py-1.5 flex items-center gap-1">
                <Plus size={14} /> Add to {pillar.label}
              </button>
            </div>

            {/* Category Sections */}
            {pillar.categories.map((cat) => {
              const catDocs = pDocs.filter((d) => d.category === cat.value).sort((a, b) => b.priority - a.priority);
              return (
                <div key={cat.value} className="rounded-xl border border-border-default bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b border-border-default bg-bg-secondary/50 flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${categoryColor(cat.value)}`}>
                      {cat.label}
                    </span>
                    <span className="text-[11px] text-text-tertiary">{catDocs.length} docs</span>
                  </div>
                  {catDocs.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-[12px] text-text-tertiary">No documents yet. Scout will auto-populate from calls, or add one manually.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border-default">
                      {catDocs.map((doc) => {
                        const fr = freshness(doc);
                        return (
                          <button
                            key={doc.id}
                            onClick={() => openDoc(doc.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-colors text-left"
                          >
                            {doc.seeded_from === "call_extraction" ? (
                              <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                                <Sparkles size={13} className="text-scout-purple" />
                              </div>
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                <FileText size={13} className="text-nah-blue" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-medium text-text-primary truncate">{doc.title}</div>
                              <div className="text-[10px] text-text-tertiary mt-0.5">
                                {doc.content.slice(0, 120).replace(/[#*_]/g, "")}...
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                              <span className={`text-[10px] font-medium ${fr.color}`}>{fr.label}</span>
                              <span className="text-[9px] text-text-tertiary">{timeAgo(doc.updated_at)}</span>
                            </div>
                            <ChevronRight size={14} className="text-text-tertiary flex-shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ═══ DOCUMENT VIEW ═══ */}
      {view === "document" && activeDoc && (
        <div className="space-y-4">
          {/* Document Header */}
          <div className="rounded-xl border border-border-default bg-white p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${categoryColor(activeDoc.category)}`}>
                    {categoryLabel(activeDoc.category)}
                  </span>
                  {activeDoc.seeded_from === "call_extraction" && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-scout-purple border border-purple-200 flex items-center gap-0.5">
                      <Sparkles size={9} /> AI-Generated
                    </span>
                  )}
                  <span className={`text-[10px] font-medium ${freshness(activeDoc).color}`}>
                    {freshness(activeDoc).label} — updated {timeAgo(activeDoc.updated_at)}
                  </span>
                </div>
                <h2 className="text-[17px] font-bold text-text-primary">{activeDoc.title}</h2>
              </div>
              <div className="flex items-center gap-1.5 ml-4">
                <button onClick={() => startEdit(activeDoc)} className="px-2.5 py-1 text-[11px] font-medium text-nah-blue hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1">
                  <Pencil size={12} /> Edit
                </button>
                <button onClick={() => void handleDelete(activeDoc.id)} className="px-2.5 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1">
                  <Trash2 size={12} /> Archive
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-text-tertiary">
              <span>Priority: {activeDoc.priority}/10</span>
              <span>{activeDoc.token_count ?? 0} tokens</span>
              {activeDoc.retrieval_count ? <span>Retrieved {activeDoc.retrieval_count}x by Scout</span> : null}
              {activeDoc.last_retrieved_at ? <span>Last used {timeAgo(activeDoc.last_retrieved_at)}</span> : null}
            </div>
          </div>

          {/* Document Content */}
          <div className="rounded-xl border border-border-default bg-white p-6">
            <div className="prose prose-sm max-w-none">
              {activeDoc.content.split("\n").map((line, i) => {
                if (line.startsWith("# ")) return <h1 key={i} className="text-[18px] font-bold text-text-primary mt-4 mb-2">{line.slice(2)}</h1>;
                if (line.startsWith("## ")) return <h2 key={i} className="text-[15px] font-bold text-text-primary mt-4 mb-1.5">{line.slice(3)}</h2>;
                if (line.startsWith("### ")) return <h3 key={i} className="text-[13px] font-semibold text-text-primary mt-3 mb-1">{line.slice(4)}</h3>;
                if (line.startsWith("- **")) {
                  const match = line.match(/^- \*\*(.+?)\*\*\s*[—–-]?\s*(.*)/);
                  if (match) return <div key={i} className="flex gap-2 py-0.5 pl-3"><span className="text-[12px] font-semibold text-text-primary">{match[1]}</span><span className="text-[12px] text-text-secondary">{match[2]}</span></div>;
                }
                if (line.startsWith("- [ ] ")) return <div key={i} className="flex items-center gap-2 py-0.5 pl-3"><div className="w-3.5 h-3.5 rounded border border-border-default" /><span className="text-[12px] text-text-secondary">{line.slice(6)}</span></div>;
                if (line.startsWith("- [x] ") || line.startsWith("- [X] ")) return <div key={i} className="flex items-center gap-2 py-0.5 pl-3"><div className="w-3.5 h-3.5 rounded bg-emerald-500 flex items-center justify-center"><Zap size={8} className="text-white" /></div><span className="text-[12px] text-text-secondary line-through">{line.slice(6)}</span></div>;
                if (line.startsWith("- ")) return <div key={i} className="flex gap-2 py-0.5 pl-3"><span className="text-text-tertiary">-</span><span className="text-[12px] text-text-secondary">{line.slice(2)}</span></div>;
                if (line.startsWith("> ")) return <div key={i} className="border-l-2 border-scout-purple/30 pl-3 py-0.5 my-1"><span className="text-[12px] italic text-text-tertiary">{line.slice(2)}</span></div>;
                if (line.startsWith("_") && line.endsWith("_")) return <p key={i} className="text-[11px] italic text-text-tertiary my-1">{line.slice(1, -1)}</p>;
                if (line.startsWith("---")) return <hr key={i} className="my-3 border-border-default" />;
                if (line.startsWith("|")) return <div key={i} className="text-[11px] text-text-secondary font-mono bg-bg-secondary/50 px-2 py-0.5 rounded">{line}</div>;
                if (line.trim() === "") return <div key={i} className="h-2" />;
                return <p key={i} className="text-[12px] text-text-secondary leading-relaxed">{line}</p>;
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SEARCH VIEW ═══ */}
      {view === "search" && (
        <div className="space-y-2">
          {searchResults.length === 0 && searchQuery.trim() && (
            <div className="text-center py-12">
              <Search size={32} className="text-text-tertiary mx-auto mb-3" />
              <p className="text-body-sm text-text-tertiary">No results for &ldquo;{searchQuery}&rdquo;</p>
            </div>
          )}
          {searchResults.map((doc) => {
            const fr = freshness(doc);
            // Find matching snippet
            const q = searchQuery.toLowerCase();
            const idx = doc.content.toLowerCase().indexOf(q);
            const snippet = idx >= 0
              ? "..." + doc.content.slice(Math.max(0, idx - 40), idx + q.length + 80).replace(/[#*_]/g, "") + "..."
              : doc.content.slice(0, 150).replace(/[#*_]/g, "") + "...";

            return (
              <button
                key={doc.id}
                onClick={() => openDoc(doc.id)}
                className="w-full rounded-xl border border-border-default bg-white p-4 hover:shadow-sm transition-all text-left"
              >
                <div className="flex items-start gap-3">
                  {doc.seeded_from === "call_extraction" ? (
                    <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles size={14} className="text-scout-purple" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FileText size={14} className="text-nah-blue" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-semibold text-text-primary">{doc.title}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${categoryColor(doc.category)}`}>
                        {categoryLabel(doc.category)}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-tertiary leading-relaxed">{snippet}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span className={`text-[10px] font-medium ${fr.color}`}>{fr.label}</span>
                    <span className="text-[9px] text-text-tertiary">{timeAgo(doc.updated_at)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
