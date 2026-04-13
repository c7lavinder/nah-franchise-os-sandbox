"use client";

import { useState } from "react";
import { FileText, ListChecks, Database } from "lucide-react";
import CallOverviewTab from "./CallOverviewTab";
import CallNextStepsTab from "./CallNextStepsTab";
import CallDataTab from "./CallDataTab";

type Tab = "overview" | "next_steps" | "data";

interface CoachingData {
  score: number;
  label: string;
  went_well: string[];
  watch_out: string[];
  next_call_prep: string;
}

interface ActionItem {
  id: string;
  call_id: string;
  contact_id: string | null;
  category: string;
  title: string;
  description: string | null;
  source: string;
  ghl_action: boolean;
  status: string;
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

interface CallDetailTabsProps {
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
  actionItems: ActionItem[];
  dataExtractions: Extraction[];
  profileFieldCount: number;
  isGenerating: boolean;
  generationError: string | null;
  teamMembers: { id: string; name: string }[];
  contactName: string | null;
  onGenerateStart: () => void;
  onGenerateError: (msg: string) => void;
  onRefresh: () => void;
}

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: "overview", label: "Overview", icon: FileText },
  { key: "next_steps", label: "Next Steps", icon: ListChecks },
  { key: "data", label: "Data", icon: Database },
];

export default function CallDetailTabs(props: CallDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const hasGenerated = !!props.aiSummaryGeneratedAt;
  const pendingCount = props.actionItems.filter((a) => a.status === "pending").length;
  const pendingExtractions = props.dataExtractions.filter((e) => !e.saved_to_profile && !e.dismissed).length;

  return (
    <div>
      {/* Tab bar — sticky so it stays visible when scrolling */}
      <div className="sticky top-0 z-10 bg-bg-primary flex border-b border-border-default mb-6 -mx-4 md:-mx-8 px-4 md:px-8">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-body-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-nah-orange text-nah-orange"
                  : "border-transparent text-text-tertiary hover:text-text-primary"
              }`}
            >
              <Icon size={14} />
              {tab.label}
              {tab.key === "next_steps" && pendingCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-nah-orange/10 text-nah-orange font-bold">
                  {pendingCount}
                </span>
              )}
              {tab.key === "data" && pendingExtractions > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary font-bold">
                  {pendingExtractions}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <CallOverviewTab
          callId={props.callId}
          aiSummary={props.aiSummary}
          aiSummaryGeneratedAt={props.aiSummaryGeneratedAt}
          coachingScore={props.coachingScore}
          coachingData={props.coachingData}
          coachingGeneratedAt={props.coachingGeneratedAt}
          rawTranscript={props.rawTranscript}
          hasTranscript={props.hasTranscript}
          recordingUrl={props.recordingUrl}
          meetingLink={props.meetingLink}
          durationSeconds={props.durationSeconds}
          startedAt={props.startedAt}
          source={props.source}
          isGenerating={props.isGenerating}
          generationError={props.generationError}
          onGenerateStart={props.onGenerateStart}
          onGenerateError={props.onGenerateError}
          onRefresh={props.onRefresh}
        />
      )}

      {activeTab === "next_steps" && (
        <CallNextStepsTab
          callId={props.callId}
          actionItems={props.actionItems}
          hasTranscript={props.hasTranscript}
          hasGenerated={hasGenerated}
          isGenerating={props.isGenerating}
          generationError={props.generationError}
          teamMembers={props.teamMembers}
          contactName={props.contactName}
          onRefresh={props.onRefresh}
        />
      )}

      {activeTab === "data" && (
        <CallDataTab
          callId={props.callId}
          dataExtractions={props.dataExtractions}
          profileFieldCount={props.profileFieldCount}
          hasTranscript={props.hasTranscript}
          hasGenerated={hasGenerated}
          isGenerating={props.isGenerating}
          generationError={props.generationError}
          onRefresh={props.onRefresh}
        />
      )}
    </div>
  );
}
