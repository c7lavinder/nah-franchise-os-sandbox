"use client";

import { useState } from "react";
import {
  Check, X, Pencil, ChevronDown, ChevronRight,
  Bot, Phone, Globe, Webhook, MessageSquare,
} from "lucide-react";

interface Suggestion {
  id: string;
  field_name: string;
  current_value: string | null;
  suggested_value: string;
  source: string;
  confidence: string;
  evidence: string | null;
  created_at: string;
}

interface Props {
  suggestions: Suggestion[];
  onPush: (id: string, value: string) => Promise<void>;
  onSkip: (id: string) => Promise<void>;
}

function ageDot(createdAt: string): { color: string; label: string } {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days < 5) return { color: "bg-green-400", label: `${days}d` };
  if (days < 15) return { color: "bg-yellow-400", label: `${days}d` };
  return { color: "bg-red-400", label: `${days}d` };
}

function sourceBadge(source: string) {
  const map: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; color: string }> = {
    call: { icon: Phone, label: "Call", color: "bg-blue-100 text-blue-800" },
    agent_research: { icon: Bot, label: "Research", color: "bg-purple-100 text-purple-800" },
    scout_chat: { icon: MessageSquare, label: "Scout", color: "bg-indigo-100 text-indigo-800" },
    webhook: { icon: Webhook, label: "Webhook", color: "bg-green-100 text-green-800" },
    document: { icon: Globe, label: "Document", color: "bg-gray-100 text-gray-600" },
    internal_chat: { icon: MessageSquare, label: "Internal", color: "bg-orange-100 text-orange-800" },
  };
  const m = map[source] ?? { icon: Bot, label: source, color: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${m.color}`}>
      <m.icon size={10} /> {m.label}
    </span>
  );
}

function confidenceBadge(confidence: string) {
  const colors: Record<string, string> = {
    high: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-red-100 text-red-800",
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[confidence] ?? "bg-gray-100 text-gray-600"}`}>
      {confidence}
    </span>
  );
}

export default function SuggestionCards({ suggestions, onPush, onSkip }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-6 text-caption text-text-tertiary">
        No pending suggestions. Scout will surface new data points after calls and research.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {suggestions.map((sug) => {
        const age = ageDot(sug.created_at);
        const isEditing = editingId === sug.id;
        const isExpanded = expandedId === sug.id;
        const isProcessing = processing === sug.id;

        return (
          <div key={sug.id} className="border border-border-default rounded-lg p-3 bg-bg-primary">
            {/* Header row */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${age.color}`} title={age.label} />
              <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
                {sug.field_name.replace(/_/g, " ")}
              </span>
              <div className="flex-1" />
              {sourceBadge(sug.source)}
              {confidenceBadge(sug.confidence)}
            </div>

            {/* Values */}
            <div className="flex items-center gap-2 text-body-sm mb-2">
              <span className="text-text-tertiary">{sug.current_value ?? "—"}</span>
              <span className="text-text-tertiary">→</span>
              <span className="text-text-primary font-medium">{sug.suggested_value}</span>
            </div>

            {/* Evidence (collapsible) */}
            {sug.evidence && (
              <button
                onClick={() => setExpandedId(isExpanded ? null : sug.id)}
                className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text-secondary mb-2"
              >
                {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                Evidence
              </button>
            )}
            {isExpanded && sug.evidence && (
              <div className="text-caption text-text-secondary bg-bg-secondary rounded p-2 mb-2 italic">
                {sug.evidence}
              </div>
            )}

            {/* Edit textarea */}
            {isEditing && (
              <div className="mb-2">
                <textarea
                  className="input text-body-sm w-full py-1.5 px-2"
                  rows={2}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={async () => {
                      setProcessing(sug.id);
                      await onPush(sug.id, editValue);
                      setEditingId(null);
                      setProcessing(null);
                    }}
                    disabled={isProcessing}
                    className="btn btn-sm bg-green-600 text-white hover:bg-green-700"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="btn btn-sm text-text-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            {!isEditing && (
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setProcessing(sug.id);
                    await onPush(sug.id, sug.suggested_value);
                    setProcessing(null);
                  }}
                  disabled={isProcessing}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-caption font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                >
                  <Check size={12} /> Push
                </button>
                <button
                  onClick={() => {
                    setEditValue(sug.suggested_value);
                    setEditingId(sug.id);
                  }}
                  disabled={isProcessing}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-caption font-medium bg-bg-secondary text-text-primary hover:bg-bg-hover transition-colors"
                >
                  <Pencil size={12} /> Edit
                </button>
                <button
                  onClick={async () => {
                    setProcessing(sug.id);
                    await onSkip(sug.id);
                    setProcessing(null);
                  }}
                  disabled={isProcessing}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-caption font-medium text-text-tertiary hover:text-danger transition-colors"
                >
                  <X size={12} /> Skip
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
