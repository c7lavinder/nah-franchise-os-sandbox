"use client";

import { Loader2 } from "lucide-react";
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
  onRefresh: () => void;
}

export default function CallNextStepsTab({
  callId,
  actionItems,
  hasTranscript,
  hasGenerated,
  onRefresh,
}: CallNextStepsTabProps) {
  const pendingItems = actionItems.filter((a) => a.status === "pending");
  const completedItems = actionItems.filter((a) => a.status !== "pending");

  // Empty states
  if (!hasTranscript) {
    return (
      <div className="text-center py-12">
        <p className="text-body-sm text-text-tertiary">
          Next steps will be generated once the transcript arrives from Read.ai.
        </p>
      </div>
    );
  }

  if (!hasGenerated && actionItems.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-body-sm text-text-tertiary">
          No next steps generated yet.
        </p>
        <div className="flex justify-center">
          <CallGenerateButton
            callId={callId}
            hasGenerated={false}
            hasTranscript={hasTranscript}
            onGenerated={onRefresh}
          />
        </div>
      </div>
    );
  }

  if (hasGenerated && actionItems.length === 0) {
    return (
      <div className="text-center py-12">
        <Loader2 size={20} className="animate-spin text-text-tertiary mx-auto mb-2" />
        <p className="text-body-sm text-text-tertiary">
          Scout is generating next steps...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending actions */}
      {pendingItems.length > 0 && (
        <div className="space-y-3">
          {pendingItems.map((item) => (
            <CallActionItem key={item.id} item={item} onAction={onRefresh} />
          ))}
        </div>
      )}

      {/* Completed/skipped actions */}
      {completedItems.length > 0 && (
        <div>
          <h3 className="text-overline text-text-tertiary tracking-wider mb-2">COMPLETED</h3>
          <div className="space-y-1">
            {completedItems.map((item) => (
              <CallActionItem key={item.id} item={item} onAction={onRefresh} />
            ))}
          </div>
        </div>
      )}

      {/* Regenerate */}
      <div className="flex justify-end pt-2 border-t border-border-default">
        <CallGenerateButton
          callId={callId}
          hasGenerated={true}
          hasTranscript={hasTranscript}
          onGenerated={onRefresh}
        />
      </div>
    </div>
  );
}
