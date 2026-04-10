"use client";

/**
 * Call Detail Page — adapts to three contexts: prospect, coaching, group.
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, Loader2, FileText, Award, BookOpen,
  RefreshCw, ExternalLink, Sparkles, Users, MapPin, Upload, Video,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface CallDetail {
  id: string;
  contactName: string | null;
  contact_id: string | null;
  hostName: string | null;
  callTypeName: string | null;
  call_type_id: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  meeting_link: string | null;
  status: string;
  source: string | null;
  title: string | null;
  territory_ms_slug: string | null;
  territoryName: string | null;
  coach_user_id: string | null;
  coachName: string | null;
  participant_count: number | null;
  summary: string | null;
  action_items: { text: string; assignee_name?: string }[] | null;
  raw_transcript: string | null;
}

interface Transcript {
  id: string;
  full_text: string;
  word_count: number | null;
  source: string;
}

interface Grade {
  overall_grade: string;
  overall_score: number;
  criterion_scores: { name: string; grade: string; score: number; rationale: string }[];
  strengths: string[];
  improvements: string[];
  suggested_next_action: string;
}

interface Coaching {
  coaching_notes: string;
  coaching_plan: string;
}

type Tab = "overview" | "transcript" | "grade" | "coaching" | "brief";

type CallContext = "prospect" | "coaching" | "group";

const GRADE_COLORS: Record<string, string> = {
  A: "text-success bg-success/10",
  B: "text-nah-blue bg-nah-blue/10",
  C: "text-warning bg-warning/10",
  D: "text-nah-orange bg-nah-orange/10",
  F: "text-danger bg-danger/10",
};

function getCallContext(call: CallDetail): CallContext {
  if (call.territory_ms_slug && call.coach_user_id) return "coaching";
  if (call.participant_count && call.participant_count >= 3) return "group";
  return "prospect";
}

export default function CallDetailPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params.callId as string;

  const [call, setCall] = useState<CallDetail | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [coaching, setCoaching] = useState<Coaching | null>(null);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const [pasteText, setPasteText] = useState("");
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [grading, setGrading] = useState(false);
  const [coaching2, setCoaching2] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/calls/${callId}/detail`);
      if (res.ok) {
        const data = await res.json();
        setCall(data.call);
        setTranscript(data.transcript);
        setGrade(data.grade);
        setCoaching(data.coaching);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [callId]);

  useEffect(() => { void fetchDetail(); }, [fetchDetail]);

  async function handlePasteTranscript() {
    if (!pasteText.trim()) return;
    setSavingTranscript(true);
    setError(null);
    try {
      const res = await fetch(`/api/calls/${callId}/transcript`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "manual_paste", text: pasteText }),
      });
      if (res.ok) { setPasteText(""); toast("Transcript saved"); await fetchDetail(); }
      else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed"); }
    } catch { setError("Network error"); }
    setSavingTranscript(false);
  }

  async function handleGrade() {
    setGrading(true); setError(null);
    try {
      const res = await fetch(`/api/calls/${callId}/grade-rubric`, { method: "POST" });
      if (res.ok) { toast("Call graded"); await fetchDetail(); }
      else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Grading failed"); }
    } catch { setError("Grading failed"); }
    setGrading(false);
  }

  async function handleCoach() {
    setCoaching2(true); setError(null);
    try {
      const res = await fetch(`/api/calls/${callId}/coach`, { method: "POST" });
      if (res.ok) { toast("Coaching generated"); await fetchDetail(); }
      else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Coaching failed"); }
    } catch { setError("Coaching failed"); }
    setCoaching2(false);
  }

  async function handleBrief() {
    if (!call?.contact_id) return;
    setBriefLoading(true);
    try {
      const url = `/api/contacts/${call.contact_id}/pre-call-brief${call.call_type_id ? `?callTypeId=${call.call_type_id}` : ""}`;
      const res = await fetch(url);
      if (res.ok) { const d = await res.json(); setBrief(d.brief); }
    } catch { /* silent */ }
    setBriefLoading(false);
  }

  async function handleFileUpload(file: File) {
    setUploading(true); setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      form.append("type", ext === "txt" ? "transcript" : "recording");
      const res = await fetch(`/api/calls/${callId}/upload`, { method: "POST", body: form });
      if (res.ok) {
        const d = await res.json();
        toast(d.type === "transcript" ? `Transcript uploaded (${d.wordCount} words)` : "Recording uploaded");
        await fetchDetail();
      } else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Upload failed"); }
    } catch { setError("Upload failed"); }
    setUploading(false);
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-text-tertiary" /></div>;
  if (!call) return <div className="text-center py-16 text-text-tertiary">Call not found</div>;

  const ctx = getCallContext(call);

  const TABS: { key: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { key: "overview", label: "Overview", icon: Phone },
    { key: "transcript", label: "Transcript", icon: FileText },
    { key: "grade", label: ctx === "group" ? "Metrics" : "Grade", icon: Award },
    { key: "coaching", label: "Coaching", icon: BookOpen },
    ...(ctx === "prospect" ? [{ key: "brief" as const, label: "Pre-call Brief", icon: Sparkles }] : []),
  ];

  return (
    <div className="flex flex-col min-h-0">
      {/* Header — adapts to call context */}
      <div className="flex items-center gap-3 px-1 py-3 flex-shrink-0">
        <button onClick={() => router.back()} className="btn-ghost p-1.5"><ArrowLeft size={18} /></button>
        <div className="flex-1 min-w-0">
          {ctx === "coaching" ? (
            <>
              <h1 className="font-headline text-page-title text-text-primary truncate">
                {call.territoryName ?? call.territory_ms_slug ?? "Coaching Call"}
              </h1>
              <div className="flex items-center gap-3 mt-0.5 text-caption text-text-tertiary">
                <span className="flex items-center gap-1"><MapPin size={10} /> {call.territoryName}</span>
                {call.contactName && <span>{call.contactName}</span>}
                {call.coachName && <span>Coach: {call.coachName}</span>}
                {call.duration_seconds && <span>{Math.round(call.duration_seconds / 60)}m</span>}
                {grade && <span className={`px-2 py-0.5 rounded text-xs font-bold ${GRADE_COLORS[grade.overall_grade] ?? ""}`}>{grade.overall_grade}</span>}
              </div>
            </>
          ) : ctx === "group" ? (
            <>
              <h1 className="font-headline text-page-title text-text-primary truncate">
                {call.title ?? "Group Call"}
              </h1>
              <div className="flex items-center gap-3 mt-0.5 text-caption text-text-tertiary">
                <span className="flex items-center gap-1"><Users size={10} /> {call.participant_count ?? 0} participants</span>
                {call.started_at && <span>{new Date(call.started_at).toLocaleString()}</span>}
                {call.duration_seconds && <span>{Math.round(call.duration_seconds / 60)}m</span>}
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-scout-purple/10 text-scout-purple">Group</span>
              </div>
            </>
          ) : (
            <>
              <h1 className="font-headline text-page-title text-text-primary truncate">
                {call.callTypeName ?? "Call"}{call.contactName ? ` — ${call.contactName}` : ""}
              </h1>
              <div className="flex items-center gap-3 mt-0.5 text-caption text-text-tertiary">
                {call.hostName && <span>Host: {call.hostName}</span>}
                {call.scheduled_at && <span>{new Date(call.scheduled_at).toLocaleString()}</span>}
                {call.duration_seconds && <span>{Math.round(call.duration_seconds / 60)}m</span>}
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  call.status === "completed" ? "bg-success/10 text-success" :
                  call.status === "scheduled" ? "bg-info/10 text-info" :
                  call.status === "missed" ? "bg-danger/10 text-danger" : "bg-text-tertiary/10 text-text-tertiary"
                }`}>{call.status}</span>
                {grade && <span className={`px-2 py-0.5 rounded text-xs font-bold ${GRADE_COLORS[grade.overall_grade] ?? ""}`}>{grade.overall_grade}</span>}
              </div>
            </>
          )}
        </div>
        {call.meeting_link && (
          <a href={call.meeting_link} target="_blank" rel="noopener noreferrer"
            className="btn-primary px-3 py-1.5 text-caption flex items-center gap-1">
            <ExternalLink size={12} /> Join Meet
          </a>
        )}
        {call.contact_id && <a href={`/leads/${call.contact_id}`} className="btn-ghost px-3 py-1.5 text-caption">View Contact</a>}
        {call.territory_ms_slug && <a href={`/territories/${call.territory_ms_slug}`} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3 py-1.5 text-caption">View Territory</a>}
        <button onClick={() => void fetchDetail()} className="btn-ghost p-1.5"><RefreshCw size={14} /></button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-default px-1 flex-shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-body-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key ? "border-nah-orange text-nah-orange" : "border-transparent text-text-tertiary hover:text-text-primary"
              }`}>
              <Icon size={14} />{tab.label}
            </button>
          );
        })}
      </div>

      {error && <div className="mx-4 mt-3 px-3 py-2 bg-danger/10 border border-danger/20 rounded-lg text-body-sm text-danger">{error}</div>}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "overview" && (
          <div className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-2 gap-3 text-body-sm">
              {ctx === "coaching" ? (
                <>
                  <div><span className="text-text-tertiary">Territory</span><p className="text-text-primary font-medium">{call.territoryName ?? "—"}</p></div>
                  <div><span className="text-text-tertiary">Franchisee</span><p className="text-text-primary">{call.contactName ?? "—"}</p></div>
                  <div><span className="text-text-tertiary">Coach</span><p className="text-text-primary">{call.coachName ?? "—"}</p></div>
                  <div><span className="text-text-tertiary">Date</span><p className="text-text-primary">{call.started_at ? new Date(call.started_at).toLocaleString() : "—"}</p></div>
                </>
              ) : ctx === "group" ? (
                <>
                  <div><span className="text-text-tertiary">Title</span><p className="text-text-primary font-medium">{call.title ?? "—"}</p></div>
                  <div><span className="text-text-tertiary">Participants</span><p className="text-text-primary">{call.participant_count ?? "—"}</p></div>
                  <div><span className="text-text-tertiary">Date</span><p className="text-text-primary">{call.started_at ? new Date(call.started_at).toLocaleString() : "—"}</p></div>
                  <div><span className="text-text-tertiary">Duration</span><p className="text-text-primary">{call.duration_seconds ? `${Math.round(call.duration_seconds / 60)} min` : "—"}</p></div>
                </>
              ) : (
                <>
                  <div><span className="text-text-tertiary">Contact</span><p className="text-text-primary font-medium">{call.contactName ?? "—"}</p></div>
                  <div><span className="text-text-tertiary">Call Type</span><p className="text-text-primary">{call.callTypeName ?? "—"}</p></div>
                  <div><span className="text-text-tertiary">Host</span><p className="text-text-primary">{call.hostName ?? "—"}</p></div>
                  <div><span className="text-text-tertiary">Status</span><p className="text-text-primary capitalize">{call.status}</p></div>
                  <div><span className="text-text-tertiary">Scheduled</span><p className="text-text-primary">{call.scheduled_at ? new Date(call.scheduled_at).toLocaleString() : "—"}</p></div>
                  <div><span className="text-text-tertiary">Duration</span><p className="text-text-primary">{call.duration_seconds ? `${Math.round(call.duration_seconds / 60)} min` : "—"}</p></div>
                </>
              )}
            </div>

            {/* Summary (from Read.ai) */}
            {call.summary && (
              <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
                <h3 className="text-overline text-text-tertiary tracking-wider mb-2">SUMMARY</h3>
                <p className="text-body-sm text-text-primary whitespace-pre-wrap">{call.summary}</p>
              </div>
            )}

            {/* Action Items (from Read.ai) */}
            {call.action_items && (call.action_items as { text: string }[]).length > 0 && (
              <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
                <h3 className="text-overline text-text-tertiary tracking-wider mb-2">ACTION ITEMS</h3>
                <ul className="space-y-1.5">
                  {(call.action_items as { text: string; assignee_name?: string }[]).map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-body-sm">
                      <span className="text-nah-blue mt-0.5">-</span>
                      <span className="text-text-primary">{item.text}</span>
                      {item.assignee_name && <span className="text-text-tertiary text-caption ml-auto flex-shrink-0">({item.assignee_name})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <span className={`text-caption ${transcript ? "text-success" : "text-text-tertiary"}`}>{transcript ? "Has transcript" : "No transcript"}</span>
              <span className={`text-caption ${grade ? "text-success" : "text-text-tertiary"}`}>{grade ? `Grade: ${grade.overall_grade}` : "Not graded"}</span>
              <span className={`text-caption ${coaching ? "text-success" : "text-text-tertiary"}`}>{coaching ? "Has coaching" : "No coaching"}</span>
              {call.source === "read_ai" && <span className="text-caption text-scout-purple">via Read.ai</span>}
            </div>
          </div>
        )}

        {activeTab === "transcript" && (
          <div>
            {transcript ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-caption text-text-tertiary">Source: {transcript.source} | {transcript.word_count ?? 0} words</span>
                </div>
                <div className="bg-bg-secondary border border-border-default rounded-lg p-4 max-h-[60vh] overflow-y-auto">
                  <p className="text-body-sm text-text-primary whitespace-pre-wrap">{transcript.full_text}</p>
                </div>
              </div>
            ) : call.raw_transcript ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-caption text-text-tertiary">From Read.ai</span>
                </div>
                <div className="bg-bg-secondary border border-border-default rounded-lg p-4 max-h-[60vh] overflow-y-auto">
                  <p className="text-body-sm text-text-primary whitespace-pre-wrap">{call.raw_transcript}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* File upload */}
                <div className="border-2 border-dashed border-border-default rounded-lg p-6 text-center">
                  <Upload size={24} className="mx-auto text-text-tertiary mb-2" />
                  <p className="text-body-sm text-text-primary font-medium mb-1">Upload transcript or recording</p>
                  <p className="text-caption text-text-tertiary mb-3">.txt transcript or .mp4/.webm recording</p>
                  <label className="btn-primary px-4 py-2 text-body-sm cursor-pointer inline-flex items-center gap-1">
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploading ? "Uploading..." : "Choose File"}
                    <input type="file" accept=".txt,.mp4,.webm,.m4a,.mp3,.wav" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFileUpload(f); }} disabled={uploading} />
                  </label>
                </div>

                {/* Or paste */}
                <div className="relative">
                  <div className="absolute inset-x-0 top-1/2 border-t border-border-default" />
                  <span className="relative bg-bg-primary px-3 text-caption text-text-tertiary left-1/2 -translate-x-1/2">or paste transcript</span>
                </div>
                <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste call transcript here..."
                  className="w-full bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary resize-none"
                  rows={8} disabled={savingTranscript} />
                <button onClick={() => void handlePasteTranscript()} disabled={savingTranscript || !pasteText.trim()}
                  className="btn-primary px-4 py-2 text-body-sm flex items-center gap-1">
                  {savingTranscript && <Loader2 size={14} className="animate-spin" />} Save Transcript
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "grade" && (
          <div>
            {ctx === "group" ? (
              /* Group calls: no grade, show Read.ai engagement metrics */
              <div className="space-y-4 max-w-lg">
                <h3 className="text-overline text-text-tertiary tracking-wider">ENGAGEMENT METRICS</h3>
                <p className="text-caption text-text-tertiary">Metrics from Read.ai for this group call.</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-bg-secondary border border-border-default rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-text-primary">—</div>
                    <div className="text-caption text-text-tertiary">Read Score</div>
                  </div>
                  <div className="bg-bg-secondary border border-border-default rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-text-primary">—</div>
                    <div className="text-caption text-text-tertiary">Sentiment</div>
                  </div>
                  <div className="bg-bg-secondary border border-border-default rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-text-primary">—</div>
                    <div className="text-caption text-text-tertiary">Engagement</div>
                  </div>
                </div>
                <p className="text-[10px] text-text-tertiary">Engagement data will populate when Read.ai provides metrics.</p>
              </div>
            ) : grade ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className={`text-3xl font-bold px-4 py-2 rounded-lg ${GRADE_COLORS[grade.overall_grade] ?? ""}`}>{grade.overall_grade}</span>
                  <span className="text-h2 text-text-primary">{grade.overall_score}/100</span>
                </div>
                {grade.criterion_scores?.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-overline text-text-tertiary tracking-wider">CRITERIA</h3>
                    {grade.criterion_scores.map((cs, i) => (
                      <div key={i} className="bg-bg-secondary border border-border-default rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${GRADE_COLORS[cs.grade] ?? ""}`}>{cs.grade}</span>
                          <span className="text-body-sm font-medium text-text-primary">{cs.name}</span>
                          <span className="text-caption text-text-tertiary ml-auto">{cs.score}/100</span>
                        </div>
                        <p className="text-caption text-text-secondary">{cs.rationale}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-overline text-text-tertiary tracking-wider mb-2">STRENGTHS</h3>
                    <ul className="space-y-1">{(grade.strengths ?? []).map((s, i) => <li key={i} className="text-caption text-success">+ {s}</li>)}</ul>
                  </div>
                  <div>
                    <h3 className="text-overline text-text-tertiary tracking-wider mb-2">IMPROVEMENTS</h3>
                    <ul className="space-y-1">{(grade.improvements ?? []).map((s, i) => <li key={i} className="text-caption text-warning">- {s}</li>)}</ul>
                  </div>
                </div>
                {grade.suggested_next_action && (
                  <div className="bg-nah-blue/5 border border-nah-blue/20 rounded-lg p-3">
                    <span className="text-caption font-medium text-nah-blue">Suggested Next Action</span>
                    <p className="text-body-sm text-text-primary mt-1">{grade.suggested_next_action}</p>
                  </div>
                )}
                <button onClick={() => void handleGrade()} disabled={grading}
                  className="btn-ghost px-3 py-1.5 text-caption flex items-center gap-1">
                  {grading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Re-grade
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-body-sm text-text-tertiary mb-3">{transcript || call.raw_transcript ? "Ready to grade this call." : "Upload a transcript first."}</p>
                <button onClick={() => void handleGrade()} disabled={grading || (!transcript && !call.raw_transcript)}
                  className="btn-primary px-4 py-2 text-body-sm flex items-center gap-1 mx-auto">
                  {grading ? <Loader2 size={14} className="animate-spin" /> : <Award size={14} />} Grade with Scout
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "coaching" && (
          <div>
            {coaching ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-overline text-text-tertiary tracking-wider mb-2">
                    {ctx === "coaching" ? "COACHING QUALITY FEEDBACK" : ctx === "group" ? "KEY THEMES" : "COACHING NOTES"}
                  </h3>
                  <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
                    <p className="text-body-sm text-text-primary whitespace-pre-wrap">{coaching.coaching_notes}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-overline text-text-tertiary tracking-wider mb-2">
                    {ctx === "coaching" ? "COACHING PLAN" : "ACTION PLAN"}
                  </h3>
                  <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
                    <p className="text-body-sm text-text-primary whitespace-pre-wrap">{coaching.coaching_plan}</p>
                  </div>
                </div>
                <button onClick={() => void handleCoach()} disabled={coaching2}
                  className="btn-ghost px-3 py-1.5 text-caption flex items-center gap-1">
                  {coaching2 ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Regenerate
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-body-sm text-text-tertiary mb-3">
                  {transcript || call.raw_transcript ? "Ready to generate coaching." : "Upload a transcript first."}
                </p>
                <button onClick={() => void handleCoach()} disabled={coaching2 || (!transcript && !call.raw_transcript)}
                  className="btn-primary px-4 py-2 text-body-sm flex items-center gap-1 mx-auto">
                  {coaching2 ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />} Generate Coaching
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "brief" && ctx === "prospect" && (
          <div>
            {brief ? (
              <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
                <p className="text-body-sm text-text-primary whitespace-pre-wrap">{brief}</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-body-sm text-text-tertiary mb-3">Generate a pre-call brief for this contact.</p>
                <button onClick={() => void handleBrief()} disabled={briefLoading || !call.contact_id}
                  className="btn-primary px-4 py-2 text-body-sm flex items-center gap-1 mx-auto">
                  {briefLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Generate Brief
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
