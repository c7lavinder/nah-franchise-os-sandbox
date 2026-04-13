"use client";

import { useState } from "react";
import { Loader2, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import CallActionItem from "./CallActionItem";

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

interface TeamMember {
  id: string;
  name: string;
}

interface CallNextStepsTabProps {
  callId: string;
  actionItems: ActionItem[];
  hasTranscript: boolean;
  hasGenerated: boolean;
  isGenerating: boolean;
  generationError: string | null;
  teamMembers: TeamMember[];
  contactName: string | null;
  onRefresh: () => void;
}

type GenState = "no_transcript" | "ready" | "generating" | "complete" | "error";

function getState(props: CallNextStepsTabProps): GenState {
  if (!props.hasTranscript) return "no_transcript";
  if (props.isGenerating) return "generating";
  if (props.generationError) return "error";
  if (props.actionItems.length > 0 || props.hasGenerated) return "complete";
  return "ready";
}

export default function CallNextStepsTab(props: CallNextStepsTabProps) {
  const state = getState(props);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);

  const pendingItems = props.actionItems.filter((a) => a.status === "pending");
  const completedItems = props.actionItems.filter((a) => a.status !== "pending");

  if (state === "no_transcript") {
    return (
      <div className="text-center py-12">
        <p className="text-body-sm text-text-tertiary">
          Next steps will be available once the transcript arrives from Read.ai.
        </p>
      </div>
    );
  }

  if (state === "ready") {
    return (
      <div className="text-center py-12">
        <p className="text-body-sm text-text-tertiary">
          Generate on the Overview tab to unlock next steps.
        </p>
      </div>
    );
  }

  if (state === "generating") {
    return (
      <div className="text-center py-12">
        <Loader2 size={20} className="animate-spin text-text-tertiary mx-auto mb-2" />
        <p className="text-body-sm text-text-tertiary">
          Scout is generating next steps...
        </p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="text-center py-12">
        <AlertCircle size={20} className="text-danger mx-auto mb-2" />
        <p className="text-body-sm text-danger">
          Generation failed. Go to Overview tab to retry.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pending actions */}
      {pendingItems.length > 0 && (
        <div className="space-y-3">
          {pendingItems.map((item) => (
            <CallActionItem
              key={item.id}
              item={item}
              teamMembers={props.teamMembers}
              contactName={props.contactName}
              expandedId={expandedId}
              onExpand={setExpandedId}
              onAction={props.onRefresh}
            />
          ))}
        </div>
      )}

      {pendingItems.length === 0 && completedItems.length === 0 && (
        <div className="text-center py-8">
          <p className="text-body-sm text-text-tertiary">No action items were generated for this call.</p>
        </div>
      )}

      {/* Completed section — collapsed by default */}
      {completedItems.length > 0 && (
        <div className="border-t border-border-default pt-3">
          <button
            onClick={() => setCompletedOpen((v) => !v)}
            className="flex items-center gap-2 w-full text-left"
          >
            {completedOpen ? (
              <ChevronDown size={14} className="text-text-tertiary" />
            ) : (
              <ChevronRight size={14} className="text-text-tertiary" />
            )}
            <span className="text-overline text-text-tertiary tracking-wider">COMPLETED</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary">
              {completedItems.length}
            </span>
          </button>
          {completedOpen && (
            <div className="space-y-1 mt-2">
              {completedItems.map((item) => (
                <CallActionItem
                  key={item.id}
                  item={item}
                  teamMembers={props.teamMembers}
                  contactName={props.contactName}
                  expandedId={null}
                  onExpand={() => {}}
                  onAction={props.onRefresh}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
