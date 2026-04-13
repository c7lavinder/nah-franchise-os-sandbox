"use client";

import { useState, useMemo } from "react";
import { ExternalLink, Video, Loader2, AlertCircle, Copy, ChevronDown, ChevronUp } from "lucide-react";
import CallGenerateButton from "./CallGenerateButton";

interface DimensionScores {
  discovery: number;
  capital: number;
  relationship: number;
  process_clarity: number;
  objection_surfacing: number;
  momentum: number;
}

interface CoachingData {
  score: number;
  label: string;
  went_well: string[];
  watch_out: string[];
  next_call_prep: string;
  dimension_scores?: DimensionScores;
}

const DIMENSIONS: { key: keyof DimensionScores; label: string; max: number }[] = [
  { key: "discovery", label: "Discovery", max: 20 },
  { key: "capital", label: "Capital", max: 20 },
  { key: "relationship", label: "Relationship", max: 15 },
  { key: "objection_surfacing", label: "Objection Surfacing", max: 15 },
  { key: "process_clarity", label: "Process Clarity", max: 15 },
  { key: "momentum", label: "Momentum", max: 15 },
];

interface CallOverviewTabProps {
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
  isGenerating: boolean;
  generationError: string | null;
  participantNames: string[];
  onGenerateStart: () => void;
  onGenerateError: (msg: string) => void;
  onRefresh: () => void;
}

type GenState = "no_transcript" | "ready" | "generating" | "complete" | "error";

function getState(props: CallOverviewTabProps): GenState {
  if (!props.hasTranscript) return "no_transcript";
  if (props.isGenerating) return "generating";
  if (props.generationError) return "error";
  if (props.aiSummary) return "complete";
  return "ready";
}

