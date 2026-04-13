"use client";

import { useState } from "react";
import { Loader2, ChevronDown, ChevronRight, Plus, Sparkles } from "lucide-react";
import CallActionItem from "./CallActionItem";
import type { ActionItemData } from "./CallActionItem";

interface TeamMember { id: string; name: string; email: string }

interface CallNextStepsTabProps {
  callId: string;
  actionItems: ActionItemData[];
  hasTranscript: boolean;
  hasGenerated: boolean;
  isGenerating: boolean;
  teamMembers: TeamMember[];
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  onRefresh: () => void;
}

type GenState = "no_transcript" | "ready" | "generating" | "complete";

function getState(props: CallNextStepsTabProps): GenState {
  if (!props.hasTranscript) return "no_transcript";
  if (props.isGenerating) return "generating";
  if (props.actionItems.length > 0 || props.hasGenerated) return "complete";
  return "ready";
}

/** Resolve display type — splits "comms" into "email" or "sms" based on metadata */
function getDisplayType(item: ActionItemData): string {
  if (item.category === "comms") {
    const channel = (item.metadata?.comms_channel as string) ?? "sms";
    return channel === "email" ? "email" : "sms";
  }
  return item.category;
}

/** Type group definitions — order, label, and background color */
const TYPE_GROUPS: { key: string; label: string; bg: string; border: string }[] = [
  { key: "email", label: "Email", bg: "bg-[#EFF6FF]", border: "border-[#BFDBFE]" },
  { key: "sms", label: "SMS", bg: "bg-[#F0FDF4]", border: "border-[#BBF7D0]" },
  { key: "apt", label: "Appointments", bg: "bg-[#F5F3FF]", border: "border-[#DDD6FE]" },
  { key: "task", label: "Tasks", bg: "bg-[#FFF7ED]", border: "border-[#FED7AA]" },
  { key: "note", label: "Notes", bg: "bg-[#ECFEFF]", border: "border-[#A5F3FC]" },
  { key: "pipeline", label: "Pipeline", bg: "bg-[#EFF6FF]", border: "border-[#BFDBFE]" },
  { key: "data", label: "Data", bg: "bg-[#FFFBEB]", border: "border-[#FDE68A]" },
  { key: "workflow", label: "Workflow", bg: "bg-[#F0F9FF]", border: "border-[#BAE6FD]" },
];

export default function CallNextStepsTab(props: CallNextStepsTabProps) {
  const state = getState(props);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const pendingItems = props.actionItems.filter((a) => a.status === "pending");
  const completedItems = props.actionItems.filter((a) => a.status !== "pending");

  // Group pending items by display type
  const typeGroups = new Map<string, ActionItemData[]>();
  for (const item of pendingItems) {
    const displayType = getDisplayType(item);
    const group = typeGroups.get(displayType) ?? [];
    group.push(item);
    typeGroups.set(displayType, group);
  }

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
        setAiInput("");
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
        <div className="flex items-center gap-2 text-body-sm text-text-tertiary justify-center">
          <Loader2 size={14} className="animate-spin" /> Preparing analysis...
        </div>
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

      {/* Grouped action panels by type */}
      {TYPE_GROUPS.filter((g) => typeGroups.has(g.key)).map((group) => {
        const items = typeGroups.get(group.key) ?? [];
        return (
          <div key={group.key} className={`rounded-lg border ${group.border} ${group.bg} overflow-hidden`}>
            <div className="px-4 py-2 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                {group.label}
              </h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/60 text-text-tertiary font-medium">
                {items.length}
              </span>
            </div>
            <div className="space-y-2 px-3 pb-3">
              {items.map((item) => (
                <CallActionItem
                  key={item.id}
                  item={item}
                  teamMembers={props.teamMembers}
                  contactEmail={props.contactEmail}
                  contactPhone={props.contactPhone}
                  onAction={props.onRefresh}
                />
              ))}
            </div>
          </div>
        );
      })}

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
                <CallActionItem key={item.id} item={item} teamMembers={props.teamMembers} contactEmail={props.contactEmail} contactPhone={props.contactPhone} onAction={props.onRefresh} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
