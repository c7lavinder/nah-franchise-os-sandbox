"use client";

import { useState } from "react";
import { Loader2, ChevronDown, ChevronRight, Plus, Sparkles } from "lucide-react";
import CallActionItem from "./CallActionItem";
import type { ActionItemData } from "./CallActionItem";

interface TeamMember { id: string; name: string }

interface CallNextStepsTabProps {
  callId: string;
  actionItems: ActionItemData[];
  hasTranscript: boolean;
  hasGenerated: boolean;
  isGenerating: boolean;
  teamMembers: TeamMember[];
  contactName: string | null;
  onRefresh: () => void;
}

type GenState = "no_transcript" | "ready" | "generating" | "complete";

function getState(props: CallNextStepsTabProps): GenState {
  if (!props.hasTranscript) return "no_transcript";
  if (props.isGenerating) return "generating";
  if (props.actionItems.length > 0 || props.hasGenerated) return "complete";
  return "ready";
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

export default function CallNextStepsTab(props: CallNextStepsTabProps) {
  const state = getState(props);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const pendingItems = props.actionItems.filter((a) => a.status === "pending");
  const completedItems = props.actionItems.filter((a) => a.status !== "pending");

  // Group pending items by contact name
  const grouped = groupBy(pendingItems, (a) => a.contact_name ?? "General");

  async function handleAddAction() {
    if (!aiInput.trim() || isAdding) return;
    setIsAdding(true);
    try {
      const res = await fetch(`/api/calls/${props.callId}/actions/generate-single`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: aiInput }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiInput("");
        // Expand the new item
        if (data.actionId) setExpandedId(data.actionId);
        props.onRefresh();
      }
    } catch { /* silent */ }
    setIsAdding(false);
  }

  // Non-complete states
  if (state === "no_transcript") {
    return (
      <div className="text-center py-12">
        <p className="text-body-sm text-text-tertiary">Next steps will be available once the transcript arrives from Read.ai.</p>
      </div>
    );
  }
  if (state === "ready") {
    return (
      <div className="text-center py-12">
        <p className="text-body-sm text-text-tertiary">Generate on the Overview tab to unlock next steps.</p>
      </div>
    );
  }
  if (state === "generating") {
    return (
      <div className="text-center py-12">
        <Loader2 size={20} className="animate-spin text-text-tertiary mx-auto mb-2" />
        <p className="text-body-sm text-text-tertiary">Scout is generating next steps...</p>
      </div>
    );
  }


  return (
    <div className="space-y-4">
      {/* AI input bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Sparkles size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-scout-purple" />
          <input
            type="text"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleAddAction(); }}
            placeholder={`Add an action for ${props.contactName ?? "contact"}...`}
            className="w-full bg-bg-primary border border-border-default rounded-md pl-8 pr-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary"
          />
        </div>
        <button
          onClick={() => void handleAddAction()}
          disabled={!aiInput.trim() || isAdding}
          className="btn-primary px-3 py-2 text-caption flex items-center gap-1"
        >
          {isAdding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Add
        </button>
      </div>

      {/* Grouped pending actions */}
      {Object.entries(grouped).map(([contactName, actions]) => (
        <div key={contactName}>
          <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-2 mt-2">
            {contactName}
          </div>
          <div className="space-y-3">
            {actions.map((item) => (
              <CallActionItem
                key={item.id}
                item={item}
                teamMembers={props.teamMembers}
                expandedId={expandedId}
                onExpand={setExpandedId}
                onAction={props.onRefresh}
              />
            ))}
          </div>
        </div>
      ))}

      {pendingItems.length === 0 && completedItems.length === 0 && (
        <div className="text-center py-8">
          <p className="text-body-sm text-text-tertiary">No action items generated. Use the input above to add one.</p>
        </div>
      )}

      {/* Completed section */}
      {completedItems.length > 0 && (
        <div className="border-t border-border-default pt-3">
          <button onClick={() => setCompletedOpen((v) => !v)} className="flex items-center gap-2 w-full text-left">
            {completedOpen ? <ChevronDown size={14} className="text-text-tertiary" /> : <ChevronRight size={14} className="text-text-tertiary" />}
            <span className="text-overline text-text-tertiary tracking-wider">COMPLETED</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary">{completedItems.length}</span>
          </button>
          {completedOpen && (
            <div className="space-y-1 mt-2">
              {completedItems.map((item) => (
                <CallActionItem key={item.id} item={item} teamMembers={props.teamMembers} expandedId={null} onExpand={() => {}} onAction={props.onRefresh} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
