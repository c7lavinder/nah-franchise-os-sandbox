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

            {props.coachingData.went_well?.length > 0 && (
              <div>
                <p className="text-caption font-medium text-success mb-1">What went well</p>
                <ul className="space-y-1">
                  {props.coachingData.went_well.map((item, i) => (
                    <li key={i} className="text-body-sm text-text-primary flex items-start gap-1.5">
                      <span className="text-success mt-0.5 flex-shrink-0">+</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {props.coachingData.watch_out?.length > 0 && (
              <div>
                <p className="text-caption font-medium text-warning mb-1">Watch out for</p>
                <ul className="space-y-1">
                  {props.coachingData.watch_out.map((item, i) => (
                    <li key={i} className="text-body-sm text-text-primary flex items-start gap-1.5">
                      <span className="text-warning mt-0.5 flex-shrink-0">!</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {props.coachingData.next_call_prep && (
              <div className="bg-nah-blue/5 border border-nah-blue/20 rounded-md p-3">
                <p className="text-caption font-medium text-nah-blue mb-1">For next call</p>
                <p className="text-body-sm text-text-primary">{props.coachingData.next_call_prep}</p>
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
          <div className="max-h-[400px] overflow-y-auto">
            <p className="text-body-sm text-text-primary whitespace-pre-wrap">{props.rawTranscript}</p>
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
