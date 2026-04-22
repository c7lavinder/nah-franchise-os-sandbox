"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Phone, Mail, Loader2, RefreshCw,
  MessageSquare, Save, Award, ClipboardList, Calendar, User,
} from "lucide-react";
import { SMSPanel, EmailPanel, CallPanel, SchedulePanel } from "@/components/contact/ActionPanels";
import { ProfileSection } from "@/components/profile";
import { PROFILE_FIELDS, getSortedCategories } from "@/lib/profile/field-registry";
import type { FieldCategory } from "@/lib/profile/field-registry";
import type { GHLContact, GHLNote, GHLTask, GHLMessage } from "@/types/ghl";
import { NotesSection, TaskList } from "@/components/leads";
import MessagesTab from "@/components/contact/MessagesTab";
import PipelineBar from "@/components/contact/PipelineBar";
import StageDrilldownInline from "@/components/contact/StageDrilldownInline";
import { TerritoryDetailsCard, DealDetailsCard } from "@/components/contact/TerritoryDealCards";
import RelatedPeopleCard from "@/components/contact/RelatedPeopleCard";
import TeamCard from "@/components/contact/TeamCard";
import TerritoryOwnershipSection from "@/components/contact/TerritoryOwnershipSection";
import TerritoryDataTab from "@/components/contact/TerritoryDataTab";
import JourneyEosTab from "@/components/leads/tabs/JourneyEosTab";
import SplitJourneyModal from "@/components/leads/SplitJourneyModal";
import type { SplitTerritory } from "@/components/leads/SplitJourneyModal";
import AddJourneyMemberModal from "@/components/leads/AddJourneyMemberModal";
import { capitalizeName } from "@/lib/format/contact";
import { useToast } from "@/components/ui/Toast";
import type { SubTaskLog, StageHistoryEntry } from "@/lib/contacts/pipeline-state";
import { Pencil, GitBranch, UserPlus } from "lucide-react";

const CATEGORIES: FieldCategory[] = getSortedCategories();

function EditableInfoField({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [edited, setEdited] = useState(false);

  if (!editing) {
    return (
      <div>
        <span className="text-text-tertiary block text-[10px]">{label}</span>
        <p className="text-text-primary flex items-center gap-1 cursor-pointer hover:text-nah-blue" onClick={() => { setEditing(true); setDraft(value); }}>
          {value || "—"}
          {edited && <Pencil size={10} className="text-nah-orange flex-shrink-0" />}
        </p>
      </div>
    );
  }

  return (
    <div>
      <span className="text-text-tertiary block text-[10px]">{label}</span>
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft !== value) { void onSave(draft); setEdited(true); } }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { setEditing(false); if (draft !== value) { void onSave(draft); setEdited(true); } }
          if (e.key === "Escape") { setEditing(false); setDraft(value); }
        }}
        className="w-full bg-bg-secondary border border-nah-blue rounded px-2 py-0.5 text-body-sm text-text-primary outline-none"
      />
    </div>
  );
}

interface PipelineStateAPI {
  id: string; contact_id: string; pipeline_id: string; current_stage_id: string;
  current_sub_task_id: string | null; current_sub_task_started_at: string | null;
  entered_current_stage_at: string; pipeline_name: string; pipeline_slug: string;
  stages: {
    id: string; slug: string; name: string; sort_order: number; is_terminal: boolean; pipeline_id: string;
    subTasks: { id: string; slug: string; name: string; sort_order: number; state_type: "single" | "two_state"; first_state_label: string | null; second_state_label: string | null; default_logger_type: string; default_logger_user_id: string | null; is_required: boolean; stage_id: string }[];
    logsBySubTask: Record<string, SubTaskLog[]>; totalLogs: number;
  }[];
  stageHistory: StageHistoryEntry[];
  territories?: {
    ms_slug: string; territory_name: string; stage_id: string; stage_name: string;
    jps_id: string; entered_current_stage_at: string;
    current_sub_task_id: string | null; current_sub_task_started_at: string | null;
  }[];
}

