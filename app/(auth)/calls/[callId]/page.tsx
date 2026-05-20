"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * Call Detail Page — 3-tab layout: Overview, Next Steps, Data.
 * Header section (title, tags, team, contacts) preserved.
 * Tab content powered by CallDetailTabs component.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Search,
  UserPlus,
  MapPin,
  GitBranch,
  X,
  Check,
} from "lucide-react";
import CallDetailTabs from "@/components/calls/CallDetailTabs";
import CallOverrideControls from "@/components/calls/CallOverrideControls";
import NextStepHero from "@/components/calls/NextStepHero";
import AddProspectModal from "@/components/pipeline/AddProspectModal";
import AddRelatedContactModal from "@/components/calls/AddRelatedContactModal";

interface TeamMember {
  id: string;
  name: string;
  email: string;
}
interface LinkedContact {
  id: string | null;
  name: string;
  email: string;
  phone: string;
  role: string;
  linked: boolean;
}
interface UnknownParticipant {
  name: string;
  email: string;
}
interface RawParticipant {
  id: string;
  email: string | null;
  display_name: string | null;
  role: "nah_team" | "prospect" | "franchisee" | "unknown";
  user_id: string | null;
  contact_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  TerritorySlug: string | null;
}

interface CoachingData {
  score: number;
  label: string;
  went_well: string[];
  watch_out: string[];
  next_call_prep: string;
}

interface CallTerritoryRef {
  TerritorySlug: string;
  Nickname: string;
  is_primary: boolean;
}

interface CallJourneyRef {
  journey_id: string;
  journey_pipeline_state_id: string;
  journey_name: string;
  stage_name: string | null;
  TerritorySlug: string | null;
  Nickname: string | null;
  is_primary: boolean;
}

interface PartnershipPartner {
  id: string;
  name: string;
}

interface CallDetail {
  id: string;
  contactName: string | null;
  contact_id: string | null;
  hostName: string | null;
  hosted_by_user_id: string | null;
  callTypeName: string | null;
  callTypeSlug: string | null;
  call_type_id: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  meeting_link: string | null;
  recording_url: string | null;
  status: string;
  source: string | null;
  title: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  TerritorySlug: string | null;
  territoryName: string | null;
  coach_user_id: string | null;
  coachName: string | null;
  participant_count: number | null;
  raw_transcript: string | null;
  ai_summary: string | null;
  summary_bullets: string[] | null;
  ai_summary_generated_at: string | null;
  coaching_score: number | null;
  coaching_data: CoachingData | null;
  coaching_generated_at: string | null;
  teamMembers: TeamMember[];
  linkedContacts: LinkedContact[];
  unknownParticipants: UnknownParticipant[];
  rawParticipants: RawParticipant[];
  callTerritories: CallTerritoryRef[];
  callJourneys: CallJourneyRef[];
  partnershipPartners: PartnershipPartner[];
  kb_intel_items: Array<{
    category: string;
    subcategory: string;
    title: string;
    content: string;
    source_quote: string;
    frequency_signal: "new" | "recurring" | "unknown";
  }> | null;
}

interface ActionItem {
  id: string;
  call_id: string;
  category: string;
  title: string;
  description: string | null;
  why: string | null;
  contact_name: string | null;
  assigned_to_name: string | null;
  source: string;
  ghl_action: boolean;
  status: string;
  contact_id: string | null;
  pushed_at: string | null;
  skipped_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface RubricGrade {
  id: string;
  overall_grade: string;
  overall_score: number;
  criterion_scores: { criterionId: string; name: string; grade: string; score: number; rationale: string }[] | null;
  strengths: string[] | null;
  improvements: string[] | null;
  suggested_next_action: string | null;
  rubric_id: string | null;
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
}

export default function CallDetailPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params.callId as string;

