"use client";

import { useState } from "react";
import { FileText, ListChecks, Database, BookOpen, User, MapPin } from "lucide-react";
import CallOverviewTab from "./CallOverviewTab";
import CallNextStepsTab from "./CallNextStepsTab";
import CallDataTab from "./CallDataTab";
import CallKnowledgeTab from "./CallKnowledgeTab";

export interface KBIntelItem {
  category: string;
  subcategory: string;
  title: string;
  content: string;
  source_quote: string;
  frequency_signal: "new" | "recurring" | "unknown";
}

interface CoachingData {
  score: number;
  label: string;
  went_well: string[];
  watch_out: string[];
  next_call_prep: string;
}

interface ActionItem {
  id: string;
  call_id: string;
  contact_id: string | null;
  category: string;
  title: string;
  description: string | null;
  why: string | null;
  contact_name: string | null;
  assigned_to_name: string | null;
  source: string;
  ghl_action: boolean;
  status: string;
  pushed_at: string | null;
  skipped_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface Extraction {
  id: string;
  call_id: string;
  contact_id: string | null;
  field_key: string;
  field_category: string;
  extracted_value: string | null;
  confidence: string | null;
  saved_to_profile: boolean;
  dismissed: boolean;
  TerritorySlug: string | null;
  target_scope: "single" | "both" | null;
  protected_by_newer_profile?: boolean;
}

interface LinkedContact {
  id: string | null;
  name: string;
}

interface CallTerritory {
  TerritorySlug: string;
  Nickname: string;
}

interface CallDetailTabsProps {
  callId: string;
  aiSummary: string | null;
  summaryBullets: string[] | null;
  aiSummaryGeneratedAt: string | null;
  coachingScore: number | null;
  coachingData: CoachingData | null;
  coachingGeneratedAt: string | null;
  rawTranscript: string | null;
  hasTranscript: boolean;
  recordingUrl: string | null;
  meetingLink: string | null;
  durationSeconds: number | null;
  startedAt: string | null;
  source: string | null;
  actionItems: ActionItem[];
  dataExtractions: Extraction[];
  profileFieldCount: number;
  isGenerating: boolean;
  teamMembers: { id: string; name: string; email: string }[];
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  partnerOptions: { id: string; name: string }[];
  linkedContacts: LinkedContact[];
  callTerritories: CallTerritory[];
  participantNames: string[];
  callTypeSlug: string | null;
  kbIntelItems: KBIntelItem[];
  rubricGrade: {
    id: string;
    overall_grade: string;
    overall_score: number;
    criterion_scores: { criterionId: string; name: string; grade: string; score: number; rationale: string }[] | null;
    strengths: string[] | null;
    improvements: string[] | null;
    suggested_next_action: string | null;
  } | null;
  onRefresh: () => void;
}

function isGroupOrInternal(slug: string | null): boolean {
  if (!slug) return false;
  return slug === "internal" || slug === "team_call" || slug === "group_call" || slug === "cohort_call";
}

type TabKey = string; // "overview" | "contact:{id}" | "territory:{slug}" | "knowledge"

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number;
}

