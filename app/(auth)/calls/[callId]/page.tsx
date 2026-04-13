"use client";

/**
 * Call Detail Page — 3-tab layout: Overview, Next Steps, Data.
 * Header section (title, tags, team, contacts) preserved.
 * Tab content powered by CallDetailTabs component.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw, ExternalLink, MapPin } from "lucide-react";
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
  source: string;
  ghl_action: boolean;
  status: string;
  contact_id: string | null;
  pushed_at: string | null;
  skipped_at: string | null;
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
      {/* Header — preserved from original */}
      <div className="flex items-start gap-3 mb-4">
        <button onClick={() => router.back()} className="btn-ghost p-1.5 mt-0.5">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-headline text-page-title text-text-primary truncate">
            {call.title ?? "Call"}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            {call.callTypeName && (
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-nah-blue/10 text-nah-blue">
                {call.callTypeName}
              </span>
            )}
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
              call.status === "completed" ? "bg-success/10 text-success" :
              call.status === "scheduled" ? "bg-info/10 text-info" :
              call.status === "missed" ? "bg-danger/10 text-danger" :
              "bg-bg-tertiary text-text-tertiary"
            }`}>
              {call.status}
            </span>
            {call.territoryName && (
              <a href={`/territories/${call.territory_ms_slug}`}
                className="flex items-center gap-1 text-caption text-nah-blue hover:underline">
                <MapPin size={10} />{call.territoryName}
              </a>
            )}
            <span className="text-caption text-text-tertiary">
              {(call.started_at ?? call.scheduled_at)
                ? new Date(call.started_at ?? call.scheduled_at!).toLocaleString([], {
                    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                  })
                : "—"}
            </span>
            {call.duration_seconds ? (
              <span className="text-caption text-text-tertiary">
                {Math.round(call.duration_seconds / 60)} min
              </span>
            ) : null}
            {call.source === "read_ai" && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">Read.ai</span>
            )}
          </div>

          {/* People */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            {call.teamMembers?.length > 0 && (
              <div className="flex items-center gap-1.5 text-caption">
                <span className="text-text-tertiary font-medium">Team:</span>
                {call.teamMembers.map((m, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-nah-orange/10 text-nah-orange text-[11px] font-medium">
                    {m.name}
                  </span>
                ))}
              </div>
            )}
            {!call.teamMembers?.length && call.hostName && (
              <div className="flex items-center gap-1.5 text-caption">
                <span className="text-text-tertiary font-medium">Host:</span>
                <span className="px-2 py-0.5 rounded-full bg-nah-orange/10 text-nah-orange text-[11px] font-medium">
                  {call.hostName}
                </span>
              </div>
            )}
            {/* Linked contacts (prospect / franchisee) */}
            {call.linkedContacts?.length > 0 && (
              <div className="flex items-center gap-1.5 text-caption">
                <span className="text-text-tertiary font-medium">Contacts:</span>
                {call.linkedContacts.map((p, i) =>
                  p.linked && p.id ? (
                    <a key={i} href={`/leads/${p.id}`}
                      className="px-2 py-0.5 rounded-full bg-nah-blue/10 text-nah-blue text-[11px] font-medium hover:underline">
                      {p.name}
                    </a>
                  ) : (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-warning/10 text-warning text-[11px] font-medium"
                      title={`${p.email} — not in system`}>
                      {p.name} ⚠
                    </span>
                  )
                )}
              </div>
            )}
            {/* Fallback: use contact_id if no linkedContacts */}
            {!call.linkedContacts?.length && call.contactName && (
              <div className="flex items-center gap-1.5 text-caption">
                <span className="text-text-tertiary font-medium">Contact:</span>
                <a href={`/leads/${call.contact_id}`}
                  className="px-2 py-0.5 rounded-full bg-nah-blue/10 text-nah-blue text-[11px] font-medium hover:underline">
                  {call.contactName}
                </a>
              </div>
            )}
            {/* Unknown participants */}
            {call.unknownParticipants?.length > 0 && (
              <div className="flex items-center gap-1.5 text-caption">
                <span className="text-text-tertiary">Also present:</span>
                <span className="text-text-tertiary text-[11px]">
                  {call.unknownParticipants.map((p) => p.name).join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {call.meeting_link && (
            <a href={call.meeting_link} target="_blank" rel="noopener noreferrer"
              className="btn-primary px-3 py-1.5 text-caption flex items-center gap-1">
              <ExternalLink size={12} /> Join
            </a>
          )}
          <button onClick={() => void fetchDetail()} className="btn-ghost p-1.5">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* 3-tab content */}
      <CallDetailTabs
        callId={callId}
        aiSummary={call.ai_summary}
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
        onGenerateStart={handleGenerateStart}
        onGenerateError={handleGenerateError}
        onRefresh={() => void fetchDetail()}
      />
    </div>
  );
}