  const [call, setCall] = useState<CallDetail | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [dataExtractions, setDataExtractions] = useState<Extraction[]>([]);
  const [profileFieldCount, setProfileFieldCount] = useState(0);
  const [rubricGrade, setRubricGrade] = useState<RubricGrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedPill, setExpandedPill] = useState<string | null>(null);
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());

  const fetchDetail = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/calls/${callId}/detail`);
      if (res.ok) {
        const data = await res.json();
        setCall(data.call);
        setTranscript(data.transcript ?? null);
        setActionItems(data.actionItems ?? []);
        setDataExtractions(data.dataExtractions ?? []);
        setProfileFieldCount(data.profileFieldCount ?? 0);
        setRubricGrade(data.grade ?? null);
        return data;
      }
    } catch {
      /* silent */
    }
    setLoading(false);
    return null;
  }, [callId]);

  // Auto-generate on page load if transcript exists but no analysis yet.
  // Fire-and-forget the generate call, then poll /detail until results appear.
  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const poll = (remaining: number) => {
      if (cancelled || remaining <= 0) {
        if (!cancelled) setIsGenerating(false);
        return;
      }
      pollTimer = setTimeout(async () => {
        const refreshed = await fetchDetail();
        if (cancelled) return;
        // Stop polling once summary exists — coaching is optional for some call types
        if (refreshed?.call?.ai_summary_generated_at) {
          setIsGenerating(false);
        } else {
          poll(remaining - 1);
        }
      }, 5000);
    };

    void (async () => {
      const data = await fetchDetail();
      if (cancelled) return;
      setLoading(false);

      // Only auto-trigger if transcript exists but NO summary yet.
      // Don't re-trigger if summary already exists (coaching is optional).
      const needsSummary = !data?.call?.ai_summary_generated_at;

      if (data?.transcript && needsSummary) {
        setIsGenerating(true);
        apiFetch(`/api/calls/${callId}/generate`, { method: "POST" }).catch(() => {});
        poll(60);
      }
    })();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [fetchDetail, callId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (!call) {
    return <div className="text-center py-16 text-text-tertiary">Call not found</div>;
  }

  const hasTranscript = !!transcript;

  // Signals that the call didn't happen or the transcript is unusable.
  const badCallReasons: string[] = [];
  if (call.status === "missed") badCallReasons.push("Marked missed");
  if (call.status === "completed" && !hasTranscript) badCallReasons.push("No transcript");
  if (call.status === "completed" && transcript && transcript.length < 500)
    badCallReasons.push("Transcript too short to analyze");
  if (call.duration_seconds != null && call.duration_seconds > 0 && call.duration_seconds < 120)
    badCallReasons.push("Call under 2 minutes");

  const unmappedCount = (call.rawParticipants ?? []).filter((p) => p.role !== "nah_team" && !p.contact_id).length;

  const COLLAPSE_THRESHOLD = 3;
  const toggleCluster = (key: string) =>
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  return (
    <div>
      {/* Processing banner */}
      {isGenerating && (
        <div className="mb-4 flex items-center gap-2 bg-scout-purple/5 border border-scout-purple/20 rounded-lg px-4 py-2.5">
          <Loader2 size={14} className="animate-spin text-scout-purple" />
          <span className="text-body-sm text-scout-purple">
            Scout is processing this call — analyzing, grading, and extracting data...
          </span>
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <div className="mb-5 space-y-3">
        {/* Row 1 — Back + Title + Refresh */}
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="btn-ghost p-1.5 flex-shrink-0">
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-headline text-page-title text-text-primary whitespace-nowrap">{call.title ?? "Call"}</h1>
          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            <CallOverrideControls
              callId={call.id}
              hostedByUserId={call.hosted_by_user_id}
              currentCallTypeId={call.call_type_id}
              currentCallTypeSlug={call.callTypeSlug}
              currentContactId={call.contact_id}
              currentTerritorySlug={call.TerritorySlug}
              participants={call.rawParticipants ?? []}
              onChange={() => void fetchDetail()}
            />
            <button
              onClick={async () => {
                setRefreshing(true);
                try {
                  await apiFetch(`/api/calls/${callId}/reclassify-participants`, { method: "POST" });
                  await apiFetch(`/api/calls/${callId}/generate?force=true`, { method: "POST" });
                  await fetchDetail();
                } finally {
                  setRefreshing(false);
                }
              }}
              disabled={refreshing}
              className="btn-ghost p-1.5 flex-shrink-0"
              title="Re-process call"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Row 2 — Call metadata */}
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          {call.callTypeName && (
            <span className="px-[9px] py-[3px] rounded-full font-medium bg-[#F1EFE8] text-[#5F5E5A]">
              {call.callTypeName}
            </span>
          )}
          <span
            className={`px-[9px] py-[3px] rounded-full font-medium capitalize ${
              call.status === "completed"
                ? "bg-success/10 text-success"
                : call.status === "scheduled"
                  ? "bg-info/10 text-info"
                  : call.status === "missed"
                    ? "bg-danger/10 text-danger"
                    : "bg-[#F1EFE8] text-[#5F5E5A]"
            }`}
          >
            {call.status}
          </span>

          <span className="inline-block w-px h-3 bg-border-default" />

          <span className="text-text-tertiary font-normal">
            {(call.started_at ?? call.scheduled_at)
              ? new Date(call.started_at ?? call.scheduled_at!).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "—"}
            {call.duration_seconds ? ` · ${Math.round(call.duration_seconds / 60)} min` : ""}
          </span>

          {badCallReasons.length > 0 && (
            <span
              className="inline-flex items-center text-danger"
              title={`Likely bad call: ${badCallReasons.join(", ")}`}
            >
              <AlertTriangle size={13} fill="currentColor" className="text-danger" />
            </span>
          )}

          {unmappedCount > 0 && (
            <span
              className="inline-flex items-center text-[#EAB308]"
              title={`${unmappedCount} participant${unmappedCount === 1 ? "" : "s"} not mapped to a contact`}
            >
              <AlertTriangle size={13} fill="currentColor" />
            </span>
          )}

          <span className="inline-block w-px h-3 bg-border-default" />

          <span className="px-[9px] py-[3px] rounded-full font-medium bg-[#E6F1FB] text-[#185FA5]">
            {getPlatformLabel(call.source)}
          </span>
        </div>

        {/* Row 3 — People + Territory */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Team cluster */}
          {call.teamMembers?.length > 0 &&
            (() => {
              const items = call.teamMembers;
              const isExpanded = expandedClusters.has("team");
              const needsCollapse = items.length >= COLLAPSE_THRESHOLD;
              const visible = needsCollapse && !isExpanded ? items.slice(0, 2) : items;
              const remaining = items.length - visible.length;
              return (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1">Team</div>
                  <div className="flex items-center gap-1.5">
                    {visible.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-[5px] text-[12px] font-medium px-[8px] py-[3px] rounded-full bg-[#F1EFE8] text-[#444441]"
                      >
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium bg-[#EEEDFE] text-[#534AB7]">
                          {initials(m.name)}
                        </div>
                        {m.name}
                      </div>
                    ))}
                    {needsCollapse && (
                      <button
                        onClick={() => toggleCluster("team")}
                        className="text-[11px] font-medium px-[8px] py-[3px] rounded-full bg-bg-tertiary text-text-tertiary hover:bg-bg-hover transition-colors"
                      >
                        {isExpanded ? "show less" : `+${remaining} more`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

          {/* Divider */}
          {call.teamMembers?.length > 0 && (call.linkedContacts?.length > 0 || call.contactName) && (
            <div className="w-px h-8 bg-border-default" />
          )}

          {/* Contact cluster */}
          {call.linkedContacts?.length > 0 ? (
            (() => {
              const items = call.linkedContacts;
              const isExpanded = expandedClusters.has("contacts");
              const needsCollapse = items.length >= COLLAPSE_THRESHOLD;
              const visible = needsCollapse && !isExpanded ? items.slice(0, 2) : items;
              const remaining = items.length - visible.length;
              return (
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1">
                    {items.length === 1 ? "Contact" : `Contacts (${items.length})`}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {visible.map((c) =>
                      c.linked && c.id ? (
                        <Link
                          key={c.id}
                          href={`/contacts/${c.id}`}
                          className="flex items-center gap-[5px] text-[12px] font-medium px-[8px] py-[3px] rounded-full bg-[#E6F1FB] text-[#0C447C] hover:bg-[#B5D4F4] transition-colors"
                        >
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium bg-[#D4E8F9] text-[#185FA5]">
                            {initials(c.name)}
                          </div>
                          {c.name}
                        </Link>
                      ) : (
                        <div
                          key={c.email}
                          className="flex items-center gap-[5px] text-[12px] font-medium px-[8px] py-[3px] rounded-full bg-[#FAEEDA] text-[#633806]"
                          title={`${c.email} — not in system`}
                        >
                          <AlertTriangle size={12} />
                          {c.name}
                        </div>
                      )
                    )}
                    {needsCollapse && (
                      <button
                        onClick={() => toggleCluster("contacts")}
                        className="text-[11px] font-medium px-[8px] py-[3px] rounded-full bg-bg-tertiary text-text-tertiary hover:bg-bg-hover transition-colors"
                      >
                        {isExpanded ? "show less" : `+${remaining} more`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()
          ) : call.contactName ? (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1">Contact</div>
              <Link
                href={`/contacts/${call.contact_id}`}
                className="flex items-center gap-[5px] text-[12px] font-medium px-[8px] py-[3px] rounded-full bg-[#E6F1FB] text-[#0C447C] hover:bg-[#B5D4F4] transition-colors"
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium bg-[#D4E8F9] text-[#185FA5]">
                  {initials(call.contactName)}
                </div>
                {call.contactName}
              </Link>
            </div>
          ) : null}

          {/* Journey cluster — every journey advanced by this call */}
          {call.callJourneys &&
            call.callJourneys.length > 0 &&
            (() => {
              const items = call.callJourneys;
              const isExpanded = expandedClusters.has("journeys");
              const needsCollapse = items.length >= COLLAPSE_THRESHOLD;
              const visible = needsCollapse && !isExpanded ? items.slice(0, 2) : items;
              const remaining = items.length - visible.length;
              return (
                <>
                  <div className="w-px h-8 bg-border-default" />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1">
                      {items.length === 1 ? "Journey" : `Journeys (${items.length})`}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {visible.map((j) => (
                        <Link
                          key={j.journey_pipeline_state_id}
                          href={`/journeys/${j.journey_id}`}
                          className="inline-flex items-center gap-[5px] text-[12px] font-medium px-[9px] py-[3px] rounded-full bg-[#EEEDFE] text-[#3A2FAE] hover:bg-[#D7D4FB] transition-colors"
                          title={j.stage_name ? `${j.journey_name} · ${j.stage_name}` : j.journey_name}
                        >
                          {j.journey_name}
                          {j.stage_name && <span className="text-[10px] font-normal opacity-70">· {j.stage_name}</span>}
                        </Link>
                      ))}
                      {needsCollapse && (
                        <button
                          onClick={() => toggleCluster("journeys")}
                          className="text-[11px] font-medium px-[8px] py-[3px] rounded-full bg-bg-tertiary text-text-tertiary hover:bg-bg-hover transition-colors"
                        >
                          {isExpanded ? "show less" : `+${remaining} more`}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}

          {/* Territory cluster — every territory attached to this call */}
          {(call.callTerritories?.length ?? 0) > 0 ? (
            (() => {
              const items = call.callTerritories;
              const isExpanded = expandedClusters.has("territories");
              const needsCollapse = items.length >= COLLAPSE_THRESHOLD;
              const visible = needsCollapse && !isExpanded ? items.slice(0, 2) : items;
              const remaining = items.length - visible.length;
              return (
                <>
                  <div className="w-px h-8 bg-border-default" />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1">
                      {items.length === 1 ? "Territory" : `Territories (${items.length})`}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {visible.map((t) => (
                        <Link
                          key={t.TerritorySlug}
                          href={`/territories/${t.TerritorySlug}`}
                          className="inline-flex items-center gap-[5px] text-[12px] font-medium px-[9px] py-[3px] rounded-full bg-[#FAEEDA] text-[#633806] hover:bg-[#FAC775] transition-colors"
                        >
                          {t.Nickname}
                        </Link>
                      ))}
                      {needsCollapse && (
                        <button
                          onClick={() => toggleCluster("territories")}
                          className="text-[11px] font-medium px-[8px] py-[3px] rounded-full bg-bg-tertiary text-text-tertiary hover:bg-bg-hover transition-colors"
                        >
                          {isExpanded ? "show less" : `+${remaining} more`}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              );
            })()
          ) : call.TerritorySlug ? (
            <>
              <div className="w-px h-8 bg-border-default" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1">
                  Territory
                </div>
                <Link
                  href={`/territories/${call.TerritorySlug}`}
                  className="inline-flex items-center gap-[5px] text-[12px] font-medium px-[9px] py-[3px] rounded-full bg-[#FAEEDA] text-[#633806] hover:bg-[#FAC775] transition-colors"
                >
                  {call.territoryName ?? call.TerritorySlug}
                </Link>
              </div>
            </>
          ) : null}

          {/* Unknown participants — clickable inline mapping */}
          {call.unknownParticipants?.length > 0 &&
            (() => {
              const items = call.unknownParticipants;
              const isExpanded = expandedClusters.has("unknown");
              const needsCollapse = items.length >= COLLAPSE_THRESHOLD;
              const visible = needsCollapse && !isExpanded ? items.slice(0, 2) : items;
              const remaining = items.length - visible.length;
              return (
                <>
                  <div className="w-px h-8 bg-border-default" />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1">
                      Also present ({items.length})
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {visible.map((p) => (
                        <UnknownParticipantPill
                          key={p.email || p.name}
                          pillKey={p.email || p.name}
                          expandedPill={expandedPill}
                          onExpand={setExpandedPill}
                          participant={p}
                          callId={callId}
                          rawParticipant={
                            (call.rawParticipants ?? []).find((rp) => {
                              if (rp.email && p.email && rp.email.toLowerCase() === p.email.toLowerCase()) return true;
                              if (rp.display_name && p.name && rp.display_name.toLowerCase() === p.name.toLowerCase())
                                return true;
                              if (rp.email && p.name && p.name.toLowerCase() === rp.email.toLowerCase()) return true;
                              return false;
                            }) ?? null
                          }
                          primaryContactId={call.contact_id}
                          primaryContactName={call.contactName}
                          callTerritories={(call.callTerritories ?? []).map((t) => t.TerritorySlug)}
                          callJourneys={call.callJourneys ?? []}
                          onMapped={() => void fetchDetail()}
                        />
                      ))}
                      {needsCollapse && (
                        <button
                          onClick={() => toggleCluster("unknown")}
                          className="text-[11px] font-medium px-[8px] py-[3px] rounded-full bg-bg-tertiary text-text-tertiary hover:bg-bg-hover transition-colors"
                        >
                          {isExpanded ? "show less" : `+${remaining} more`}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
        </div>
      </div>

      {/* Prominent next-step hero — coaching instructions for the rep */}
      <NextStepHero
        actionItems={actionItems}
        onAction={() => void fetchDetail()}
        callTypeSlug={call.callTypeSlug}
        journeyStage={call.callJourneys?.[0]?.stage_name ?? null}
        contactName={call.contactName ?? call.linkedContacts?.[0]?.name ?? null}
        suggestedNextAction={rubricGrade?.suggested_next_action ?? null}
        nextCallPrep={call.coaching_data?.next_call_prep ?? null}
      />

      {/* 3-tab content */}
      <CallDetailTabs
        callId={callId}
        aiSummary={call.ai_summary}
        summaryBullets={call.summary_bullets}
        aiSummaryGeneratedAt={call.ai_summary_generated_at}
        coachingScore={call.coaching_score}
        coachingData={call.coaching_data}
        coachingGeneratedAt={call.coaching_generated_at}
        rawTranscript={transcript}
        hasTranscript={hasTranscript}
        recordingUrl={call.recording_url}
        meetingLink={call.meeting_link}
        durationSeconds={call.duration_seconds}
        startedAt={call.started_at}
        source={call.source}
        actionItems={actionItems}
        dataExtractions={dataExtractions}
        profileFieldCount={profileFieldCount}
        isGenerating={isGenerating}
        teamMembers={call.teamMembers ?? []}
        contactName={call.contactName}
        contactEmail={call.contactEmail}
        contactPhone={call.contactPhone}
        partnerOptions={buildPartnerOptions(call)}
        linkedContacts={(call.linkedContacts ?? []).map((c) => ({ id: c.id, name: c.name }))}
        callTerritories={(call.callTerritories ?? []).map((t) => ({
          TerritorySlug: t.TerritorySlug,
          Nickname: t.Nickname,
        }))}
        participantNames={buildSpeakerNames(call)}
        callTypeSlug={call.callTypeSlug}
        kbIntelItems={call.kb_intel_items ?? []}
        rubricGrade={rubricGrade}
        onRefresh={() => void fetchDetail()}
      />
    </div>
  );
}

// ─── Inline participant mapping ───────────────────────────────────────────

interface SearchResult {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  contactType?: string;
}

function UnknownParticipantPill({
  pillKey,
  expandedPill,
  onExpand,
  participant,
  callId,
  rawParticipant,
  primaryContactId,
  primaryContactName,
  callTerritories,
  callJourneys,
  onMapped,
}: {
  pillKey: string;
  expandedPill: string | null;
  onExpand: (key: string | null) => void;
  participant: UnknownParticipant;
  callId: string;
  rawParticipant: RawParticipant | null;
  primaryContactId: string | null;
  primaryContactName: string | null;
  callTerritories: string[];
  callJourneys: CallJourneyRef[];
  onMapped: () => void;
}) {
  const expanded = expandedPill === pillKey;
  const [mode, setMode] = useState<"actions" | "search" | "journey">("actions");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addModal, setAddModal] = useState<"prospect" | "ecosystem" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const autoName = participant.name.includes("@")
    ? participant.name
        .split("@")[0]
        .replace(/[._-]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : participant.name;

  // Leave blank so the rep must type the correct name — no autofill guessing
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const displayName = [editFirst, editLast].filter(Boolean).join(" ").trim() || autoName;

  const nameComplete = editFirst.trim().length > 0 && editLast.trim().length > 0;

  const prefill = {
    firstName: editFirst.trim() || undefined,
    lastName: editLast.trim() || undefined,
    email: participant.email || undefined,
    phone: editPhone || undefined,
  };

  // Dedupe journeys by journey_id for the picker
  const uniqueJourneys = callJourneys.filter((j, i, arr) => arr.findIndex((a) => a.journey_id === j.journey_id) === i);

  // Search contacts
  useEffect(() => {
    if (mode !== "search" || query.length < 2) {
      setResults([]);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const res = await apiFetch(`/api/contacts/search?q=${encodeURIComponent(query)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setResults((data.contacts ?? data.results ?? []) as SearchResult[]);
      }
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [mode, query]);

  useEffect(() => {
    if (mode === "search") inputRef.current?.focus();
  }, [mode]);

  async function mapToContact(contactId: string) {
    setBusy(true);
    setError(null);
    try {
      if (rawParticipant) {
        const res = await apiFetch(`/api/calls/${callId}/override`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participants: [{ id: rawParticipant.id, contact_id: contactId }] }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Override failed (${res.status})`);
        }
      } else {
        // No raw participant row found — try reclassify first, then set contact
        const reclRes = await apiFetch(`/api/calls/${callId}/reclassify-participants`, { method: "POST" });
        if (!reclRes.ok) {
          const data = await reclRes.json().catch(() => ({}));
          throw new Error(data.error ?? `Reclassify failed (${reclRes.status})`);
        }
        const ovRes = await apiFetch(`/api/calls/${callId}/override`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contact_id: contactId }),
        });
        if (!ovRes.ok) {
          const data = await ovRes.json().catch(() => ({}));
          throw new Error(data.error ?? `Override failed (${ovRes.status})`);
        }
      }
      if (participant.email) {
        await apiFetch(`/api/contacts/${contactId}/emails`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: participant.email, label: "auto" }),
        }).catch(() => {});
      }
      setDone(true);
      setTimeout(() => onMapped(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mapping failed");
    }
    setBusy(false);
  }

  /** Create contact from prefill, add to the chosen journey as co_primary, then map. */
  async function addToJourney(journeyId: string) {
    setBusy(true);
    try {
      // 1. Create contact (createJourney: false — they're joining an existing journey, not starting their own)
      const createRes = await apiFetch("/api/contacts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: prefill.firstName ?? "",
          lastName: prefill.lastName ?? "",
          email: prefill.email ?? "",
          opportunity_source: "Call Mapping",
          createJourney: false,
        }),
      });
      if (!createRes.ok) throw new Error("Failed to create contact");
      const { contactId: newContactId } = await createRes.json();
      // 2. Add to journey as co_primary
      await apiFetch(`/api/journeys/${journeyId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: newContactId, role: "co_primary" }),
      });
      // 3. Map the participant
      await mapToContact(newContactId);
    } catch {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-medium px-[8px] py-[3px] rounded-full bg-success/10 text-success border border-success/30">
        <Check size={12} /> {displayName} Mapped
      </span>
    );
  }

  if (!expanded) {
    return (
      <button
        onClick={() => onExpand(pillKey)}
        className="inline-flex items-center gap-[5px] text-[12px] font-medium px-[8px] py-[3px] rounded-full bg-bg-tertiary text-text-tertiary hover:bg-[#FAEEDA] hover:text-[#854F0B] border border-dashed border-border-default hover:border-[#EAB308]/40 transition-colors"
        title={`Click to map ${displayName}`}
      >
        <AlertTriangle size={10} />
        {displayName}
      </button>
    );
  }

  return (
    <div className="w-full mt-1 bg-bg-secondary border border-border-default rounded-lg p-3" style={{ minHeight: 140 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-body-sm font-medium text-text-primary">{displayName}</span>
          {participant.email && <span className="text-caption text-text-tertiary ml-1.5">{participant.email}</span>}
        </div>
        <button
          onClick={() => {
            onExpand(null);
            setMode("actions");
            setQuery("");
          }}
          className="btn-ghost p-1"
        >
          <X size={12} />
        </button>
      </div>

      {error && (
        <div className="text-caption text-danger bg-danger/10 border border-danger/30 rounded-md px-2 py-1 mb-2">
          {error}
        </div>
      )}

      {/* Editable name + phone fields */}
      {mode === "actions" && (
        <div className="grid grid-cols-3 gap-2 mb-2">
          <input
            type="text"
            value={editFirst}
            onChange={(e) => setEditFirst(e.target.value)}
            placeholder="First Name"
            className="bg-bg-primary border border-border-default rounded-md px-2 py-1 text-caption text-text-primary placeholder:text-text-tertiary"
          />
          <input
            type="text"
            value={editLast}
            onChange={(e) => setEditLast(e.target.value)}
            placeholder="Last Name"
            className="bg-bg-primary border border-border-default rounded-md px-2 py-1 text-caption text-text-primary placeholder:text-text-tertiary"
          />
          <input
            type="text"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            placeholder="Phone"
            className="bg-bg-primary border border-border-default rounded-md px-2 py-1 text-caption text-text-primary placeholder:text-text-tertiary"
          />
        </div>
      )}

      {mode === "actions" && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode("search")}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-border-default bg-bg-primary text-body-sm text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            <Search size={14} className="text-nah-blue" />
            <div className="text-left">
              <div className="font-medium">Match to Existing Contact</div>
              <div className="text-[10px] text-text-tertiary">Search by name, email, or phone</div>
            </div>
          </button>
          <button
            onClick={() => setAddModal("prospect")}
            disabled={!nameComplete}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-border-default bg-bg-primary text-body-sm text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <UserPlus size={14} className="text-success" />
            <div className="text-left">
              <div className="font-medium">New Prospect</div>
              <div className="text-[10px] text-text-tertiary">
                {nameComplete ? "Create Contact + Journey" : "Enter first & last name above"}
              </div>
            </div>
          </button>
          <button
            onClick={() => setAddModal("ecosystem")}
            disabled={!nameComplete}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-border-default bg-bg-primary text-body-sm text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MapPin size={14} className="text-nah-orange" />
            <div className="text-left">
              <div className="font-medium">Add To Ecosystem</div>
              <div className="text-[10px] text-text-tertiary">
                {nameComplete ? "Territory Or Contact Link" : "Enter first & last name above"}
              </div>
            </div>
          </button>
          <button
            onClick={() => setMode("journey")}
            disabled={uniqueJourneys.length === 0 || !nameComplete}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-border-default bg-bg-primary text-body-sm text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <GitBranch size={14} className="text-[#3A2FAE]" />
            <div className="text-left">
              <div className="font-medium">Add To Journey</div>
              <div className="text-[10px] text-text-tertiary">
                {uniqueJourneys.length > 0 ? "Join Existing Journey" : "No Journeys On Call"}
              </div>
            </div>
          </button>
        </div>
      )}

      {mode === "search" && (
        <div className="space-y-1">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, or phone..."
              className="w-full bg-bg-primary border border-border-default rounded-md pl-7 pr-8 py-1.5 text-caption text-text-primary placeholder:text-text-tertiary"
            />
            <button
              onClick={() => {
                setMode("actions");
                setQuery("");
                setResults([]);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
            >
              <X size={12} />
            </button>
          </div>
          <div className="bg-bg-primary border border-border-default rounded-md shadow-sm max-h-48 min-h-[40px] overflow-y-auto">
            {query.length < 2 ? (
              <div className="px-3 py-2 text-caption text-text-tertiary">Type to search...</div>
            ) : results.length > 0 ? (
              results.map((c) => (
                <button
                  key={c.id}
                  onClick={() => void mapToContact(c.id)}
                  disabled={busy}
                  className="w-full text-left px-3 py-2 text-body-sm hover:bg-bg-tertiary disabled:opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-text-primary font-medium">{c.name}</span>
                    {c.contactType && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary font-medium whitespace-nowrap">
                        {c.contactType}
                      </span>
                    )}
                  </div>
                  {(c.email || c.phone) && (
                    <div className="text-caption text-text-tertiary truncate">
                      {c.email ?? ""}
                      {c.email && c.phone ? " · " : ""}
                      {c.phone ?? ""}
                    </div>
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-caption text-text-tertiary">No Matches Found</div>
            )}
          </div>
          {busy && (
            <div className="flex items-center gap-2 text-caption text-text-tertiary">
              <Loader2 size={12} className="animate-spin" /> Mapping...
            </div>
          )}
        </div>
      )}

      {mode === "journey" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium">Select Journey</span>
            <button onClick={() => setMode("actions")} className="text-caption text-nah-blue hover:underline">
              Back
            </button>
          </div>
          <div className="space-y-1">
            {uniqueJourneys.map((j) => (
              <button
                key={j.journey_id}
                onClick={() => void addToJourney(j.journey_id)}
                disabled={busy}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-border-default bg-bg-primary text-body-sm text-text-primary hover:bg-[#EEEDFE] transition-colors disabled:opacity-50"
              >
                <GitBranch size={14} className="text-[#3A2FAE] flex-shrink-0" />
                <div className="text-left flex-1 min-w-0">
                  <div className="font-medium truncate">{j.journey_name}</div>
                  {j.stage_name && <div className="text-[10px] text-text-tertiary">{j.stage_name}</div>}
                </div>
                {busy && <Loader2 size={12} className="animate-spin text-text-tertiary" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <AddProspectModal
        open={addModal === "prospect"}
        prefill={prefill}
        onClose={() => setAddModal(null)}
        onCreated={(contactId) => {
          setAddModal(null);
          if (contactId) void mapToContact(contactId);
        }}
      />
      <AddRelatedContactModal
        open={addModal === "ecosystem"}
        primaryContactId={primaryContactId}
        primaryContactName={primaryContactName}
        callTerritorySlugs={callTerritories}
        existingContactId={null}
        prefill={prefill}
        onClose={() => setAddModal(null)}
        onCreated={(contactId) => {
          setAddModal(null);
          if (contactId) void mapToContact(contactId);
        }}
      />
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function getPlatformLabel(source: string | null): string {
  if (source === "read_ai" || source === "upload") return "Google Meet";
  if (source === "ghl_calendar") return "GHL Calendar";
  if (source === "manual") return "Manual Entry";
  return "Phone Call";
}

/**
 * Build speaker names in transcript order: Speaker 1 = host, Speaker 2 = contact.
 * Read.ai assigns Speaker 1 to the meeting owner (NAH team host) and
 * Speaker 2 to the guest. Silent observers (like Rylyn on Chad's calls)
 * are NOT included — they were invited but aren't speaking.
 */
/**
 * Partner options for the action-item reassign dropdown and the Data tab's
 * "Both primaries" option. A "partnership" = 2+ active primaries/co_primaries
 * on the SAME journey (Kevin + Kylie Kremer). Group calls with multiple
 * attendees on SEPARATE journeys (Brett + Michael + Nicki) return [] so the
 * UI doesn't falsely offer "Both."
 */
function buildPartnerOptions(call: CallDetail): { id: string; name: string }[] {
  return (call.partnershipPartners ?? []).map((p) => ({ id: p.id, name: p.name }));
}

function buildSpeakerNames(call: CallDetail): string[] {
  const names: string[] = [];

  // Speaker 1 = the host (NAH team member who ran the call)
  const host = call.hostName ?? call.teamMembers?.[0]?.name ?? null;
  if (host) names.push(host);

  // Speaker 2 = the contact/prospect on the call
  const contact = call.linkedContacts?.[0]?.name ?? call.contactName ?? null;
  if (contact) names.push(contact);

  return names;
}
