"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useEffect } from "react";
import { Bot, MessageSquare, ArrowRight, ClipboardList, Loader2 } from "lucide-react";

interface ScoutAction {
  id: string;
  action_type: string;
  action_status: string;
  draft_content: Record<string, unknown>;
  final_content: Record<string, unknown> | null;
  created_at: string;
  executed_at: string | null;
}

interface ScoutActionHistoryProps {
  contactId: string;
}

function actionIcon(type: string) {
  switch (type) {
    case "message": return <MessageSquare size={12} className="text-info" />;
    case "stage_move": return <ArrowRight size={12} className="text-nah-orange" />;
    case "task": return <ClipboardList size={12} className="text-warning" />;
    default: return <Bot size={12} className="text-scout-purple" />;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "executed": return "text-success";
    case "confirmed": return "text-info";
    case "cancelled": return "text-text-tertiary";
    case "failed": return "text-danger";
    default: return "text-warning";
  }
}

export default function ScoutActionHistory({ contactId }: ScoutActionHistoryProps) {
  const [actions, setActions] = useState<ScoutAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/contacts/${contactId}/scout-actions`);
        if (res.ok) {
          const data = await res.json();
          setActions(data.actions ?? []);
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
        <h3 className="text-overline text-text-tertiary tracking-wider mb-3">SCOUT ACTIONS</h3>
        <div className="flex items-center justify-center py-4">
          <Loader2 size={16} className="animate-spin text-text-tertiary" />
        </div>
      </section>
    );
  }

  return (
    <section>
      <h3 className="text-overline text-text-tertiary tracking-wider mb-3">
        SCOUT ACTIONS ({actions.length})
      </h3>

      {actions.length === 0 && (
        <p className="text-caption text-text-tertiary py-2">
          No Scout actions yet — actions will appear here as Scout drafts messages, moves stages, and creates tasks for this contact
        </p>
      )}

      <div className="space-y-2 max-h-[250px] overflow-y-auto">
        {actions.map((action) => (
          <div key={action.id} className="flex gap-2 px-2 py-1.5 rounded bg-bg-secondary">
            <div className="mt-0.5">{actionIcon(action.action_type)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-caption font-medium text-text-primary capitalize">
                  {action.action_type.replace("_", " ")}
                </span>
                <span className={`text-caption ${statusColor(action.action_status)}`}>
                  {action.action_status}
                </span>
              </div>
              <p className="text-caption text-text-tertiary">
                {new Date(action.created_at).toLocaleDateString()}{" "}
                {new Date(action.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