interface LocalContact {
  legal_entity: string | null; website: string | null;
  franchise_fee: number | null; royalty_pct: number | null; term_months: number | null;
  opportunity_source: string | null; sub_source: string | null;
  first_name: string | null; last_name: string | null; email: string | null; phone: string | null;
  city: string | null; state: string | null;
}

export interface JourneyMember {
  contact_id: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
  phone?: string | null;
  is_primary: boolean;
}

interface LeadDetailViewProps {
  contactId: string;
  journeyId?: string;
  /** Local UUID of the journey's primary contact. LeadDetailView compares in
   *  local-UUID space for "is the currently-viewed profile the primary or an
   *  alt member?", so we need this separate from the GHL-id `contactId`. */
  primaryLocalContactId?: string | null;
  /** Human-readable journey name (e.g. "Ryan Decker + Shannon Smylie").
   *  Used in the page header for partnerships; solo journeys fall back to
   *  the contact's GHL name. */
  journeyName?: string | null;
  initialTerritorySlug?: string | null;
  highlightMessageId?: string | null;
  members?: JourneyMember[];
}

export default function LeadDetailView({
  contactId,
  journeyId,
  primaryLocalContactId,
  journeyName,
  initialTerritorySlug,
  highlightMessageId,
  members = [],
}: LeadDetailViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [contact, setContact] = useState<GHLContact | null>(null);
  const [localContact, setLocalContact] = useState<LocalContact | null>(null);
  const [notes, setNotes] = useState<GHLNote[]>([]);
  const [tasks, setTasks] = useState<GHLTask[]>([]);
  const [messages, setMessages] = useState<GHLMessage[]>([]);
  const [profileValues, setProfileValues] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"overview" | "messages" | "profile" | "territories" | "eos">(
    highlightMessageId ? "messages" : "overview"
  );
  const [contactCalls, setContactCalls] = useState<{ id: string; callTypeName: string | null; hostName: string | null; scheduled_at: string | null; status: string; grade: string | null; duration_seconds: number | null }[]>([]);
  const [pipelineStates, setPipelineStates] = useState<PipelineStateAPI[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [drilldownStageId, setDrilldownStageId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"sms" | "email" | "call" | "schedule" | null>(null);
  const [focusedTerritorySlug, setFocusedTerritorySlug] = useState<string | null>(initialTerritorySlug ?? null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  // Keep the URL's ?territory= param in sync with the focused territory so
  // sharing the page or using back/forward preserves the selection. Browser
  // URL updates only when the slug actually changes — avoids a replace loop.
  useEffect(() => {
    if (!pathname) return;
    const currentSlug = searchParams?.get("territory") ?? null;
    if (currentSlug === focusedTerritorySlug) return;
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    if (focusedTerritorySlug) next.set("territory", focusedTerritorySlug);
    else next.delete("territory");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [focusedTerritorySlug, pathname, router, searchParams]);

  // Profile tab supports editing any journey member. Defaults to the journey
  // primary (local UUID) and swaps when the user clicks a sub-tab. We track
  // in local-UUID space so member comparisons are consistent; the API routes
  // already accept either form when we PATCH against profileContactId.
  const effectivePrimaryLocalId = primaryLocalContactId ?? contactId;
  const [profileContactId, setProfileContactId] = useState<string>(effectivePrimaryLocalId);
  const [profileContactData, setProfileContactData] = useState<LocalContact | null>(null);
  const [profileSavingKey, setProfileSavingKey] = useState<string | null>(null);

  // Keep internal profile contact in sync when the outer prop changes.
  useEffect(() => { setProfileContactId(effectivePrimaryLocalId); }, [effectivePrimaryLocalId]);

  const isAltContact = profileContactId !== effectivePrimaryLocalId;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [contactRes, profileRes, pipelineStateRes, callsRes] = await Promise.all([
        fetch(`/api/contacts/${contactId}`).catch(() => null),
        fetch(`/api/contacts/${contactId}/profile`).catch(() => null),
        fetch(`/api/contacts/${contactId}/pipeline-state`).catch(() => null),
        fetch(`/api/calls/list?contact_id=${contactId}&limit=20`).catch(() => null),
      ]);

      if (callsRes?.ok) { const d = await callsRes.json(); setContactCalls(d.calls ?? []); }
      if (contactRes?.ok) {
        const d = await contactRes.json();
        setContact(d.contact ?? null);
        setNotes(d.notes ?? []);
        setTasks(d.tasks ?? []);
        setMessages(d.messages ?? []);
      }

      if (pipelineStateRes?.ok) {
        const psData = await pipelineStateRes.json();
        const states = psData.pipelineStates ?? [];
        setPipelineStates(states);
        if (states.length > 0 && !selectedPipelineId) setSelectedPipelineId(states[0].id);

        if (psData.contact) {
          setLocalContact({
            first_name: psData.contact.first_name, last_name: psData.contact.last_name,
            email: psData.contact.email, phone: psData.contact.phone,
            city: psData.contact.city, state: psData.contact.state,
            opportunity_source: psData.contact.opportunity_source, sub_source: psData.contact.sub_source,
            legal_entity: psData.contact.legal_entity, website: psData.contact.website,
            franchise_fee: psData.contact.franchise_fee, royalty_pct: psData.contact.royalty_pct,
            term_months: psData.contact.term_months,
          });
          if (!contactRes?.ok) {
            setContact({
              id: psData.contact.ghl_contact_id ?? contactId, locationId: "",
              firstName: psData.contact.first_name ?? "", lastName: psData.contact.last_name ?? "",
              email: psData.contact.email ?? null, phone: psData.contact.phone ?? null,
              tags: [], source: psData.contact.opportunity_source ?? null,
              dateAdded: "", customFields: [], assignedTo: null,
            } as GHLContact);
          }
        }
      }

      if (profileRes?.ok) { const d = await profileRes.json(); setProfileValues(d.raw ?? {}); }
    } catch { /* continue */ }
    setLoading(false);
  }, [contactId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  // Load profile data for the currently-selected profile contact (may differ
  // from main contact when a journey has multiple members).
  useEffect(() => {
    if (profileContactId === contactId) { setProfileContactData(null); return; }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/contacts/${profileContactId}/pipeline-state`);
        if (!res.ok) return;
        const d = await res.json();
        if (cancelled || !d.contact) return;
        setProfileContactData({
          first_name: d.contact.first_name, last_name: d.contact.last_name,
          email: d.contact.email, phone: d.contact.phone,
          city: d.contact.city, state: d.contact.state,
          opportunity_source: d.contact.opportunity_source, sub_source: d.contact.sub_source,
          legal_entity: d.contact.legal_entity, website: d.contact.website,
          franchise_fee: d.contact.franchise_fee, royalty_pct: d.contact.royalty_pct,
          term_months: d.contact.term_months,
        });
      } catch { /* keep previous */ }
    })();
    return () => { cancelled = true; };
  }, [profileContactId, contactId]);

  // Load extended profile values (Scout score, categories) for whichever
  // core member is currently selected. Personal facts (credit, employment,
  // family) live on the contact, so each core member sees their own data.
  // Side members (spouse, attorney) don't render the extended sections.
  useEffect(() => {
    if (profileContactId === contactId) return; // already loaded by fetchAll
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/contacts/${profileContactId}/profile`);
        if (!res.ok) return;
        const d = await res.json();
        if (cancelled) return;
        setProfileValues(d.raw ?? {});
        setPendingChanges({});
      } catch { /* keep previous */ }
    })();
    return () => { cancelled = true; };
  }, [profileContactId, contactId]);

  function handleFieldChange(fieldName: string, value: string) {
    setProfileValues((prev) => ({ ...prev, [fieldName]: value }));
    setPendingChanges((prev) => ({ ...prev, [fieldName]: value }));
  }

  async function handleSave() {
    if (Object.keys(pendingChanges).length === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${profileContactId}/profile`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: pendingChanges }),
      });
      if (res.ok) { setPendingChanges({}); toast("Profile saved"); }
    } catch { /* keep pending */ }
    setSaving(false);
  }

  // Header title: prefer the journey name when it's a partnership (>=2 active
  // members). For solo journeys the GHL contact name is simpler and reads
  // better. Journey name falls back to the contact name if we don't have one.
  const activeMemberCount = members.filter((m) => m.contact_id).length;
  const displayName = (() => {
    if (journeyId && journeyName && activeMemberCount >= 2) {
      return capitalizeName(journeyName) || journeyName;
    }
    if (contact) {
      return capitalizeName(`${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim()) || "Unknown";
    }
    if (journeyName) return capitalizeName(journeyName) || journeyName;
    return "Loading...";
  })();
  const hasPending = Object.keys(pendingChanges).length > 0;
  const selectedPipeline = pipelineStates.find((p) => p.id === selectedPipelineId);
  const drilldownStage = selectedPipeline?.stages.find((s) => s.id === drilldownStageId);

  const territoryDealFields = {
    legal_entity: localContact?.legal_entity ?? null, website: localContact?.website ?? null,
    franchise_fee: localContact?.franchise_fee ?? null, royalty_pct: localContact?.royalty_pct ?? null,
    term_months: localContact?.term_months ?? null, opportunity_source: localContact?.opportunity_source ?? null,
    sub_source: localContact?.sub_source ?? null,
  };

  // Territory name for the "Carried to X" banner in the EOS tab. Sourced from
  // the journey's first active runway/onboarding jps row with a territory,
  // replacing the old contacts.territory column.
  const carriedTerritoryName =
    pipelineStates
      .flatMap((p) => p.territories ?? [])
      .find((t) => t.territory_name)?.territory_name ?? null;

  // Collect unique awarded territories across every pipeline-state row so
  // the EOS tab knows whether to show contact-scoped (pre-award) or
  // territory-scoped (post-award) EOS, and which territories to pick from.
  const awardedTerritories = (() => {
    const seen = new Set<string>();
    const out: { ms_slug: string; territory_name: string }[] = [];
    for (const ps of pipelineStates) {
      for (const t of ps.territories ?? []) {
        if (!seen.has(t.ms_slug)) {
          seen.add(t.ms_slug);
          out.push({ ms_slug: t.ms_slug, territory_name: t.territory_name });
        }
      }
    }
    return out;
  })();

  const activeMembers = members.filter((m) => m.contact_id);
  const showMemberTabs = Boolean(journeyId) && activeMembers.length >= 2;

  // Role-based gating for the extended profile fields (Scout score, Auto
  // Summary, category groups). "Core" roles — primary and co_primary —
  // are franchisees/prospects in their own right and get the full profile.
  // Side roles (family, spouse, attorney, accountant, financial_advisor,
  // business_partner, other) only see contact info.
  const profileMember = activeMembers.find((m) => m.contact_id === profileContactId);
  const profileRole = profileMember?.role ?? "primary";
  const isSideMember = profileRole !== "primary" && profileRole !== "co_primary";

  // Journey type drives how we label a journey's core members (primary,
  // co_primary). Runway/onboarding means they're a franchisee on this deal;
  // sales/followup means they're still a prospect. Fallback to "prospect"
  // when no active pipeline row is present yet so new intakes aren't blank.
  const journeyType: "franchisee" | "prospect" = (() => {
    const slugs = pipelineStates.map((p) => p.pipeline_slug);
    if (slugs.includes("runway") || slugs.includes("onboarding")) return "franchisee";
    return "prospect";
  })();
  const coreRoleLabel = journeyType === "franchisee" ? "Franchisee" : "Prospect";
  // Profile header stays visible on any journey page (even solo) so the
  // "Add contact" action always has a home — tabs only render when there
  // are 2+ members, but the action row renders whenever journeyId is set.
  const showProfileHeader = Boolean(journeyId);
  const profileTarget: LocalContact | null = isAltContact ? profileContactData : localContact;

  return (
    <div className="flex flex-col min-h-0">
      {/* Header — name + action buttons only */}
      <div className="flex items-center gap-3 px-1 py-3 flex-shrink-0">
        <button onClick={() => router.back()} className="btn-ghost p-1.5"><ArrowLeft size={18} /></button>
        <h1 className="font-headline text-page-title text-text-primary truncate flex-1">{displayName}</h1>
        {/* Person page link — opens the profile-tab member's contact page
            (primary-by-default; updates when user switches member tabs). */}
        <Link
          href={`/contacts/${profileContactId}`}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-bg-hover text-text-secondary text-caption font-medium hover:text-text-primary hover:bg-bg-tertiary transition-colors shrink-0"
          title="Open person profile"
        >
          <User size={12} /> Person
        </Link>
        {contact && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => setActivePanel("call")} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-success/10 text-success text-caption font-medium hover:bg-success/20 transition-colors"><Phone size={12} /> Call</button>
            <button onClick={() => setActivePanel("sms")} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-info/10 text-info text-caption font-medium hover:bg-info/20 transition-colors"><MessageSquare size={12} /> Text</button>
            <button onClick={() => setActivePanel("email")} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-scout-purple/10 text-scout-purple text-caption font-medium hover:bg-scout-purple/20 transition-colors"><Mail size={12} /> Email</button>
            <button onClick={() => setActivePanel("schedule")} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-nah-orange/10 text-nah-orange text-caption font-medium hover:bg-nah-orange/20 transition-colors"><Calendar size={12} /> Schedule</button>
          </div>
        )}
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasPending && (
            <button onClick={() => void handleSave()} disabled={saving} className="btn-primary text-caption px-3 py-1.5 flex items-center gap-1">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save ({Object.keys(pendingChanges).length})
            </button>
          )}
          <button onClick={() => void fetchAll()} className="btn-ghost p-1.5" disabled={loading}><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
        </div>
      </div>

      {/* Persistent Pipeline Bar */}
      {!loading && (
        <div className="px-1 flex-shrink-0">
          <PipelineBar contactId={contactId} pipelineStates={pipelineStates} selectedPipelineId={selectedPipelineId}
            onPipelineChange={setSelectedPipelineId} expandedStageId={drilldownStageId}
            onStageClick={(id) => setDrilldownStageId(drilldownStageId === id ? null : id)}
            focusedTerritorySlug={focusedTerritorySlug}
            onTerritoryChange={setFocusedTerritorySlug}
            onRefresh={() => void fetchAll()} />
          {drilldownStage && selectedPipeline && (() => {
            const currentStg = selectedPipeline.stages.find((s) => s.id === selectedPipeline.current_stage_id);
            const isPast = drilldownStage.sort_order < (currentStg?.sort_order ?? 0);
            return (
              <StageDrilldownInline contactId={contactId} stageName={drilldownStage.name}
                subTasks={drilldownStage.subTasks} logsBySubTask={new Map(Object.entries(drilldownStage.logsBySubTask))}
                stageHistory={selectedPipeline.stageHistory} stageId={drilldownStage.id}
                isPastStage={isPast}
                onRefresh={() => void fetchAll()} onClose={() => setDrilldownStageId(null)} />
            );
          })()}
        </div>
      )}

      {/* Persistent Territory + Deal cards */}
      {!loading && localContact && (
        <div className="px-1 flex-shrink-0 grid grid-cols-2 gap-2 mb-2">
          <TerritoryDetailsCard contactId={contactId} fields={territoryDealFields}
            onUpdate={(f) => setLocalContact((prev) => prev ? { ...prev, ...f } : prev)} />
          <DealDetailsCard contactId={contactId} fields={territoryDealFields}
            onUpdate={(f) => setLocalContact((prev) => prev ? { ...prev, ...f } : prev)} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border-default px-1 flex-shrink-0">
        {([
          { key: "overview" as const, label: "Overview" },
          { key: "messages" as const, label: "Messages" },
          { key: "profile" as const, label: "Profile" },
          { key: "territories" as const, label: "Territories" },
          { key: "eos" as const, label: "EOS" },
        ]).map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-body-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-nah-orange text-nah-orange" : "border-transparent text-text-tertiary hover:text-text-primary"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content — persistent left sidebar + tab-specific right content */}
      <div className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-text-tertiary" /></div>
        ) : (
          <div className="p-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* LEFT — Persistent: Team + Territory (visible on all tabs) */}
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
                  <RelatedPeopleCard
                    contactId={contactId}
                    mainContact={localContact}
                    journeyMembers={journeyId ? activeMembers.map((m) => ({
                      contact_id: m.contact_id,
                      role: m.role,
                      first_name: m.first_name,
                      last_name: m.last_name,
                      email: m.email ?? null,
                      phone: m.phone ?? null,
                      is_primary: m.is_primary,
                    })) : undefined}
                    coreRoleLabel={coreRoleLabel}
                    onAddRequested={journeyId ? () => setAddMemberOpen(true) : undefined}
                  />
                </div>
                <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
                  <TeamCard contactId={contactId} />
                </div>
                <TerritoryOwnershipSection
                  contactId={contactId}
                  ghlContactId={contact?.id}
                  focusedTerritorySlug={focusedTerritorySlug}
                  onTerritoryChange={setFocusedTerritorySlug}
                />
              </div>

              {/* RIGHT — Tab content */}
              <div className="lg:col-span-2 space-y-4">
                {activeTab === "overview" ? (
                  <>
                    <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Award size={14} className="text-text-tertiary" />
                        <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider">GRADED CALLS ({contactCalls.length})</h3>
                      </div>
                      {contactCalls.length === 0 ? <p className="text-caption text-text-tertiary">No graded calls yet</p> : (
                        <div className="space-y-1.5">
                          {contactCalls.map((c) => (
                            <a key={c.id} href={`/calls/${c.id}`} className="flex items-center gap-2.5 py-1.5 rounded hover:bg-bg-hover transition-colors">
                              <span className="text-caption font-medium text-text-primary">{c.callTypeName ?? "Call"}</span>
                              {c.hostName && <span className="text-[10px] text-text-tertiary">{c.hostName}</span>}
                              {c.duration_seconds && <span className="text-[10px] text-text-tertiary">{Math.round(c.duration_seconds / 60)}m</span>}
                              {c.grade && <span className={`text-[10px] font-bold px-1 rounded ${c.grade === "A" ? "bg-success/10 text-success" : c.grade === "F" ? "bg-danger/10 text-danger" : "bg-nah-blue/10 text-nah-blue"}`}>{c.grade}</span>}
                              <span className="text-[10px] text-text-tertiary ml-auto">{c.scheduled_at ? new Date(c.scheduled_at).toLocaleDateString() : ""}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
                      <div className="flex items-center gap-1.5 mb-2"><ClipboardList size={14} className="text-text-tertiary" /><h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider">TASKS</h3></div>
                      <TaskList contactId={contactId} tasks={tasks} onTaskUpdated={fetchAll} />
                    </div>
                    <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
                      <NotesSection contactId={contactId} notes={notes} onNoteAdded={fetchAll} />
                    </div>
                  </>
                ) : activeTab === "messages" ? (
                  <div className="flex flex-col h-full min-h-0"><MessagesTab contactId={contactId} highlightMessageId={highlightMessageId ?? null} /></div>
                ) : activeTab === "profile" ? (
                  <div className="space-y-4">
                    {showProfileHeader && (
                      <div className="flex flex-wrap items-center gap-1 border-b border-border-default">
                        {showMemberTabs && activeMembers.map((m) => {
                          const label = capitalizeName(`${m.first_name ?? ""} ${m.last_name ?? ""}`.trim()) || "Member";
                          const active = m.contact_id === profileContactId;
                          // Core roles (primary + co_primary) display as the
                          // journey's role in the current stage — no visual
                          // hierarchy between the two. Other roles read as-is.
                          const isCore = m.role === "primary" || m.role === "co_primary";
                          const roleLabel = isCore ? coreRoleLabel : m.role.replace(/_/g, " ");
                          return (
                            <button
                              key={m.contact_id}
                              onClick={() => setProfileContactId(m.contact_id)}
                              className={`px-3 py-1.5 text-caption font-medium border-b-2 transition-colors ${active ? "border-nah-orange text-nah-orange" : "border-transparent text-text-tertiary hover:text-text-primary"}`}
                            >
                              {label}
                              <span className="ml-1 text-[10px] text-text-tertiary">
                                {roleLabel}
                              </span>
                            </button>
                          );
                        })}
                        <div className="ml-auto mb-1 flex items-center gap-1.5">
                          <button
                            onClick={() => setAddMemberOpen(true)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-caption font-medium text-nah-blue bg-nah-blue/10 hover:bg-nah-blue/20 transition-colors"
                            title="Add a spouse, co-owner, advisor, etc. to this journey"
                          >
                            <UserPlus size={12} /> Add contact
                          </button>
                          {showMemberTabs && (
                            <button
                              onClick={() => setSplitOpen(true)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-caption font-medium text-danger bg-danger/10 hover:bg-danger/20 transition-colors"
                              title="Split this journey into two new journeys"
                            >
                              <GitBranch size={12} /> Split Journey
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
                      <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider mb-3">
                        {isSideMember ? "CONTACT INFORMATION" : `${coreRoleLabel.toUpperCase()} INFORMATION`}
                      </h3>
                      <div className="grid grid-cols-2 gap-3 text-body-sm">
                        {[
                          { label: "First Name", key: "first_name" as const, val: capitalizeName(profileTarget?.first_name) || "" },
                          { label: "Last Name", key: "last_name" as const, val: capitalizeName(profileTarget?.last_name) || "" },
                          { label: "Phone", key: "phone" as const, val: profileTarget?.phone || "" },
                          { label: "Email", key: "email" as const, val: profileTarget?.email || "" },
                          { label: "City", key: "city" as const, val: capitalizeName(profileTarget?.city) || "" },
                          { label: "State", key: "state" as const, val: profileTarget?.state?.toUpperCase() || "" },
                          { label: "Lead Source", key: "opportunity_source" as const, val: profileTarget?.opportunity_source || "" },
                        ].map((f) => (
                          <EditableInfoField
                            key={`${profileContactId}-${f.key}`}
                            label={f.label}
                            value={f.val}
                            onSave={async (v) => {
                              setProfileSavingKey(f.key);
                              const res = await fetch(`/api/contacts/${profileContactId}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ [f.key]: v || null }),
                              });
                              setProfileSavingKey(null);
                              if (!res.ok) return;
                              if (isAltContact) {
                                setProfileContactData((prev) => prev ? { ...prev, [f.key]: v || null } : prev);
                              } else {
                                setLocalContact((prev) => prev ? { ...prev, [f.key]: v || null } : prev);
                              }
                            }}
                          />
                        ))}
                      </div>
                      {profileSavingKey && <p className="text-[10px] text-text-tertiary mt-2">Saving…</p>}
                    </div>
                    {!isSideMember && profileValues["Auto Summary"] && (
                      <div className="bg-scout-purple/5 border border-scout-purple/20 rounded-lg p-4">
                        <span className="text-caption font-medium text-scout-purple">Scout AI Summary</span>
                        <p className="text-body-sm text-text-primary mt-1">{profileValues["Auto Summary"]}</p>
                        {profileValues["Recommended Next Action"] && <p className="text-body-sm text-nah-orange font-medium mt-2">Next: {profileValues["Recommended Next Action"]}</p>}
                      </div>
                    )}
                    {!isSideMember && profileValues["Scout Prospect Score"] && (
                      <div className="flex items-center gap-4 bg-bg-secondary border border-border-default rounded-lg p-4">
                        <div className="text-center"><div className="text-h1 text-nah-orange">{profileValues["Scout Prospect Score"]}</div><div className="text-caption text-text-tertiary">Prospect Score</div></div>
                        {profileValues["Predicted Close Probability"] && <div className="text-center"><div className="text-h1 text-success">{profileValues["Predicted Close Probability"]}%</div><div className="text-caption text-text-tertiary">Close Prob.</div></div>}
                      </div>
                    )}
                    {!isSideMember && CATEGORIES.map((cat) => {
                      const fields = PROFILE_FIELDS.filter((f) => f.category === cat);
                      return <ProfileSection key={cat} category={cat} fields={fields} values={profileValues} onFieldChange={handleFieldChange} saving={saving} />;
                    })}
                  </div>
                ) : activeTab === "territories" ? (
                  <TerritoryDataTab ghlContactId={contact?.id ?? null} />
                ) : activeTab === "eos" ? (
                  <JourneyEosTab
                    contactId={contactId}
                    carriedTerritoryName={carriedTerritoryName}
                    awardedTerritories={awardedTerritories}
                    focusedTerritorySlug={focusedTerritorySlug}
                    onTerritoryChange={setFocusedTerritorySlug}
                    primaryContactName={displayName}
                    coreMembers={activeMembers
                      .filter((m) => m.role === "primary" || m.role === "co_primary")
                      .map((m) => ({
                        contactId: m.contact_id,
                        name: capitalizeName(`${m.first_name ?? ""} ${m.last_name ?? ""}`.trim()) || "Member",
                      }))}
                  />
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action panels */}
      {activePanel === "sms" && contact && (
        <SMSPanel contactId={contact.id} contactName={displayName} contactPhone={contact.phone ?? localContact?.phone ?? null}
          onClose={() => setActivePanel(null)} onSent={() => { setActivePanel(null); void fetchAll(); }} />
      )}
      {activePanel === "email" && contact && (
        <EmailPanel contactId={contact.id} contactName={displayName} contactEmail={contact.email ?? localContact?.email ?? null}
          onClose={() => setActivePanel(null)} onSent={() => { setActivePanel(null); void fetchAll(); }} />
      )}
      {activePanel === "call" && contact && (
        <CallPanel contactName={displayName} contactPhone={contact.phone ?? localContact?.phone ?? null}
          onClose={() => setActivePanel(null)} />
      )}
      {activePanel === "schedule" && contact && (
        <SchedulePanel contactId={contact.id} contactName={displayName} contactEmail={contact.email ?? localContact?.email ?? null}
          onClose={() => setActivePanel(null)} onScheduled={() => { setActivePanel(null); void fetchAll(); }} />
      )}

      {/* Split Journey modal — visible only when a journey has 2+ members */}
      {splitOpen && journeyId && (
        <SplitJourneyModal
          journeyId={journeyId}
          originalName={displayName}
          members={activeMembers.map((m) => ({
            contact_id: m.contact_id,
            first_name: m.first_name,
            last_name: m.last_name,
            role: m.role,
          }))}
          territories={(() => {
            const seen = new Set<string>();
            const out: SplitTerritory[] = [];
            for (const ps of pipelineStates) {
              for (const t of (ps.territories ?? [])) {
                if (!seen.has(t.ms_slug)) {
                  seen.add(t.ms_slug);
                  out.push({ ms_slug: t.ms_slug, territory_name: t.territory_name });
                }
              }
            }
            return out;
          })()}
          onClose={() => setSplitOpen(false)}
        />
      )}

      {/* Add Contact to Journey modal — available on any journey, including
          solo ones so the rep can attach a spouse/advisor later. */}
      {journeyId && (
        <AddJourneyMemberModal
          open={addMemberOpen}
          journeyId={journeyId}
          existingMemberIds={activeMembers.map((m) => m.contact_id)}
          coreRoleLabel={coreRoleLabel}
          onClose={() => setAddMemberOpen(false)}
          onAdded={() => { router.refresh(); }}
        />
      )}
    </div>
  );
}
