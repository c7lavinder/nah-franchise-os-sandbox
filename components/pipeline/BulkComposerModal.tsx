"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * BulkComposerModal — composes one SMS, email, task, or note and sends it
 * to many contacts in one shot.
 *
 * Iterates client-side over the selected contacts with a small concurrency
 * cap so we don't hammer GHL. Per-contact result is shown in a summary at
 * the end (sent / failed / skipped). The user can close once results look
 * good — selection state stays so they can retry failures if needed.
 */

import { useState } from "react";
import { X, Loader2, MessageSquare, Mail, CheckSquare, StickyNote, Check, AlertCircle } from "lucide-react";
import { useScrollLock } from "@/lib/hooks/useScrollLock";

export interface BulkContact {
  contactId: string;
  ghlContactId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
}

type BulkActionKind = "sms" | "email" | "task" | "note";

interface Props {
  contacts: BulkContact[];
  initialKind?: BulkActionKind;
  onClose: () => void;
  onComplete?: (summary: BulkResult) => void;
}

interface BulkRowResult {
  contactId: string;
  name: string;
  status: "pending" | "sent" | "failed" | "skipped";
  error?: string;
}

interface BulkResult {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  rows: BulkRowResult[];
}

const TABS: {
  kind: BulkActionKind;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  needs: "phone" | "email" | "ghl";
}[] = [
  { kind: "sms", label: "SMS", icon: MessageSquare, needs: "phone" },
  { kind: "email", label: "Email", icon: Mail, needs: "email" },
  { kind: "task", label: "Task", icon: CheckSquare, needs: "ghl" },
  { kind: "note", label: "Note", icon: StickyNote, needs: "ghl" },
];

/** Cap concurrent in-flight requests so we don't slam GHL */
async function runWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