function ScoreCircle({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-success border-success/30 bg-success/5" :
    score >= 60 ? "text-nah-blue border-nah-blue/30 bg-nah-blue/5" :
    score >= 40 ? "text-warning border-warning/30 bg-warning/5" :
    "text-danger border-danger/30 bg-danger/5";

  return (
    <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${color}`}>
      <span className="text-xl font-bold">{score}</span>
    </div>
  );
}

export default function CallOverviewTab(props: CallOverviewTabProps) {
  const state = getState(props);
  const hasGenerated = !!props.aiSummaryGeneratedAt;
  const [showFullSummary, setShowFullSummary] = useState(false);
  const [showAllTranscript, setShowAllTranscript] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isCoachingGenerating, setIsCoachingGenerating] = useState(false);

  const handleGenerateCoaching = async () => {
    setIsCoachingGenerating(true);
    try {
      const res = await fetch(`/api/calls/${props.callId}/coach`, { method: "POST" });
      if (res.ok) {
        props.onRefresh();
      }
    } catch { /* silent — refresh will show current state */ }
    finally { setIsCoachingGenerating(false); }
  };

  const parsedTranscript = useMemo(
    () => parseTranscriptLines(props.rawTranscript ?? "", props.participantNames),
    [props.rawTranscript, props.participantNames],
  );

  const visibleTranscript = showAllTranscript ? parsedTranscript : parsedTranscript.slice(0, 5);

  const handleCopyTranscript = async () => {
    const text = parsedTranscript.map((t) => `${t.speaker}: ${t.text}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Generate / Regenerate button — shown when transcript exists and not yet complete, or as compact regenerate */}
      {props.hasTranscript && (state === "ready" || state === "error") && (
        <div className="flex items-center justify-between">
          {state === "ready" && (
            <p className="text-body-sm text-text-secondary">
              Transcript received — click to analyze this call.
            </p>
          )}
          {state === "error" && (
            <div className="flex items-center gap-1.5 text-body-sm text-danger">
              <AlertCircle size={14} />
              {props.generationError}
            </div>
          )}
          <CallGenerateButton
            callId={props.callId}
            hasGenerated={hasGenerated}
            hasTranscript={props.hasTranscript}
            isGenerating={props.isGenerating}
            onGenerateStart={props.onGenerateStart}
            onGenerateError={props.onGenerateError}
          />
        </div>
      )}

      {/* Section A — AI Summary */}
      <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-overline text-text-tertiary tracking-wider">AI SUMMARY</h3>
          {state === "complete" && (
            <CallGenerateButton
              callId={props.callId}
              hasGenerated={true}
              hasTranscript={props.hasTranscript}
              isGenerating={props.isGenerating}
              onGenerateStart={props.onGenerateStart}
              onGenerateError={props.onGenerateError}
            />
          )}
        </div>
        {state === "complete" && props.aiSummary ? (
          <>
            {/* Bullet digest — default view when bullets exist */}
            {props.summaryBullets && props.summaryBullets.length > 0 ? (
              <>
                <ul className="space-y-2 mb-3">
                  {props.summaryBullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-2 text-body-sm text-text-primary">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-nah-blue flex-shrink-0" />
                      {bullet}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowFullSummary((s) => !s)}
                  className="flex items-center gap-1 text-[11px] text-nah-blue hover:text-nah-blue/80 font-medium transition-colors"
                >
                  {showFullSummary ? (
                    <>Hide full summary <ChevronUp size={12} /></>
                  ) : (
                    <>Read full summary <ChevronDown size={12} /></>
                  )}
                </button>
                {showFullSummary && (
                  <p className="mt-3 text-body-sm text-text-secondary whitespace-pre-wrap border-t border-border-default pt-3">
                    {props.aiSummary}
                  </p>
                )}
              </>
            ) : (
              /* No bullets yet — show full paragraph (backward compat) */
              <p className="text-body-sm text-text-primary whitespace-pre-wrap">{props.aiSummary}</p>
            )}
            <div className="flex items-center mt-2">
              {props.aiSummaryGeneratedAt && (
                <p className="text-[10px] text-text-tertiary">
                  Scout &middot; {new Date(props.aiSummaryGeneratedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                </p>
              )}
            </div>
          </>
        ) : state === "generating" ? (
          <div className="flex items-center gap-2 text-body-sm text-text-tertiary">
            <Loader2 size={14} className="animate-spin" />
            Scout is analyzing this call...
          </div>
        ) : state === "error" ? (
          <p className="text-body-sm text-danger italic">Generation failed. Click Retry above.</p>
        ) : state === "ready" ? (
          <p className="text-body-sm text-text-tertiary italic">
            Click &quot;Generate with Scout&quot; above to analyze this call.
          </p>
        ) : (
          <p className="text-body-sm text-text-tertiary italic">
            No transcript available. Transcript is pulled automatically from Read.ai after each call.
          </p>
        )}
      </div>

      {/* Section B — Coaching */}
      <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
        <h3 className="text-overline text-text-tertiary tracking-wider mb-3">COACHING</h3>
        {state === "complete" && props.coachingData && props.coachingScore !== null ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <ScoreCircle score={props.coachingScore} />
              <div>
                <p className="text-body-sm font-medium text-text-primary">{props.coachingData.label}</p>
                {props.coachingGeneratedAt && (
                  <p className="text-[10px] text-text-tertiary">
                    Scout &middot; {new Date(props.coachingGeneratedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </p>
                )}
              </div>
            </div>

            {/* Dimension score bars */}
            {props.coachingData.dimension_scores && (
              <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                {DIMENSIONS.map((dim) => {
                  const score = props.coachingData!.dimension_scores![dim.key] ?? 0;
                  const pct = Math.round((score / dim.max) * 100);
                  const barColor = pct >= 75 ? "bg-success" : pct >= 45 ? "bg-warning" : "bg-danger";
                  const textColor = pct >= 75 ? "text-success" : pct >= 45 ? "text-warning" : "text-danger";
                  return (
                    <div key={dim.key} className="flex items-center gap-2">
                      <span className="text-[11px] text-text-secondary min-w-[110px]">{dim.label}</span>
                      <div className="flex-1 h-[5px] bg-bg-tertiary rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={`text-[11px] font-medium min-w-[32px] text-right ${textColor}`}>
                        {score}/{dim.max}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Side-by-side panels: What went well + Watch out for */}
            {(props.coachingData.went_well?.length > 0 || props.coachingData.watch_out?.length > 0) && (
              <div className="grid grid-cols-2 gap-3">
                {/* Left — What went well */}
                <div className="rounded-lg p-3" style={{ background: "#EAF3DE", border: "0.5px solid #97C459" }}>
                  <p className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: "#3B6D11" }}>
                    What went well
                  </p>
                  {props.coachingData.went_well?.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 mb-2 last:mb-0">
                      <div className="w-[5px] h-[5px] rounded-full mt-[5px] flex-shrink-0" style={{ background: "#3B6D11" }} />
                      <span className="text-[12px] leading-relaxed" style={{ color: "#27500A" }}>{item}</span>
                    </div>
                  ))}
                  {(!props.coachingData.went_well || props.coachingData.went_well.length === 0) && (
                    <span className="text-[12px]" style={{ color: "#3B6D11", opacity: 0.5 }}>&mdash;</span>
                  )}
                </div>

                {/* Right — Watch out for */}
                <div className="rounded-lg p-3" style={{ background: "#FAEEDA", border: "0.5px solid #EF9F27" }}>
                  <p className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: "#854F0B" }}>
                    Watch out for
                  </p>
                  {props.coachingData.watch_out?.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 mb-2 last:mb-0">
                      <div className="w-[5px] h-[5px] rounded-full mt-[5px] flex-shrink-0" style={{ background: "#854F0B" }} />
                      <span className="text-[12px] leading-relaxed" style={{ color: "#633806" }}>{item}</span>
                    </div>
                  ))}
                  {(!props.coachingData.watch_out || props.coachingData.watch_out.length === 0) && (
                    <span className="text-[12px]" style={{ color: "#854F0B", opacity: 0.5 }}>&mdash;</span>
                  )}
                </div>
              </div>
            )}

            {/* For next call — full width blue accent */}
            {props.coachingData.next_call_prep && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: "#185FA5" }}>
                  For next call
                </p>
                <div className="text-[12px] leading-relaxed p-3" style={{
                  borderLeft: "3px solid #378ADD",
                  background: "#E6F1FB",
                  color: "#0C447C",
                  borderRadius: "0 8px 8px 0",
                }}>
                  {props.coachingData.next_call_prep}
                </div>
              </div>
            )}
          </div>
        ) : state === "generating" ? (
          <div className="flex items-center gap-2 text-body-sm text-text-tertiary">
            <Loader2 size={14} className="animate-spin" />
            Scout is generating coaching insights...
          </div>
        ) : !props.hasTranscript ? (
          <p className="text-body-sm text-text-tertiary italic">
            Waiting for transcript from Read.ai.
          </p>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-body-sm text-text-tertiary">
              Coaching not yet generated.
            </p>
            <button
              onClick={() => void handleGenerateCoaching()}
              disabled={isCoachingGenerating}
              className="flex items-center gap-1.5 text-body-sm font-medium text-nah-blue hover:text-nah-blue/80 border border-nah-blue/20 hover:border-nah-blue/40 rounded-md px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCoachingGenerating ? (
                <><Loader2 size={14} className="animate-spin" /> Generating...</>
              ) : (
                "Generate Coaching"
              )}
            </button>
          </div>
        )}
      </div>

      {/* Section C — Transcript */}
      <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-overline text-text-tertiary tracking-wider">TRANSCRIPT</h3>
            {props.source === "read_ai" && (
              <span className="text-[10px] text-text-tertiary">From Read.ai</span>
            )}
          </div>
          {parsedTranscript.length > 0 && (
            <button
              onClick={handleCopyTranscript}
              className="flex items-center gap-1 text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <Copy size={12} />
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </div>
        {parsedTranscript.length > 0 ? (
          <>
            <div className="space-y-3">
              {visibleTranscript.map((line, i) => (
                <TranscriptCard key={i} line={line} isNahTeam={isNahTeamMember(line.speaker)} />
              ))}
            </div>
            {parsedTranscript.length > 5 && (
              <button
                onClick={() => setShowAllTranscript((s) => !s)}
                className="mt-3 flex items-center gap-1 text-[11px] text-nah-blue hover:text-nah-blue/80 font-medium transition-colors"
              >
                {showAllTranscript ? (
                  <>Show less <ChevronUp size={12} /></>
                ) : (
                  <>Show all {parsedTranscript.length} turns <ChevronDown size={12} /></>
                )}
              </button>
            )}
          </>
        ) : (
          <p className="text-body-sm text-text-tertiary italic">No transcript available yet</p>
        )}
      </div>

      {/* Section D — Recording */}
      {(props.recordingUrl || props.meetingLink) && (
        <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
          <h3 className="text-overline text-text-tertiary tracking-wider mb-2">RECORDING</h3>
          <div className="flex items-center gap-3">
            <Video size={18} className="text-text-tertiary" />
            <div className="flex-1">
              <p className="text-body-sm text-text-primary">
                {props.source === "read_ai" ? "Google Meet" : "Recording"}
              </p>
              <div className="flex items-center gap-2 text-caption text-text-tertiary">
                {props.durationSeconds && <span>{Math.round(props.durationSeconds / 60)} min</span>}
                {props.startedAt && (
                  <span>
                    {new Date(props.startedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>
            <a
              href={props.recordingUrl ?? props.meetingLink ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost px-3 py-1.5 text-caption flex items-center gap-1 text-nah-blue"
            >
              Open <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Transcript sub-components ────────────────────

const NAH_TEAM_NAMES = ["chad arnold", "matt lavinder", "sam ", "mark ", "john ", "rylyn"];

function isNahTeamMember(speaker: string): boolean {
  const lower = speaker.toLowerCase();
  return NAH_TEAM_NAMES.some((name) => lower.includes(name));
}

function speakerInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function TranscriptCard({ line, isNahTeam }: { line: TranscriptLine; isNahTeam: boolean }) {
  const initials = speakerInitials(line.speaker) || "?";
  return (
    <div className="flex gap-3">
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white ${
          isNahTeam ? "bg-[#534AB7]" : "bg-[#9CA3AF]"
        }`}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-semibold" style={{ color: getSpeakerColor(line.speaker) }}>
          {line.speaker}
        </span>
        <p className="text-body-sm text-text-primary mt-0.5">{line.text}</p>
      </div>
    </div>
  );
}

// ── Transcript helpers ──────────────────────────

interface TranscriptLine { speaker: string; text: string }

/** Parse raw transcript text into speaker + text lines, cleaning up Read.ai speaker labels.
 *  Merges consecutive turns from the same speaker into one block.
 *  Uses participantNames to remap "Speaker N" labels to real names. */
function parseTranscriptLines(raw: string, participantNames: string[] = []): TranscriptLine[] {
  const parsed: TranscriptLine[] = [];

  // First pass: collect unique raw bracket labels to build a speaker map
  const rawLabels: string[] = [];
  for (const line of raw.split("\n")) {
    const m = line.match(/^\[([^\]]+)\]/);
    if (m && !rawLabels.includes(m[1])) rawLabels.push(m[1]);
  }

  // Build label → display name mapping
  const labelMap = buildDisplaySpeakerMap(rawLabels, participantNames);

  const segments = raw.split("\n");

  for (const segment of segments) {
    if (!segment.trim()) continue;

    let speaker: string | null = null;
    let text = "";

    // Old format: [Speaker Label]: text
    const bracketMatch = segment.match(/^\[([^\]]+)\]:\s*([\s\S]*)/);
    if (bracketMatch) {
      speaker = labelMap.get(bracketMatch[1]) ?? cleanSpeakerLabel(bracketMatch[1]);
      text = bracketMatch[2].trim();
    }

    // New format: Name: text
    if (!speaker) {
      const colonMatch = segment.match(/^([A-Z][a-zA-Z' ]{1,40}):\s*([\s\S]*)/);
      if (colonMatch) {
        speaker = colonMatch[1].trim();
        text = colonMatch[2].trim();
      }
    }

    // No speaker label — continuation line, append to previous
    if (!speaker) {
      if (parsed.length > 0) {
        parsed[parsed.length - 1].text += " " + segment.trim();
      }
      continue;
    }

    // Merge consecutive turns from the same speaker
    if (parsed.length > 0 && parsed[parsed.length - 1].speaker === speaker) {
      parsed[parsed.length - 1].text += " " + text;
    } else {
      parsed.push({ speaker, text });
    }
  }

  return parsed;
}

/** Map raw bracket labels to display names using Speaker N + participant list */
function buildDisplaySpeakerMap(rawLabels: string[], participantNames: string[]): Map<string, string> {
  const map = new Map<string, string>();

  // Extract Speaker N numbers
  const withNums: { label: string; num: number }[] = [];
  for (const label of rawLabels) {
    const m = label.match(/Speaker\s*(\d+)/i);
    if (m) withNums.push({ label, num: parseInt(m[1], 10) });
  }

  // If we have Speaker N labels + participant names, map by number
  if (withNums.length > 0 && participantNames.length > 0) {
    withNums.sort((a, b) => a.num - b.num);
    for (let i = 0; i < withNums.length; i++) {
      map.set(withNums[i].label, participantNames[i] ?? `Speaker ${withNums[i].num}`);
    }
  }

  // Handle labels without Speaker N
  for (const label of rawLabels) {
    if (map.has(label)) continue;
    if (label === "UNKNOWN_SPEAKER") { map.set(label, "Unknown"); continue; }
    map.set(label, cleanSpeakerLabel(label));
  }

  return map;
}

/** Clean up Read.ai speaker labels: "Conference Room (Chad Arnold) - Speaker 1" → "Chad Arnold" */
function cleanSpeakerLabel(raw: string): string {
  const parenMatch = raw.match(/\(([^)]+)\)/);
  if (parenMatch) return parenMatch[1].trim();

  const dashMatch = raw.match(/^(.+?)\s*-\s*Speaker\s*\d+/i);
  if (dashMatch) return dashMatch[1].trim();

  const deviceMatch = raw.match(/^(.+?)['']s\s+(MacBook|iPhone|iPad|Laptop|PC|Computer)/i);
  if (deviceMatch) return deviceMatch[1].trim();

  return raw;
}

/** Assign consistent colors to speakers */
const SPEAKER_COLORS = ["#534AB7", "#185FA5", "#3B6D11", "#854F0B", "#8B3A62", "#2D6A6A"];
const speakerColorMap = new Map<string, string>();

function getSpeakerColor(speaker: string): string {
  const existing = speakerColorMap.get(speaker);
  if (existing) return existing;
  const color = SPEAKER_COLORS[speakerColorMap.size % SPEAKER_COLORS.length];
  speakerColorMap.set(speaker, color);
  return color;
}