export default function CallDetailTabs(props: CallDetailTabsProps) {
  const groupMode = isGroupOrInternal(props.callTypeSlug);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // Build dynamic tabs based on linked contacts + territories
  const tabs: TabDef[] = [{ key: "overview", label: "Overview", icon: FileText }];

  if (groupMode) {
    // Group/internal: just overview + knowledge
    tabs.push({ key: "knowledge", label: "Knowledge Captured", icon: BookOpen });
  } else {
    // Individual calls: per-contact tabs + per-territory tabs
    const contacts = getUniqueContacts(props.linkedContacts, props.actionItems, props.dataExtractions);
    const territories = getUniqueTerritories(props.callTerritories, props.dataExtractions);

    for (const contact of contacts) {
      const contactActions = props.actionItems.filter((a) => a.contact_id === contact.id);
      const contactExtractions = props.dataExtractions.filter(
        (e) => e.contact_id === contact.id && !isTerritoryCat(e.field_category)
      );
      const pending =
        contactActions.filter((a) => a.status === "pending").length +
        contactExtractions.filter((e) => !e.saved_to_profile && !e.dismissed).length;

      tabs.push({
        key: `contact:${contact.id}`,
        label: contact.name,
        icon: User,
        badge: pending || undefined,
      });
    }

    // Unattributed items (no contact_id) get their own tab if they exist
    const unattributed = props.actionItems.filter((a) => !a.contact_id);
    const unattribExtractions = props.dataExtractions.filter((e) => !e.contact_id && !isTerritoryCat(e.field_category));
    if (unattributed.length > 0 || unattribExtractions.length > 0) {
      const pending =
        unattributed.filter((a) => a.status === "pending").length +
        unattribExtractions.filter((e) => !e.saved_to_profile && !e.dismissed).length;
      tabs.push({
        key: "contact:unattributed",
        label: "General",
        icon: ListChecks,
        badge: pending || undefined,
      });
    }

    for (const territory of territories) {
      const terrExtractions = props.dataExtractions.filter(
        (e) => e.TerritorySlug === territory.TerritorySlug && isTerritoryCat(e.field_category)
      );
      const pending = terrExtractions.filter((e) => !e.saved_to_profile && !e.dismissed).length;

      tabs.push({
        key: `territory:${territory.TerritorySlug}`,
        label: territory.Nickname,
        icon: MapPin,
        badge: pending || undefined,
      });
    }
  }

  // Fall back to overview if active tab is removed (e.g. after re-generation)
  const validKeys = new Set(tabs.map((t) => t.key));
  const effectiveTab = validKeys.has(activeTab) ? activeTab : "overview";

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 -mx-4 md:-mx-8 px-4 md:px-8">
        {/* Overview + Knowledge row */}
        <div className="flex border-b border-border-default mb-4">
          {tabs
            .filter((t) => t.key === "overview" || t.key === "knowledge")
            .map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-body-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    effectiveTab === tab.key
                      ? "border-nah-orange text-nah-orange"
                      : "border-transparent text-text-tertiary hover:text-text-primary"
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
        </div>

        {/* Contact + Territory cards row */}
        {tabs.filter((t) => t.key !== "overview" && t.key !== "knowledge").length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {tabs
              .filter((t) => t.key !== "overview" && t.key !== "knowledge")
              .map((tab) => {
                const isContact = tab.key.startsWith("contact:");
                const isTerritory = tab.key.startsWith("territory:");
                const isActive = effectiveTab === tab.key;
                const Icon = tab.icon;

                const accentColor = isContact ? "nah-blue" : isTerritory ? "accent-yellow" : "text-tertiary";
                const activeBg = isContact
                  ? "bg-nah-blue/10 border-nah-blue"
                  : isTerritory
                    ? "bg-accent-yellow/10 border-accent-yellow"
                    : "bg-bg-tertiary border-border-default";
                const inactiveBg = "bg-bg-secondary border-border-default hover:border-text-tertiary";
                const activeText = isContact
                  ? "text-nah-blue"
                  : isTerritory
                    ? "text-accent-yellow"
                    : "text-text-primary";

                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-body-sm font-medium transition-all whitespace-nowrap ${
                      isActive ? `${activeBg} ${activeText}` : `${inactiveBg} text-text-secondary`
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isActive
                          ? isContact
                            ? "bg-nah-blue text-white"
                            : "bg-accent-yellow text-white"
                          : "bg-bg-tertiary text-text-tertiary"
                      }`}
                    >
                      <Icon size={12} />
                    </div>
                    <div className="text-left">
                      <div className="leading-tight">{tab.label}</div>
                      <div className={`text-[10px] font-normal ${isActive ? "opacity-70" : "text-text-tertiary"}`}>
                        {isContact ? "Contact" : isTerritory ? "Territory" : "Actions"}
                      </div>
                    </div>
                    {tab.badge && tab.badge > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          isActive
                            ? isContact
                              ? "bg-nah-blue/20 text-nah-blue"
                              : "bg-accent-yellow/20 text-accent-yellow"
                            : "bg-bg-tertiary text-text-tertiary"
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {/* Tab content */}
      {effectiveTab === "overview" && (
        <CallOverviewTab
          callId={props.callId}
          aiSummary={props.aiSummary}
          summaryBullets={props.summaryBullets}
          aiSummaryGeneratedAt={props.aiSummaryGeneratedAt}
          coachingScore={props.coachingScore}
          coachingData={props.coachingData}
          coachingGeneratedAt={props.coachingGeneratedAt}
          rawTranscript={props.rawTranscript}
          hasTranscript={props.hasTranscript}
          recordingUrl={props.recordingUrl}
          meetingLink={props.meetingLink}
          durationSeconds={props.durationSeconds}
          startedAt={props.startedAt}
          source={props.source}
          isGenerating={props.isGenerating}
          participantNames={props.participantNames}
          rubricGrade={props.rubricGrade}
          onRefresh={props.onRefresh}
        />
      )}

      {effectiveTab === "knowledge" && (
        <CallKnowledgeTab
          items={props.kbIntelItems}
          isGenerating={props.isGenerating}
          hasTranscript={props.hasTranscript}
          hasGenerated={!!props.aiSummaryGeneratedAt}
          callId={props.callId}
          onRefresh={props.onRefresh}
        />
      )}

      {/* Per-contact tabs */}
      {effectiveTab.startsWith("contact:") && (
        <ContactTabContent
          tabKey={effectiveTab}
          callId={props.callId}
          actionItems={props.actionItems}
          dataExtractions={props.dataExtractions}
          hasTranscript={props.hasTranscript}
          hasGenerated={!!props.aiSummaryGeneratedAt}
          isGenerating={props.isGenerating}
          profileFieldCount={props.profileFieldCount}
          teamMembers={props.teamMembers}
          contactName={props.contactName}
          contactEmail={props.contactEmail}
          contactPhone={props.contactPhone}
          partnerOptions={props.partnerOptions}
          linkedContacts={props.linkedContacts}
          callTerritories={props.callTerritories}
          onRefresh={props.onRefresh}
        />
      )}

      {/* Per-territory tabs */}
      {effectiveTab.startsWith("territory:") && (
        <TerritoryTabContent
          tabKey={effectiveTab}
          callId={props.callId}
          dataExtractions={props.dataExtractions}
          hasTranscript={props.hasTranscript}
          hasGenerated={!!props.aiSummaryGeneratedAt}
          isGenerating={props.isGenerating}
          profileFieldCount={props.profileFieldCount}
          partnerOptions={props.partnerOptions}
          linkedContacts={props.linkedContacts}
          callTerritories={props.callTerritories}
          onRefresh={props.onRefresh}
        />
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────

function isTerritoryCat(cat: string): boolean {
  return cat === "territory" || cat === "territory_eos" || cat === "territory_market";
}

interface UniqueContact {
  id: string;
  name: string;
}

function getUniqueContacts(
  linkedContacts: LinkedContact[],
  actionItems: ActionItem[],
  extractions: Extraction[]
): UniqueContact[] {
  const map = new Map<string, string>();

  // From linked contacts
  for (const c of linkedContacts) {
    if (c.id) map.set(c.id, c.name);
  }

  // From action items
  for (const a of actionItems) {
    if (a.contact_id && !map.has(a.contact_id)) {
      map.set(a.contact_id, a.contact_name ?? "Unknown");
    }
  }

  // From extractions
  for (const e of extractions) {
    if (e.contact_id && !map.has(e.contact_id)) {
      map.set(e.contact_id, "Unknown");
    }
  }

  return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
}

function getUniqueTerritories(callTerritories: CallTerritory[], extractions: Extraction[]): CallTerritory[] {
  const map = new Map<string, string>();

  for (const t of callTerritories) {
    map.set(t.TerritorySlug, t.Nickname);
  }

  for (const e of extractions) {
    if (e.TerritorySlug && isTerritoryCat(e.field_category) && !map.has(e.TerritorySlug)) {
      map.set(e.TerritorySlug, e.TerritorySlug);
    }
  }

  return Array.from(map.entries()).map(([TerritorySlug, Nickname]) => ({ TerritorySlug, Nickname }));
}

// ─── Per-Contact Tab Content ─────────────────────────────

interface ContactTabContentProps {
  tabKey: string;
  callId: string;
  actionItems: ActionItem[];
  dataExtractions: Extraction[];
  hasTranscript: boolean;
  hasGenerated: boolean;
  isGenerating: boolean;
  profileFieldCount: number;
  teamMembers: { id: string; name: string; email: string }[];
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  partnerOptions: { id: string; name: string }[];
  linkedContacts: LinkedContact[];
  callTerritories: CallTerritory[];
  onRefresh: () => void;
}

function ContactTabContent({
  tabKey,
  callId,
  actionItems,
  dataExtractions,
  hasTranscript,
  hasGenerated,
  isGenerating,
  profileFieldCount,
  teamMembers,
  contactName,
  contactEmail,
  contactPhone,
  partnerOptions,
  linkedContacts,
  callTerritories,
  onRefresh,
}: ContactTabContentProps) {
  const contactId = tabKey.replace("contact:", "");
  const isUnattributed = contactId === "unattributed";

  // Filter items for this contact
  const filteredActions = isUnattributed
    ? actionItems.filter((a) => !a.contact_id)
    : actionItems.filter((a) => a.contact_id === contactId);

  const filteredExtractions = isUnattributed
    ? dataExtractions.filter((e) => !e.contact_id && !isTerritoryCat(e.field_category))
    : dataExtractions.filter((e) => e.contact_id === contactId && !isTerritoryCat(e.field_category));

  // Resolve contact info for the tab
  const linked = linkedContacts.find((c) => c.id === contactId);
  const tabContactName = linked?.name ?? contactName;

  return (
    <div className="space-y-6">
      {/* Contact header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border-default">
        <div className="w-10 h-10 rounded-full bg-nah-blue flex items-center justify-center text-white font-semibold text-body-sm">
          {isUnattributed
            ? "?"
            : (tabContactName ?? "?")
                .split(" ")
                .map((w) => w[0]?.toUpperCase() ?? "")
                .join("")
                .slice(0, 2)}
        </div>
        <div>
          <h3 className="text-body font-semibold text-text-primary">
            {isUnattributed ? "General (Unattributed)" : tabContactName}
          </h3>
          <p className="text-caption text-text-tertiary">
            {filteredActions.length} action{filteredActions.length !== 1 ? "s" : ""} &middot;{" "}
            {filteredExtractions.length} data point{filteredExtractions.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* No data state */}
      {filteredActions.length === 0 && filteredExtractions.length === 0 && (
        <p className="text-body-sm text-text-tertiary italic py-4">
          No action items or data extractions attributed to this contact from this call.
        </p>
      )}

      {/* Next Steps for this contact */}
      {filteredActions.length > 0 && (
        <CallNextStepsTab
          callId={callId}
          actionItems={filteredActions}
          hasTranscript={hasTranscript}
          hasGenerated={hasGenerated}
          isGenerating={isGenerating}
          teamMembers={teamMembers}
          contactName={tabContactName}
          contactEmail={contactEmail}
          contactPhone={contactPhone}
          partnerOptions={partnerOptions}
          onRefresh={onRefresh}
        />
      )}

      {/* Data extractions for this contact */}
      {filteredExtractions.length > 0 && (
        <div className="border-t border-border-default pt-6">
          <CallDataTab
            callId={callId}
            dataExtractions={filteredExtractions}
            profileFieldCount={profileFieldCount}
            hasTranscript={hasTranscript}
            hasGenerated={hasGenerated}
            isGenerating={isGenerating}
            partnerOptions={partnerOptions}
            linkedContacts={linkedContacts}
            callTerritories={callTerritories}
            onRefresh={onRefresh}
          />
        </div>
      )}
    </div>
  );
}

// ─── Per-Territory Tab Content ───────────────────────────

interface TerritoryTabContentProps {
  tabKey: string;
  callId: string;
  dataExtractions: Extraction[];
  hasTranscript: boolean;
  hasGenerated: boolean;
  isGenerating: boolean;
  profileFieldCount: number;
  partnerOptions: { id: string; name: string }[];
  linkedContacts: LinkedContact[];
  callTerritories: CallTerritory[];
  onRefresh: () => void;
}

function TerritoryTabContent({
  tabKey,
  callId,
  dataExtractions,
  hasTranscript,
  hasGenerated,
  isGenerating,
  profileFieldCount,
  partnerOptions,
  linkedContacts,
  callTerritories,
  onRefresh,
}: TerritoryTabContentProps) {
  const slug = tabKey.replace("territory:", "");
  const territory = callTerritories.find((t) => t.TerritorySlug === slug);

  // Filter territory-specific extractions
  const filteredExtractions = dataExtractions.filter(
    (e) => e.TerritorySlug === slug && isTerritoryCat(e.field_category)
  );

  return (
    <div className="space-y-6">
      {/* Territory header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border-default">
        <div className="w-10 h-10 rounded-lg bg-accent-yellow flex items-center justify-center text-white font-semibold text-body-sm">
          <MapPin size={18} />
        </div>
        <div>
          <h3 className="text-body font-semibold text-text-primary">{territory?.Nickname ?? slug}</h3>
          <p className="text-caption text-text-tertiary">
            {filteredExtractions.length} data point{filteredExtractions.length !== 1 ? "s" : ""} extracted
          </p>
        </div>
      </div>

      {filteredExtractions.length === 0 && (
        <p className="text-body-sm text-text-tertiary italic py-4">
          No territory-specific data extracted from this call.
        </p>
      )}

      {filteredExtractions.length > 0 && (
        <CallDataTab
          callId={callId}
          dataExtractions={filteredExtractions}
          profileFieldCount={profileFieldCount}
          hasTranscript={hasTranscript}
          hasGenerated={hasGenerated}
          isGenerating={isGenerating}
          partnerOptions={partnerOptions}
          linkedContacts={linkedContacts}
          callTerritories={callTerritories}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