export default function BulkComposerModal({ contacts, initialKind = "sms", onClose, onComplete }: Props) {
  useScrollLock(true);
  const [kind, setKind] = useState<BulkActionKind>(initialKind);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDays, setTaskDueDays] = useState("3");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  function eligible(c: BulkContact): boolean {
    if (kind === "sms") return !!c.phone;
    if (kind === "email") return !!c.email;
    return !!c.ghlContactId; // task + note require GHL ID
  }

  async function dispatchOne(c: BulkContact): Promise<BulkRowResult> {
    if (!eligible(c)) {
      const reason = kind === "sms" ? "no phone" : kind === "email" ? "no email" : "no GHL link";
      return { contactId: c.contactId, name: c.name, status: "skipped", error: reason };
    }

    const ghlId = c.ghlContactId!; // eligible() guarantees this for task/note

    try {
      if (kind === "sms" || kind === "email") {
        const res = await apiFetch(`/api/contacts/${ghlId ?? c.contactId}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            kind === "sms"
              ? { type: "SMS", message: body, confirmed: true }
              : { type: "Email", subject, html: body, confirmed: true }
          ),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Failed" }));
          throw new Error(data.error ?? "Failed");
        }
      } else if (kind === "task") {
        const due = new Date(Date.now() + parseInt(taskDueDays || "0") * 24 * 60 * 60 * 1000).toISOString();
        const res = await apiFetch(`/api/contacts/${ghlId}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: taskTitle, dueDate: due, body }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Failed" }));
          throw new Error(data.error ?? "Failed");
        }
      } else if (kind === "note") {
        const res = await apiFetch(`/api/contacts/${ghlId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Failed" }));
          throw new Error(data.error ?? "Failed");
        }
      }
      return { contactId: c.contactId, name: c.name, status: "sent" };
    } catch (err) {
      return {
        contactId: c.contactId,
        name: c.name,
        status: "failed",
        error: err instanceof Error ? err.message : "Failed",
      };
    }
  }

  async function handleSend() {
    if (!body.trim()) return;
    if (kind === "email" && !subject.trim()) return;
    if (kind === "task" && !taskTitle.trim()) return;

    setRunning(true);
    const rows = await runWithConcurrency(contacts, 4, dispatchOne);
    const summary: BulkResult = {
      total: rows.length,
      sent: rows.filter((r) => r.status === "sent").length,
      failed: rows.filter((r) => r.status === "failed").length,
      skipped: rows.filter((r) => r.status === "skipped").length,
      rows,
    };
    setResult(summary);
    setRunning(false);
    onComplete?.(summary);
  }

  const verb =
    kind === "sms"
      ? "Send SMS to"
      : kind === "email"
        ? "Send email to"
        : kind === "task"
          ? "Create task on"
          : "Add note to";

  const eligibleCount = contacts.filter(eligible).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-primary border border-border-default rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border-default">
          <h3 className="text-body-sm font-semibold text-text-primary flex-1">
            Bulk action — {contacts.length} contact{contacts.length === 1 ? "" : "s"} selected
          </h3>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        {result ? (
          <div className="p-5 overflow-y-auto">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <SummaryCard label="Sent" value={result.sent} color="text-success" />
              <SummaryCard label="Failed" value={result.failed} color="text-danger" />
              <SummaryCard label="Skipped" value={result.skipped} color="text-text-tertiary" />
            </div>
            <div className="border border-border-default rounded-lg max-h-[40vh] overflow-y-auto">
              <ul className="divide-y divide-border-default">
                {result.rows.map((r) => (
                  <li key={r.contactId} className="flex items-center justify-between px-3 py-2">
                    <span className="text-body-sm text-text-primary truncate">{r.name}</span>
                    <span className="flex items-center gap-1.5 text-caption">
                      {r.status === "sent" && (
                        <>
                          <Check size={12} className="text-success" />
                          <span className="text-success">Sent</span>
                        </>
                      )}
                      {r.status === "failed" && (
                        <>
                          <AlertCircle size={12} className="text-danger" />
                          <span className="text-danger truncate max-w-[180px]">{r.error}</span>
                        </>
                      )}
                      {r.status === "skipped" && <span className="text-text-tertiary">Skipped — {r.error}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-nah-blue text-white text-body-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Action tabs */}
            <div className="flex gap-1 px-5 pt-3 border-b border-border-default">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = t.kind === kind;
                return (
                  <button
                    key={t.kind}
                    onClick={() => setKind(t.kind)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-body-sm font-medium border-b-2 transition-colors ${
                      active
                        ? "border-nah-blue text-nah-blue"
                        : "border-transparent text-text-tertiary hover:text-text-primary"
                    }`}
                  >
                    <Icon size={14} />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="p-5 space-y-3 overflow-y-auto">
              <p className="text-caption text-text-tertiary">
                {verb} {eligibleCount} of {contacts.length} contacts.
                {eligibleCount < contacts.length && (
                  <>
                    {" "}
                    ({contacts.length - eligibleCount} will be skipped — no{" "}
                    {kind === "sms" ? "phone" : kind === "email" ? "email" : "GHL link"}.)
                  </>
                )}
              </p>

              {kind === "task" && (
                <>
                  <div>
                    <label className="text-[10px] font-medium text-text-tertiary tracking-wider block mb-1">
                      TASK TITLE
                    </label>
                    <input
                      type="text"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-nah-blue"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-text-tertiary tracking-wider block mb-1">
                      DUE IN (DAYS)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={taskDueDays}
                      onChange={(e) => setTaskDueDays(e.target.value)}
                      className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-nah-blue"
                    />
                  </div>
                </>
              )}

              {kind === "email" && (
                <div>
                  <label className="text-[10px] font-medium text-text-tertiary tracking-wider block mb-1">
                    SUBJECT
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-nah-blue"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-medium text-text-tertiary tracking-wider block mb-1">
                  {kind === "task" ? "TASK DETAILS (OPTIONAL)" : "MESSAGE"}
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  placeholder={
                    kind === "sms"
                      ? "Same SMS sent to every selected contact."
                      : kind === "email"
                        ? "Same email body sent to every selected contact."
                        : kind === "task"
                          ? "Optional task body."
                          : "Note saved on each selected contact."
                  }
                  className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-nah-blue resize-y"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={onClose}
                  disabled={running}
                  className="px-4 py-2 rounded-lg text-body-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleSend()}
                  disabled={
                    running ||
                    !body.trim() ||
                    (kind === "email" && !subject.trim()) ||
                    (kind === "task" && !taskTitle.trim()) ||
                    eligibleCount === 0
                  }
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-nah-blue text-white text-body-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-40"
                >
                  {running && <Loader2 size={14} className="animate-spin" />}
                  {running ? "Sending…" : `Send to ${eligibleCount}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-bg-secondary border border-border-default p-3 text-center">
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      <p className="text-caption text-text-tertiary mt-1">{label}</p>
    </div>
  );
}
