"use client";

/**
 * Call Detail Page — 3-tab layout: Overview, Next Steps, Data.
 * Header section (title, tags, team, contacts) preserved.
 * Tab content powered by CallDetailTabs component.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import CallDetailTabs from "@/components/calls/CallDetailTabs";

interface TeamMember { id: string; name: string; email: string }
interface LinkedContact { id: string | null; name: string; email: string; role: string; linked: boolean }
interface UnknownParticipant { name: string; email: string }

interface CoachingData {
  score: number;
  label: string;
  went_well: string[];
  watch_out: string[];
  next_call_prep: string;
}

interface CallDetail {
  id: string;
  contactName: string | null;
  contact_id: string | null;
  hostName: string | null;
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
  territory_ms_slug: string | null;
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
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/calls/${callId}/detail`);
      if (res.ok) {
        const data = await res.json();
        setCall(data.call);
        setTranscript(data.transcript ?? null);
        setActionItems(data.actionItems ?? []);
        setDataExtractions(data.dataExtractions ?? []);
        setProfileFieldCount(data.profileFieldCount ?? 0);
        return data;
      }
    } catch { /* silent */ }
    setLoading(false);
    return null;
  }, [callId]);

  useEffect(() => {
    void (async () => {
      await fetchDetail();
      setLoading(false);
    })();
  }, [fetchDetail]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  /** Called by CallGenerateButton after POST /generate succeeds */
  const handleGenerateStart = useCallback(() => {
    setIsGenerating(true);
    setGenerationError(null);

    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      const data = await fetchDetail();
      if (data?.call?.ai_summary_generated_at) {
        // Generation complete — data is now loaded via fetchDetail
        setIsGenerating(false);
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
      } else if (attempts >= 10) {
        setIsGenerating(false);
        setGenerationError("Generation is taking longer than expected. Try refreshing.");
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 3000);
  }, [fetchDetail]);

  /** Called by CallGenerateButton if POST /generate returns an error */
  const handleGenerateError = useCallback((errorMsg: string) => {
    setIsGenerating(false);
    setGenerationError(errorMsg);
  }, []);

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

  return (
    <div>
      {/* ═══ HEADER ═══ */}
      <div className="mb-5 space-y-3">
        {/* Row 1 — Back + Title + Refresh */}
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="btn-ghost p-1.5">
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-headline text-page-title text-text-primary truncate flex-1">
            {call.title ?? "Call"}
          </h1>
          <button onClick={() => void fetchDetail()} className="btn-ghost p-1.5 flex-shrink-0">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Row 2 — Call metadata */}
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          {call.callTypeName && (
            <span className="px-[9px] py-[3px] rounded-full font-medium bg-[#F1EFE8] text-[#5F5E5A]">
              {call.callTypeName}
            </span>
          )}
          <span className={`px-[9px] py-[3px] rounded-full font-medium capitalize ${
            call.status === "completed" ? "bg-success/10 text-success" :
            call.status === "scheduled" ? "bg-info/10 text-info" :
            call.status === "missed" ? "bg-danger/10 text-danger" :
            "bg-[#F1EFE8] text-[#5F5E5A]"
          }`}>
            {call.status}
          </span>

          <span className="inline-block w-px h-3 bg-border-default" />

          <span className="text-text-tertiary font-normal">
            {(call.started_at ?? call.scheduled_at)
              ? new Date(call.started_at ?? call.scheduled_at!).toLocaleString([], {
                  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                })
              : "—"}
            {call.duration_seconds ? ` · ${Math.round(call.duration_seconds / 60)} min` : ""}
          </span>

          <span className="inline-block w-px h-3 bg-border-default" />

          <span className="px-[9px] py-[3px] rounded-full font-medium bg-[#E6F1FB] text-[#185FA5]">
            {getPlatformLabel(call.source)}
          </span>
        </div>

        {/* Row 3 — People + Territory */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Team cluster */}
          {call.teamMembers?.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1">Team</div>
              <div className="flex items-center gap-1.5">
                {call.teamMembers.map((m) => (
                  <div key={m.id} className="flex items-center gap-[5px] text-[12px] font-medium px-[8px] py-[3px] rounded-full bg-[#F1EFE8] text-[#444441]">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium bg-[#EEEDFE] text-[#534AB7]">
                      {initials(m.name)}
                    </div>
                    {m.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Divider */}
          {(call.teamMembers?.length > 0 && (call.linkedContacts?.length > 0 || call.contactName)) && (
            <div className="w-px h-8 bg-border-default" />
          )}

          {/* Contact cluster */}
          {call.linkedContacts?.length > 0 ? (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1">Contact</div>
              <div className="flex items-center gap-1.5">
                {call.linkedContacts.map((c) =>
                  c.linked && c.id ? (
                    <Link key={c.id} href={`/leads/${c.id}`}
                      className="flex items-center gap-[5px] text-[12px] font-medium px-[8px] py-[3px] rounded-full bg-[#E6F1FB] text-[#0C447C] hover:bg-[#B5D4F4] transition-colors">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium bg-[#D4E8F9] text-[#185FA5]">
                        {initials(c.name)}
                      </div>
                      {c.name}
                    </Link>
                  ) : (
                    <div key={c.email}
                      className="flex items-center gap-[5px] text-[12px] font-medium px-[8px] py-[3px] rounded-full bg-[#FAEEDA] text-[#633806]"
                      title={`${c.email} — not in system`}>
                      <AlertTriangle size={12} />
                      {c.name}
                    </div>
                  )
                )}
              </div>
            </div>
          ) : call.contactName ? (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1">Contact</div>
              <Link href={`/leads/${call.contact_id}`}
                className="flex items-center gap-[5px] text-[12px] font-medium px-[8px] py-[3px] rounded-full bg-[#E6F1FB] text-[#0C447C] hover:bg-[#B5D4F4] transition-colors">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium bg-[#D4E8F9] text-[#185FA5]">
                  {initials(call.contactName)}
                </div>
                {call.contactName}
              </Link>
            </div>
          ) : null}

          {/* Territory cluster — only if set */}
          {call.territory_ms_slug && (
            <>
              <div className="w-px h-8 bg-border-default" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1">Territory</div>
                <Link href={`/territories/${call.territory_ms_slug}`}
                  className="inline-flex items-center gap-[5px] text-[12px] font-medium px-[9px] py-[3px] rounded-full bg-[#FAEEDA] text-[#633806] hover:bg-[#FAC775] transition-colors">
                  {call.territoryName ?? call.territory_ms_slug}
                </Link>
              </div>
            </>
          )}

          {/* Unknown participants */}
          {call.unknownParticipants?.length > 0 && (
            <>
              <div className="w-px h-8 bg-border-default" />
              <div className="text-[11px] text-text-tertiary">
                Also present: {call.unknownParticipants.map((p) => p.name).join(", ")}
              </div>
            </>
          )}
        </div>
      </div>

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
        generationError={generationError}
        teamMembers={(call.teamMembers ?? []).map((m) => ({ id: m.id, name: m.name }))}
        contactName={call.contactName}
        participantNames={buildSpeakerNames(call)}
        onGenerateStart={handleGenerateStart}
        onGenerateError={handleGenerateError}
        onRefresh={() => void fetchDetail()}
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
  if (source === "read_ai") return "Google Meet";
  return "Phone Call";
}

/**
 * Build speaker names in transcript order: Speaker 1 = host, Speaker 2 = contact.
 * Read.ai assigns Speaker 1 to the meeting owner (NAH team host) and
 * Speaker 2 to the guest. Silent observers (like Rylyn on Chad's calls)
 * are NOT included — they were invited but aren't speaking.
 */
function buildSpeakerNames(call: CallDetail): string[] {
  const names: string[] = [];

  // Speaker 1 = the host (NAH team member who ran the call)
  const host = call.hostName
    ?? call.teamMembers?.[0]?.name
    ?? null;
  if (host) names.push(host);

  // Speaker 2 = the contact/prospect on the call
  const contact = call.linkedContacts?.[0]?.name
    ?? call.contactName
    ?? null;
  if (contact) names.push(contact);

  return names;
}
