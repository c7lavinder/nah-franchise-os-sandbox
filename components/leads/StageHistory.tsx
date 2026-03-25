"use client";

import { useState, useEffect } from "react";
import { GitBranch, Loader2 } from "lucide-react";

interface StageChange {
  id: string;
  fromStage: string;
  toStage: string;
  reason: string | null;
  timestamp: string;
}

interface StageHistoryProps {
  contactId: string;
}

export default function StageHistory({ contactId }: StageHistoryProps) {
  const [changes, setChanges] = useState<StageChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const res = await globalThis.fetch(`/api/contacts/${contactId}/scout-actions`);
        if (res.ok) {
          const data = await res.json();
          // Filter to stage_move actions and extract stage info
          const stageActions = (data.actions ?? [])
            .filter((a: { action_type: string }) => a.action_type === "stage_move")
            .map((a: { id: string; draft_content: Record<string, unknown>; final_content: Record<string, unknown> | null; created_at: string }) => ({
              id: a.id,
              fromStage: String(a.draft_content?.fromStage ?? a.draft_content?.currentStage ?? "Unknown"),
              toStage: String(a.final_content?.stageName ?? a.draft_content?.targetStage ?? "Unknown"),
              reason: a.draft_content?.reason ? String(a.draft_content.reason) : null,
              timestamp: a.created_at,
            }));
          setChanges(stageActions);
        }
      } catch {
        // Continue with empty
      } finally {
        setLoading(false);
      }
    }
    void fetch();
  }, [contactId]);

  if (loading) {
    return (
      <section>
        <h3 className="text-overline text-text-tertiary tracking-wider mb-3">STAGE HISTORY</h3>
        <div className="flex items-center justify-center py-4">
          <Loader2 size={16} className="animate-spin text-text-tertiary" />
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <GitBranch size={14} className="text-scout-purple" />
        <h3 className="text-overline text-text-tertiary tracking-wider">STAGE HISTORY</h3>
      </div>

      {changes.length === 0 && (
        <p className="text-caption text-text-tertiary py-2">
          No stage moves recorded yet — history will populate as leads progress through the pipeline
        </p>
      )}

      <div className="space-y-0 max-h-[200px] overflow-y-auto">
        {changes.map((change, i) => (
          <div key={change.id} className="flex gap-3 pb-2">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-nah-orange mt-1.5" />
              {i < changes.length - 1 && <div className="w-px flex-1 bg-border-default mt-1" />}
            </div>
            <div className="min-w-0">
              <p className="text-body-sm text-text-primary">
                <span className="text-text-tertiary">{change.fromStage}</span>
                {" → "}
                <span className="font-medium">{change.toStage}</span>
              </p>
              {change.reason && (
                <p className="text-caption text-text-tertiary">{change.reason}</p>
              )}
              <p className="text-caption text-text-tertiary">
                {new Date(change.timestamp).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
