"use client";

import { Loader2, AlertCircle } from "lucide-react";
import CallActionItem from "./CallActionItem";
import CallGenerateButton from "./CallGenerateButton";

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

interface CallNextStepsTabProps {
  callId: string;
  actionItems: ActionItem[];
  hasTranscript: boolean;
  hasGenerated: boolean;
  isGenerating: boolean;
  generationError: string | null;
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
  const pendingItems = props.actionItems.filter((a) => a.status === "pending");
  const completedItems = props.actionItems.filter((a) => a.status !== "pending");

  // Non-complete states
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

  // Complete state — render action items
  return (
    <div className="space-y-6">
      {pendingItems.length > 0 && (
        <div className="space-y-3">
          {pendingItems.map((item) => (
            <CallActionItem key={item.id} item={item} onAction={props.onRefresh} />
          ))}
        </div>
      )}

      {completedItems.length > 0 && (
        <div>
          <h3 className="text-overline text-text-tertiary tracking-wider mb-2">COMPLETED</h3>
          <div className="space-y-1">
            {completedItems.map((item) => (
              <CallActionItem key={item.id} item={item} onAction={props.onRefresh} />
            ))}
          </div>
        </div>
      )}

      {pendingItems.length === 0 && completedItems.length === 0 && (
        <div className="text-center py-8">
          <p className="text-body-sm text-text-tertiary">No action items were generated for this call.</p>
        </div>
      )}
    </div>
  );
}
