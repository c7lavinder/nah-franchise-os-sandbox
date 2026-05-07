"use client";

import { useState, useMemo } from "react";
import { ExternalLink, Video, Loader2, Copy, ChevronDown, ChevronUp } from "lucide-react";

interface CallOverviewTabProps {
  callId: string;
  aiSummary: string | null;
  summaryBullets: string[] | null;
  aiSummaryGeneratedAt: string | null;
  coachingScore: number | null;
  coachingData: unknown;
  coachingGeneratedAt: string | null;
  rawTranscript: string | null;
  hasTranscript: boolean;
  recordingUrl: string | null;
  meetingLink: string | null;
  durationSeconds: number | null;
  startedAt: string | null;
  source: string | null;
  isGenerating: boolean;
  participantNames: string[];
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

type GenState = "no_transcript" | "ready" | "generating" | "complete";

function getState(props: CallOverviewTabProps): GenState {
  if (!props.hasTranscript) return "no_transcript";
  if (props.isGenerating) return "generating";
  if (props.aiSummary) return "complete";
  return "ready";
}

function gradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "text-success";
    case "B":
      return "text-nah-blue";
    case "C":
      return "text-warning";
    case "D":
      return "text-[#EF9F27]";
    default:
      return "text-danger";
  }
}

export default function CallOverviewTab(props: CallOverviewTabProps) {
  const state = getState(props);
  const [showFullSummary, setShowFullSummary] = useState(false);
  const [showAllTranscript, setShowAllTranscript] = useState(false);
  const [copied, setCopied] = useState(false);

  const parsedTranscript = useMemo(
    () => parseTranscriptLines(props.rawTranscript ?? "", props.participantNames),
    [props.rawTranscript, props.participantNames]
  );

  const visibleTranscript = showAllTranscript ? parsedTranscript : parsedTranscript.slice(0, 5);

  const handleCopyTranscript = async () => {
    const text = parsedTranscript.map((t) => `${t.speaker}: ${t.text}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Section A — AI Summary */}
      <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
        <h3 className="text-overline text-text-tertiary tracking-wider mb-2">SUMMARY</h3>
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
                    <>
                      Hide full summary <ChevronUp size={12} />
                    </>
                  ) : (
                    <>
                      Read full summary <ChevronDown size={12} />
                    </>
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
                  Scout &middot;{" "}
                  {new Date(props.aiSummaryGeneratedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                </p>
              )}
            </div>
          </>
        ) : state === "generating" ? (
          <div className="flex items-center gap-2 text-body-sm text-text-tertiary">
            <Loader2 size={14} className="animate-spin" />
            Scout is analyzing this call...
          </div>
        ) : state === "ready" ? (
          <div className="flex items-center gap-2 text-body-sm text-text-tertiary">
            <Loader2 size={14} className="animate-spin" />
            Preparing analysis...
          </div>
        ) : (
          <p className="text-body-sm text-text-tertiary italic">No transcript available yet.</p>
        )}
      </div>

      {/* Section B — Rubric Grade (compact) */}
      {props.rubricGrade && props.rubricGrade.criterion_scores && props.rubricGrade.criterion_scores.length > 0 ? (
        <RubricSection rubricGrade={props.rubricGrade} />
      ) : state === "generating" ? (
        <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
          <h3 className="text-overline text-text-tertiary tracking-wider mb-3">GRADE</h3>
          <div className="flex items-center gap-2 text-body-sm text-text-tertiary">
            <Loader2 size={14} className="animate-spin" />
            Scout is grading this call...
          </div>
        </div>
      ) : null}

      {/* Section C — Transcript */}
      <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-overline text-text-tertiary tracking-wider">TRANSCRIPT</h3>
            {(props.source === "read_ai" || props.source === "upload") && (
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
                  <>
                    Show less <ChevronUp size={12} />
                  </>
                ) : (
                  <>
                    Show all {parsedTranscript.length} turns <ChevronDown size={12} />
                  </>
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
                    {new Date(props.startedAt).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
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

// ── Rubric section (compact) ─────────────────────

function RubricSection({ rubricGrade }: { rubricGrade: NonNullable<CallOverviewTabProps["rubricGrade"]> }) {
  const [expandedCriterion, setExpandedCriterion] = useState<string | null>(null);

  return (
    <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
      {/* Header row — grade + score */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-overline text-text-tertiary tracking-wider">GRADE</h3>
        <div className="flex items-center gap-1.5">
          <span className={`text-xl font-bold ${gradeColor(rubricGrade.overall_grade)}`}>
            {rubricGrade.overall_grade}
          </span>
          <span className="text-caption text-text-tertiary">{rubricGrade.overall_score}/100</span>
        </div>
      </div>

      {/* Compact criterion rows */}
      <div className="space-y-1.5 mb-3">
        {rubricGrade.criterion_scores!.map((cs) => {
          const pct = cs.score;
          const barColor =
            pct >= 80 ? "bg-success" : pct >= 60 ? "bg-nah-blue" : pct >= 40 ? "bg-warning" : "bg-danger";
          const isExpanded = expandedCriterion === cs.criterionId;

          return (
            <div key={cs.criterionId}>
              <button
                onClick={() => setExpandedCriterion(isExpanded ? null : cs.criterionId)}
                className="w-full flex items-center gap-2 py-1 hover:bg-bg-tertiary/50 rounded-md px-1 -mx-1 transition-colors"
              >
                <span className="text-[12px] font-medium text-text-primary flex-1 text-left truncate">{cs.name}</span>
                <div className="w-16 h-[4px] bg-bg-tertiary rounded-full overflow-hidden flex-shrink-0">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                <span className={`text-[11px] font-bold w-5 text-right flex-shrink-0 ${gradeColor(cs.grade)}`}>
                  {cs.grade}
                </span>
              </button>
              {isExpanded && cs.rationale && <p className="text-[11px] text-text-tertiary pl-1 pb-1">{cs.rationale}</p>}
            </div>
          );
        })}
      </div>

      {/* Strengths + Improvements — inline compact */}
      {rubricGrade.strengths?.length || rubricGrade.improvements?.length ? (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {rubricGrade.strengths && rubricGrade.strengths.length > 0 && (
            <div className="rounded-md px-2.5 py-2" style={{ background: "#EAF3DE" }}>
              <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#3B6D11" }}>
                Strengths
              </p>
              {rubricGrade.strengths.map((s, i) => (
                <p key={i} className="text-[11px] leading-snug" style={{ color: "#27500A" }}>
                  &bull; {s}
                </p>
              ))}
            </div>
          )}
          {rubricGrade.improvements && rubricGrade.improvements.length > 0 && (
            <div className="rounded-md px-2.5 py-2" style={{ background: "#FAEEDA" }}>
              <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#854F0B" }}>
                Improve
              </p>
              {rubricGrade.improvements.map((s, i) => (
                <p key={i} className="text-[11px] leading-snug" style={{ color: "#633806" }}>
                  &bull; {s}
                </p>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Next action */}
      {rubricGrade.suggested_next_action && (
        <div
          className="text-[11px] leading-snug px-2.5 py-2 rounded-md"
          style={{ borderLeft: "3px solid #378ADD", background: "#E6F1FB", color: "#0C447C" }}
        >
          <span className="font-semibold">Next:</span> {rubricGrade.suggested_next_action}
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

interface TranscriptLine {
  speaker: string;
  text: string;
}

/** Parse raw transcript text into speaker + text lines, cleaning up Read.ai speaker labels.
 *  Merges consecutive turns from the same speaker into one block.
 *  Uses participantNames to remap "Speaker N" labels to real names. */
function parseTranscriptLines(raw: string, participantNames: string[] = []): TranscriptLine[] {
  const parsed: TranscriptLine[] = [];

  // Normalize line endings
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // First pass: collect unique raw bracket labels to build a speaker map
  const rawLabels: string[] = [];
  for (const line of normalized.split("\n")) {
    const m = line.match(/^\[([^\]]+)\]/);
    if (m && !rawLabels.includes(m[1])) rawLabels.push(m[1]);
  }

  // Build label → display name mapping
  const labelMap = buildDisplaySpeakerMap(rawLabels, participantNames);

  const segments = normalized.split("\n");

  for (const segment of segments) {
    if (!segment.trim()) continue;

    let speaker: string | null = null;
    let text = "";

    // Format 1: [Speaker Label]: text
    const bracketMatch = segment.match(/^\[([^\]]+)\]:\s*([\s\S]*)/);
    if (bracketMatch) {
      speaker = labelMap.get(bracketMatch[1]) ?? cleanSpeakerLabel(bracketMatch[1]);
      text = bracketMatch[2].trim();
    }

    // Format 2: Name: text (allows digits, dots, hyphens in names)
    if (!speaker) {
      const colonMatch = segment.match(/^([A-Z][a-zA-Z0-9' .-]{1,40}):\s*([\s\S]*)/);
      if (colonMatch) {
        speaker = colonMatch[1].trim();
        text = colonMatch[2].trim();
      }
    }

    // Format 3: Read.ai plain text — "Name  0:15" or "Name  00:15:30"
    // Speaker name + timestamp on its own line, text follows on next lines
    if (!speaker) {
      const tsMatch = segment.match(/^([A-Za-z][A-Za-z' .-]+?)\s{2,}\d{1,2}:\d{2}(?::\d{2})?\s*$/);
      if (tsMatch) {
        speaker = tsMatch[1].trim();
        text = "";
      }
    }

    // Format 4: Timestamp prefix — "0:15 Name:" or "00:15:30 Name:"
    if (!speaker) {
      const tsPrefixMatch = segment.match(/^\d{1,2}:\d{2}(?::\d{2})?\s+([A-Z][a-zA-Z0-9' .-]{1,40}):\s*([\s\S]*)/);
      if (tsPrefixMatch) {
        speaker = tsPrefixMatch[1].trim();
        text = tsPrefixMatch[2].trim();
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
    if (label === "UNKNOWN_SPEAKER") {
      map.set(label, "Unknown");
      continue;
    }
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
