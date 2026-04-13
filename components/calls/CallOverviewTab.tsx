"use client";

import { ExternalLink, Video, Loader2, AlertCircle } from "lucide-react";
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
        <h3 className="text-overline text-text-tertiary tracking-wider mb-2">AI SUMMARY</h3>
        {state === "complete" && props.aiSummary ? (
          <>
            <p className="text-body-sm text-text-primary whitespace-pre-wrap">{props.aiSummary}</p>
            <div className="flex items-center justify-between mt-2">
              {props.aiSummaryGeneratedAt && (
                <p className="text-[10px] text-text-tertiary">
                  Scout &middot; {new Date(props.aiSummaryGeneratedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                </p>
              )}
              <CallGenerateButton
                callId={props.callId}
                hasGenerated={true}
                hasTranscript={props.hasTranscript}
                isGenerating={props.isGenerating}
                onGenerateStart={props.onGenerateStart}
                onGenerateError={props.onGenerateError}
              />
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
                    <p className="text-[12px] italic" style={{ color: "#3B6D11" }}>No specific strengths noted.</p>
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
                    <p className="text-[12px] italic" style={{ color: "#854F0B" }}>No concerns flagged.</p>
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
        ) : state === "error" ? (
          <p className="text-body-sm text-danger italic">Generation failed.</p>
        ) : state === "ready" ? (
          <p className="text-body-sm text-text-tertiary italic">
            Coaching will be generated when you analyze this call.
          </p>
        ) : (
          <p className="text-body-sm text-text-tertiary italic">
            Coaching will be available once the transcript arrives from Read.ai.
          </p>
        )}
      </div>

      {/* Section C — Transcript */}
      <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-overline text-text-tertiary tracking-wider">TRANSCRIPT</h3>
          {props.source === "read_ai" && (
            <span className="text-[10px] text-text-tertiary">From Read.ai</span>
          )}
        </div>
        {props.rawTranscript ? (
          <div className="max-h-[400px] overflow-y-auto space-y-3">
            {parseTranscriptLines(props.rawTranscript).map((line, i) => (
              <div key={i}>
                <span className="text-[11px] font-semibold" style={{ color: getSpeakerColor(line.speaker) }}>
                  {line.speaker}
                </span>
                <p className="text-body-sm text-text-primary mt-0.5">{line.text}</p>
              </div>
            ))}
          </div>
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

// ── Transcript helpers ──────────────────────────

interface TranscriptLine { speaker: string; text: string }

/** Parse raw transcript text into speaker + text lines, cleaning up Read.ai speaker labels */
function parseTranscriptLines(raw: string): TranscriptLine[] {
  const lines: TranscriptLine[] = [];

  const segments = raw.split(/\n+/);

  for (const segment of segments) {
    if (!segment.trim()) continue;

    // Old format: [Speaker Label]: text
    const bracketMatch = segment.match(/^\[([^\]]+)\]:\s*([\s\S]*)/);
    if (bracketMatch) {
      lines.push({ speaker: cleanSpeakerLabel(bracketMatch[1]), text: bracketMatch[2].trim() });
      continue;
    }

    // New format: Name: text (name is 1-4 capitalized words before colon)
    const colonMatch = segment.match(/^([A-Z][a-zA-Z' ]{1,40}):\s*([\s\S]*)/);
    if (colonMatch) {
      lines.push({ speaker: colonMatch[1].trim(), text: colonMatch[2].trim() });
      continue;
    }

    // No speaker label — append to previous line or create unknown
    if (lines.length > 0) {
      lines[lines.length - 1].text += " " + segment.trim();
    } else {
      lines.push({ speaker: "Unknown", text: segment.trim() });
    }
  }

  return lines;
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
