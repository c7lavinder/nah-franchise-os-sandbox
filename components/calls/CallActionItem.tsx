"use client";

import { useState } from "react";
import { Check, Pencil, X, Loader2, Sparkles, Zap } from "lucide-react";

interface ActionItemData {
  id: string;
  call_id: string;
  category: string;
  title: string;
  description: string | null;
  source: string;
  ghl_action: boolean;
  status: string;
}

interface CallActionItemProps {
  item: ActionItemData;
  onAction: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  pipeline: "bg-nah-blue/10 text-nah-blue",
  apt: "bg-scout-purple/10 text-scout-purple",
  task: "bg-nah-orange/10 text-nah-orange",
  comms: "bg-success/10 text-success",
  workflow: "bg-info/10 text-info",
  data: "bg-warning/10 text-warning",
};

export default function CallActionItem({ item, onAction }: CallActionItemProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editDescription, setEditDescription] = useState(item.description ?? "");
  const [loading, setLoading] = useState<string | null>(null);

  const isDone = item.status !== "pending";

  async function handleAction(action: "push" | "edit" | "skip") {
    setLoading(action);
    try {
      const body: Record<string, string> = { action };
      if (action === "edit") {
        body.title = editTitle;
        body.description = editDescription;
      }

      const res = await fetch(`/api/calls/${item.call_id}/actions/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setEditing(false);
        onAction();
      }
    } catch {
      // silent
    }
    setLoading(null);
  }

  if (isDone) {
    return (
      <div className={`flex items-start gap-3 px-3 py-2.5 rounded-lg ${
        item.status === "skipped" ? "opacity-40" : "opacity-60"
      }`}>
        <div className="flex items-center gap-1.5 mt-0.5">
          {item.status === "skipped" ? (
            <X size={14} className="text-text-tertiary" />
          ) : (
            <Check size={14} className="text-success" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-body-sm text-text-primary ${item.status === "skipped" ? "line-through" : ""}`}>
            {item.title}
          </p>
        </div>
        <span className="text-[10px] text-text-tertiary capitalize">{item.status.replace("_", " ")}</span>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary border border-border-default rounded-lg p-3">
      {/* Tags row */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${CATEGORY_COLORS[item.category] ?? "bg-bg-tertiary text-text-tertiary"}`}>
          {item.category}
        </span>
        {item.source === "scout" && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-scout-purple/10 text-scout-purple flex items-center gap-0.5">
            <Sparkles size={8} /> Scout
          </span>
        )}
        {item.ghl_action && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-nah-orange/10 text-nah-orange flex items-center gap-0.5">
            <Zap size={8} /> GHL
          </span>
        )}
      </div>

      {/* Content */}
      {editing ? (
        <div className="space-y-2 mb-3">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-body-sm text-text-primary"
          />
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            rows={2}
            className="w-full bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-body-sm text-text-primary resize-none"
          />
        </div>
      ) : (
        <div className="mb-3">
          <p className="text-body-sm font-medium text-text-primary">{item.title}</p>
          {item.description && (
            <p className="text-caption text-text-secondary mt-0.5">{item.description}</p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <button
              onClick={() => void handleAction("edit")}
              disabled={loading !== null}
              className="btn-primary px-3 py-1 text-caption flex items-center gap-1"
            >
              {loading === "edit" ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Push
            </button>
            <button
              onClick={() => { setEditing(false); setEditTitle(item.title); setEditDescription(item.description ?? ""); }}
              className="btn-ghost px-3 py-1 text-caption"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => void handleAction("push")}
              disabled={loading !== null}
              className="btn-primary px-3 py-1 text-caption flex items-center gap-1"
            >
              {loading === "push" ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Push
            </button>
            <button
              onClick={() => setEditing(true)}
              disabled={loading !== null}
              className="btn-ghost px-3 py-1 text-caption flex items-center gap-1"
            >
              <Pencil size={12} /> Edit
            </button>
            <button
              onClick={() => void handleAction("skip")}
              disabled={loading !== null}
              className="btn-ghost px-3 py-1 text-caption flex items-center gap-1 text-text-tertiary"
            >
              {loading === "skip" ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
              Skip
            </button>
          </>
        )}
      </div>
    </div>
  );
}
