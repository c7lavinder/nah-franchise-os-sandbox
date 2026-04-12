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
  category: string;
  title: string;
  description: string | null;
  source: string;
  ghl_action: boolean;
  status: string;
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

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-border-default mb-6">
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
          onRefresh={props.onRefresh}
        />
      )}

      {activeTab === "next_steps" && (
        <CallNextStepsTab
          callId={props.callId}
          actionItems={props.actionItems}
          hasTranscript={props.hasTranscript}
          hasGenerated={hasGenerated}
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
          onRefresh={props.onRefresh}
        />
      )}
    </div>
  );
}
