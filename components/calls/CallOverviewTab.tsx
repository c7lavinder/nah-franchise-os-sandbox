"use client";

import { ExternalLink, Video, Loader2 } from "lucide-react";
import CallGenerateButton from "./CallGenerateButton";

interface CoachingData {
  score: number;
  label: string;
  went_well: string[];
  watch_out: string[];
  next_call_prep: string;
}

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
  generating?: boolean;
  onRefresh: () => void;
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

export default function CallOverviewTab({
  callId,
  aiSummary,
  aiSummaryGeneratedAt,
  coachingScore,
  coachingData,
  coachingGeneratedAt,
  rawTranscript,
  hasTranscript,
  recordingUrl,
  meetingLink,
  durationSeconds,
  startedAt,
  source,
  generating,
  onRefresh,
}: CallOverviewTabProps) {
  const hasGenerated = !!aiSummaryGeneratedAt;

  return (
    <div className="space-y-6">
      {/* Generate button */}
      {hasTranscript && (
        <div className="flex justify-end">
          <CallGenerateButton
            callId={callId}
            hasGenerated={hasGenerated}
            hasTranscript={hasTranscript}
            onGenerated={onRefresh}
          />
        </div>
      )}

      {/* Section A — AI Summary */}
      <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
        <h3 className="text-overline text-text-tertiary tracking-wider mb-2">AI SUMMARY</h3>
        {aiSummary ? (
          <>
            <p className="text-body-sm text-text-primary whitespace-pre-wrap">{aiSummary}</p>
            {aiSummaryGeneratedAt && (
              <p className="text-[10px] text-text-tertiary mt-2">
                Scout &middot; {new Date(aiSummaryGeneratedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
              </p>
            )}
          </>
        ) : hasTranscript && generating ? (
          <div className="flex items-center gap-2 text-body-sm text-text-tertiary">
            <Loader2 size={14} className="animate-spin" />
            Scout is analyzing this call...
          </div>
        ) : hasTranscript ? (
          <p className="text-body-sm text-text-tertiary italic">
            Summary not yet generated. Click &quot;Regenerate&quot; above.
          </p>
        ) : (
          <p className="text-body-sm text-text-tertiary italic">
            Transcript not yet available from Read.ai
          </p>
        )}
      </div>

      {/* Section B — Coaching */}
      <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
        <h3 className="text-overline text-text-tertiary tracking-wider mb-3">COACHING</h3>
        {coachingData && coachingScore !== null ? (
          <div className="space-y-4">
            {/* Score display */}
            <div className="flex items-center gap-4">
              <ScoreCircle score={coachingScore} />
              <div>
                <p className="text-body-sm font-medium text-text-primary">{coachingData.label}</p>
                {coachingGeneratedAt && (
                  <p className="text-[10px] text-text-tertiary">
                    Scout &middot; {new Date(coachingGeneratedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </p>
                )}
              </div>
            </div>

            {/* What went well */}
            {coachingData.went_well?.length > 0 && (
              <div>
                <p className="text-caption font-medium text-success mb-1">What went well</p>
                <ul className="space-y-1">
                  {coachingData.went_well.map((item, i) => (
                    <li key={i} className="text-body-sm text-text-primary flex items-start gap-1.5">
                      <span className="text-success mt-0.5 flex-shrink-0">+</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Watch out for */}
            {coachingData.watch_out?.length > 0 && (
              <div>
                <p className="text-caption font-medium text-warning mb-1">Watch out for</p>
                <ul className="space-y-1">
                  {coachingData.watch_out.map((item, i) => (
                    <li key={i} className="text-body-sm text-text-primary flex items-start gap-1.5">
                      <span className="text-warning mt-0.5 flex-shrink-0">!</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next call prep */}
            {coachingData.next_call_prep && (
              <div className="bg-nah-blue/5 border border-nah-blue/20 rounded-md p-3">
                <p className="text-caption font-medium text-nah-blue mb-1">For next call</p>
                <p className="text-body-sm text-text-primary">{coachingData.next_call_prep}</p>
              </div>
            )}
          </div>
        ) : hasTranscript && generating ? (
          <div className="flex items-center gap-2 text-body-sm text-text-tertiary">
            <Loader2 size={14} className="animate-spin" />
            Scout is generating coaching insights...
          </div>
        ) : hasTranscript ? (
          <p className="text-body-sm text-text-tertiary italic">
            Coaching not yet generated. Click &quot;Regenerate&quot; above.
          </p>
        ) : (
          <p className="text-body-sm text-text-tertiary italic">
            Coaching will be available once the transcript arrives from Read.ai
          </p>
        )}
      </div>

      {/* Section C — Transcript */}
      <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-overline text-text-tertiary tracking-wider">TRANSCRIPT</h3>
          {source === "read_ai" && (
            <span className="text-[10px] text-text-tertiary">From Read.ai</span>
          )}
        </div>
        {rawTranscript ? (
          <div className="max-h-[400px] overflow-y-auto">
            <p className="text-body-sm text-text-primary whitespace-pre-wrap">{rawTranscript}</p>
          </div>
        ) : (
          <p className="text-body-sm text-text-tertiary italic">No transcript available yet</p>
        )}
      </div>

      {/* Section D — Recording */}
      {(recordingUrl || meetingLink) && (
        <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
          <h3 className="text-overline text-text-tertiary tracking-wider mb-2">RECORDING</h3>
          <div className="flex items-center gap-3">
            <Video size={18} className="text-text-tertiary" />
            <div className="flex-1">
              <p className="text-body-sm text-text-primary">
                {source === "read_ai" ? "Google Meet" : "Recording"}
              </p>
              <div className="flex items-center gap-2 text-caption text-text-tertiary">
                {durationSeconds && <span>{Math.round(durationSeconds / 60)} min</span>}
                {startedAt && (
                  <span>
                    {new Date(startedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>
            <a
              href={recordingUrl ?? meetingLink ?? "#"}
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
