"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useEffect } from "react";
import { Loader2, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import CoachingTab from "./CoachingTab";
import TranscriptTab from "./TranscriptTab";
import ActionsTab from "./ActionsTab";
import IntelTab from "./IntelTab";

interface CallSummary {
  id: string;
  conversationId: string;
  messageId: string;
  contactId: string;
  contactName: string;
  phone: string | null;
  direction: "inbound" | "outbound";
  dateAdded: string;
  duration: string | null;
}

interface CallDetailData {
  recordingUrl: string | null;
  transcription: string | null;
}

interface ProfileUpdate {
  fieldName: string;
  suggestedValue: string;
  reason: string;
}

interface GradeResult {
  score: string;
  scoreNumeric: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  coachingTips: string[];
  suggestedActions: SuggestedAction[];
  profileUpdates: ProfileUpdate[];
}

interface SuggestedAction {
  type: "note" | "task" | "stage_move" | "sms" | "email" | "workflow";
  label: string;
  description: string;
  content: string;
  targetStage?: string;
}

interface CallDetailProps {
  call: CallSummary;
}

export default function CallDetail({ call }: CallDetailProps) {
  const [activeTab, setActiveTab] = useState<"coaching" | "transcript" | "intel" | "actions">("coaching");
  const [detail, setDetail] = useState<CallDetailData | null>(null);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);

  // Fetch recording + transcript
  useEffect(() => {
    async function fetchDetail() {
      setLoading(true);
      setGrade(null);
      try {
        const res = await apiFetch(`/api/calls/${call.id}`);
        if (res.ok) {
          const data = await res.json();
          setDetail(data);

          // Auto-grade if transcript is available
          if (data.transcription) {
            void gradeCall(data.transcription);
          }
        }
      } catch {
        // Continue with null
      } finally {
        setLoading(false);
      }
    }

    async function gradeCall(transcript: string) {
      setGrading(true);
      try {
        const res = await apiFetch(`/api/calls/${call.id}/grade`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript,
            contactName: call.contactName,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setGrade(data.grade);
        }
      } catch {
        // Continue without grade
      } finally {
        setGrading(false);
      }
    }

    void fetchDetail();
  }, [call.id, call.contactName]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-default flex-shrink-0">
        <div className="flex items-center gap-2">
          {call.direction === "inbound"
            ? <PhoneIncoming size={16} className="text-info" />
            : <PhoneOutgoing size={16} className="text-success" />
          }
          <h2 className="text-h2 text-text-primary">{call.contactName}</h2>
          {grade && (
            <span className={`px-2 py-0.5 rounded-full text-caption font-bold ${
              grade.scoreNumeric >= 80 ? "bg-success/15 text-success" :
              grade.scoreNumeric >= 60 ? "bg-warning/15 text-warning" :
              "bg-danger/15 text-danger"
            }`}>
              {grade.score}
            </span>
          )}
        </div>
        <p className="text-caption text-text-tertiary mt-0.5">
          {new Date(call.dateAdded).toLocaleString()} {call.duration ? `· ${call.duration}` : ""}
        </p>
        {grade?.summary && (
          <p className="text-body-sm text-text-secondary mt-1">{grade.summary}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-default px-4 flex-shrink-0">
        {([
          { key: "coaching" as const, label: "Coaching" },
          { key: "transcript" as const, label: "Transcript" },
          { key: "intel" as const, label: "Intel" },
          { key: "actions" as const, label: "Next Steps" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-body-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-nah-orange text-nah-orange"
                : "border-transparent text-text-tertiary hover:text-text-primary"
            }`}
          >
            {tab.label}
            {tab.key === "actions" && grade ? (() => {
              const count = (grade.suggestedActions?.length ?? 0) + (grade.profileUpdates?.length ?? 0);
              return count > 0 ? (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-nah-orange text-white text-[10px] font-bold">
                  {count}
                </span>
              ) : null;
            })() : null}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-text-tertiary" />
          </div>
        ) : (
          <>
            {activeTab === "coaching" && (
              <CoachingTab grade={grade} grading={grading} />
            )}
            {activeTab === "transcript" && (
              <TranscriptTab
                transcription={detail?.transcription ?? null}
                recordingUrl={detail?.recordingUrl ?? null}
              />
            )}
            {activeTab === "intel" && (
              <IntelTab
                contactId={call.contactId}
                contactName={call.contactName}
                profileUpdates={grade?.profileUpdates ?? []}
                hasAiData={!!grade}
              />
            )}
            {activeTab === "actions" && (
              <ActionsTab
                actions={grade?.suggestedActions ?? []}
                profileUpdates={grade?.profileUpdates ?? []}
                contactId={call.contactId}
                callId={call.id}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
