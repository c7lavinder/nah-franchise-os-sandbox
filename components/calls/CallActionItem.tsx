"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useEffect, useRef } from "react";
import {
  Check, X, Loader2, Sparkles, Zap, User, ChevronDown, Search,
  Send, CalendarPlus, ListChecks, Save, FileText, Mail, MessageSquare, ArrowRightCircle,
} from "lucide-react";

export interface ActionItemData {
  id: string;
  call_id: string;
  contact_id: string | null;
  category: string;
  title: string;
  description: string | null;
  why: string | null;
  contact_name: string | null;
  assigned_to_name: string | null;
  source: string;
  ghl_action: boolean;
  status: string;
  pushed_at: string | null;
  skipped_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface TeamMember { id: string; name: string; email: string }

interface ContactOption { id: string; name: string; email: string | null; phone: string | null }

/** Partners on the call's journey — enables the reassign dropdown on the
 *  action's contact pill when there are 2+ co-primaries (e.g. Kevin + Kylie). */
export interface PartnerOption { id: string; name: string }

interface CallActionItemProps {
  item: ActionItemData;
  teamMembers: TeamMember[];
  contactEmail: string | null;
  contactPhone: string | null;
  partnerOptions?: PartnerOption[];
  onAction: () => void;
}

const CATEGORY_ICONS: Record<string, typeof Send> = {
  comms: Send, task: ListChecks, apt: CalendarPlus, note: FileText, data: Save, pipeline: ArrowRightCircle,
};

const CTA_LABELS: Record<string, string> = {
  comms: "Send", task: "Create Task", apt: "Schedule",
  note: "Log Note", data: "Save to Profile", workflow: "Trigger", pipeline: "Move Stage",
};

function getCommIcon(channel: string) {
  return channel === "email" ? Mail : MessageSquare;
}

export default function CallActionItem({ item, teamMembers, contactEmail, contactPhone, partnerOptions, onAction }: CallActionItemProps) {
  const isDone = item.status !== "pending";
  const channel = (item.metadata?.comms_channel as string) ?? "sms";
  const Icon = item.category === "comms" ? getCommIcon(channel) : (CATEGORY_ICONS[item.category] ?? Check);

  const [expanded, setExpanded] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>(() => initFields(item, contactEmail, contactPhone));
  const [showWhy, setShowWhy] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  function setField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  // ── Done state ──
  if (isDone) {
    const isSkipped = item.status === "skipped";
    const isPushed = item.status === "pushed" || item.status === "edited_pushed";
    const summaryDetail = getSummaryDetail(item.category, initFields(item, contactEmail, contactPhone));
    const timestamp = item.pushed_at ?? item.skipped_at;
    const timeStr = timestamp
      ? new Date(timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      : null;

    return (
      <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
        isSkipped ? "bg-danger/5 border border-danger/10" : "bg-white/50 border border-white/60"
      } ${isSkipped ? "opacity-60" : "opacity-50"}`}>
        <Icon size={14} className={isSkipped ? "text-danger/50" : "text-text-tertiary"} />
        <div className="flex-1 min-w-0">
          <p className={`text-body-sm ${isSkipped ? "text-danger/70 line-through" : "text-text-secondary"}`}>{item.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {item.contact_name && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                isSkipped ? "bg-danger/5 text-danger/50" : "bg-bg-tertiary text-text-tertiary"
              }`}>
                {item.contact_name}
              </span>
            )}
            {summaryDetail && (
              <span className="text-[10px] text-text-tertiary truncate">{summaryDetail}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end flex-shrink-0">
          <span className={`text-[10px] font-medium ${isSkipped ? "text-danger/60" : "text-success/70"}`}>
            {isSkipped ? "Skipped" : isPushed ? "Pushed" : "Done"}
          </span>
          {timeStr && <span className="text-[9px] text-text-tertiary">{timeStr}</span>}
        </div>
      </div>
    );
  }

  // ── Handlers ──
  async function handlePush() {
    setLoading("push"); setError(null);
    try {
      const res = await apiFetch(`/api/calls/${item.call_id}/actions/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "push", payload: fields }),
      });
      if (res.ok) { onAction(); }
      else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed"); }
    } catch { setError("Network error"); }
    setLoading(null);
  }

  async function handleSkip() {
    setLoading("skip"); setError(null);
    try {
      const res = await apiFetch(`/api/calls/${item.call_id}/actions/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip" }),
      });
      if (res.ok) { onAction(); }
      else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed"); }
    } catch { setError("Network error"); }
    setLoading(null);
  }

  async function handleReassign(partner: PartnerOption) {
    setLoading("reassign"); setError(null);
    try {
      const res = await apiFetch(`/api/calls/${item.call_id}/actions/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reassign",
          payload: { contact_id: partner.id, contact_name: partner.name },
        }),
      });
      if (res.ok) { onAction(); }
      else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed"); }
    } catch { setError("Network error"); }
    setLoading(null);
  }

  async function handleAiRewrite() {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    try {
      const res = await apiFetch(`/api/calls/${item.call_id}/actions/${item.id}/rewrite`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: aiInput, currentFields: fields, category: item.category }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.fields) setFields((prev) => ({ ...prev, ...data.fields }));
        setAiInput("");
      }
    } catch { /* silent */ }
    setAiLoading(false);
  }

  // Collapsed summary line — show key detail per type
  const summaryDetail = getSummaryDetail(item.category, fields);

  return (
    <div className="bg-white rounded-lg border border-white/80 shadow-sm overflow-hidden">
      {/* ── Collapsed view ── */}
      <div className="px-3 py-2.5 flex items-center gap-2">
        <Icon size={14} className="text-text-secondary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-medium text-text-primary truncate">{item.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {item.contact_name && (
              <PartnerPill
                contactId={item.contact_id}
                contactName={item.contact_name}
                partnerOptions={partnerOptions ?? []}
                onReassign={(p) => void handleReassign(p)}
                loading={loading === "reassign"}
              />
            )}
            {summaryDetail && (
              <span className="text-[10px] text-text-tertiary truncate">{summaryDetail}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setExpanded((v) => !v)}
            className="px-2 py-1 text-[10px] text-nah-blue hover:bg-nah-blue/10 rounded-md transition-colors font-medium">
            {expanded ? "Close" : "Edit"}
          </button>
          <button onClick={() => void handlePush()} disabled={loading !== null}
            className="btn-primary px-2.5 py-1 text-[10px] flex items-center gap-1">
            {loading === "push" ? <Loader2 size={10} className="animate-spin" /> : <Icon size={10} />}
            {CTA_LABELS[item.category] ?? "Push"}
          </button>
          <button onClick={() => void handleSkip()} disabled={loading !== null}
            className="px-1.5 py-1 text-text-tertiary hover:text-danger hover:bg-danger/5 rounded-md transition-colors">
            {loading === "skip" ? <Loader2 size={10} className="animate-spin" /> : <X size={12} />}
          </button>
        </div>
      </div>

      {/* ── Expanded editable view ── */}
      {expanded && (
        <div className="border-t border-border-default px-3 py-3 space-y-2 bg-bg-primary/30">
          {item.category === "comms" && <CommsFields fields={fields} setField={setField} teamMembers={teamMembers} contactEmail={contactEmail} contactPhone={contactPhone} />}
          {item.category === "apt" && <AptFields fields={fields} setField={setField} teamMembers={teamMembers} />}
          {item.category === "task" && <TaskFields fields={fields} setField={setField} teamMembers={teamMembers} />}
          {item.category === "note" && <NoteFields fields={fields} setField={setField} />}

          {/* Why this action */}
          {item.why && (
            <>
              <button onClick={() => setShowWhy((v) => !v)} className="text-[10px] text-scout-purple flex items-center gap-1">
                <Sparkles size={8} /> Why? {showWhy ? "▲" : "▼"}
              </button>
              {showWhy && <p className="text-[11px] text-text-secondary pl-4">{item.why}</p>}
            </>
          )}

          {/* AI rewrite */}
          <div className="flex gap-1.5 pt-1">
            <div className="flex-1 relative">
              <Sparkles size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-scout-purple" />
              <input type="text" value={aiInput} onChange={(e) => setAiInput(e.target.value)}
                placeholder="Tell AI what to change..."
                className="w-full bg-white border border-border-default rounded-md pl-6 pr-2 py-1 text-[11px] text-text-primary placeholder:text-text-tertiary"
                onKeyDown={(e) => { if (e.key === "Enter") void handleAiRewrite(); }} />
            </div>
            <button onClick={() => void handleAiRewrite()} disabled={aiLoading || !aiInput.trim()}
              className="px-2 py-1 text-[10px] text-scout-purple hover:bg-scout-purple/10 rounded-md transition-colors flex items-center gap-0.5">
              {aiLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} Apply
            </button>
          </div>

          {/* Confirm row */}
          <div className="flex items-center gap-2 pt-1 border-t border-border-default">
            <button onClick={() => void handlePush()} disabled={loading !== null}
              className="btn-primary px-3 py-1 text-[11px] flex items-center gap-1">
              {loading === "push" ? <Loader2 size={10} className="animate-spin" /> : <Icon size={10} />}
              {CTA_LABELS[item.category] ?? "Push"}
            </button>
            <button onClick={() => setExpanded(false)}
              className="px-2 py-1 text-[11px] text-text-tertiary hover:text-text-primary rounded-md transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-[10px] text-danger px-3 pb-2">{error}</p>}
    </div>
  );
}

// ── Partner reassignment pill ──

/**
 * The contact pill on each action row. For partnership journeys (2+ partners
 * mapped to the call) it becomes a dropdown so the rep can reassign the action
 * to the other partner with one click. For single-contact calls it renders as
 * a plain read-only pill.
 */
function PartnerPill({ contactId, contactName, partnerOptions, onReassign, loading }: {
  contactId: string | null;
  contactName: string;
  partnerOptions: PartnerOption[];
  onReassign: (partner: PartnerOption) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const isPartnership = partnerOptions.length >= 2;
  const others = partnerOptions.filter((p) => p.id !== contactId);

  if (!isPartnership) {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-nah-blue/10 text-nah-blue flex items-center gap-0.5">
        <User size={8} /> {contactName}
      </span>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        disabled={loading}
        className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-nah-blue/10 text-nah-blue flex items-center gap-0.5 hover:bg-nah-blue/20 transition-colors"
      >
        {loading ? <Loader2 size={8} className="animate-spin" /> : <User size={8} />}
        {contactName}
        <ChevronDown size={8} />
      </button>
      {open && others.length > 0 && (
        <div className="absolute z-30 mt-1 left-0 bg-white border border-border-default rounded-md shadow-lg min-w-[140px] overflow-hidden">
          <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border-default">
            Reassign to partner
          </div>
          {others.map((p) => (
            <button
              key={p.id}
              onClick={(e) => { e.stopPropagation(); setOpen(false); onReassign(p); }}
              className="w-full text-left px-2 py-1.5 text-[11px] text-text-primary hover:bg-bg-secondary transition-colors flex items-center gap-1"
            >
              <User size={10} /> {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Inline editable field components ──

const LABEL = "text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-0.5 block";
const INPUT = "w-full bg-white border border-border-default rounded-md px-2 py-1 text-[12px] text-text-primary";

/** Searchable dropdown for contacts (with API search) */
function ContactSearchDropdown({ value, detail, onSelect, placeholder }: {
  value: string;
  detail: string;
  onSelect: (name: string, email: string, phone: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ContactOption[]>([]);
  const [searching, setSearching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiFetch(`/api/contacts/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.contacts ?? []);
        }
      } catch { /* silent */ }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(true)}
        className={`${INPUT} cursor-pointer flex items-center gap-1 min-h-[28px]`}
      >
        {value ? (
          <div className="flex-1 min-w-0">
            <span className="text-[12px] text-text-primary">{value}</span>
            {detail && <span className="text-[10px] text-text-tertiary ml-1">{detail}</span>}
          </div>
        ) : (
          <span className="text-[12px] text-text-tertiary">{placeholder ?? "Select contact..."}</span>
        )}
        <ChevronDown size={10} className="text-text-tertiary flex-shrink-0" />
      </div>
      {open && (
        <div className="absolute z-20 mt-0.5 w-full bg-white border border-border-default rounded-md shadow-lg max-h-48 overflow-hidden">
          <div className="flex items-center gap-1 px-2 py-1 border-b border-border-default">
            <Search size={10} className="text-text-tertiary" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contacts..."
              className="flex-1 text-[11px] text-text-primary outline-none bg-transparent placeholder:text-text-tertiary"
            />
            {searching && <Loader2 size={10} className="animate-spin text-text-tertiary" />}
          </div>
          <div className="overflow-y-auto max-h-36">
            {results.length === 0 && query.length >= 2 && !searching && (
              <div className="px-2 py-2 text-[10px] text-text-tertiary text-center">No contacts found</div>
            )}
            {results.map((c) => (
              <button
                key={c.id}
                onClick={() => { onSelect(c.name, c.email ?? "", c.phone ?? ""); setOpen(false); setQuery(""); }}
                className="w-full text-left px-2 py-1.5 hover:bg-bg-secondary transition-colors"
              >
                <div className="text-[11px] font-medium text-text-primary">{c.name}</div>
                <div className="text-[10px] text-text-tertiary">
                  {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact info"}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Dropdown for team members (static list — no API call needed) */
function TeamMemberDropdown({ value, detail, teamMembers, channel, onSelect }: {
  value: string;
  detail: string;
  teamMembers: TeamMember[];
  channel: string;
  onSelect: (name: string, email: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = filter
    ? teamMembers.filter((m) => m.name.toLowerCase().includes(filter.toLowerCase()) || m.email.toLowerCase().includes(filter.toLowerCase()))
    : teamMembers;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(true)}
        className={`${INPUT} cursor-pointer flex items-center gap-1 min-h-[28px]`}
      >
        {value ? (
          <div className="flex-1 min-w-0">
            <span className="text-[12px] text-text-primary">{value}</span>
            {detail && <span className="text-[10px] text-text-tertiary ml-1">{detail}</span>}
          </div>
        ) : (
          <span className="text-[12px] text-text-tertiary">Select team member...</span>
        )}
        <ChevronDown size={10} className="text-text-tertiary flex-shrink-0" />
      </div>
      {open && (
        <div className="absolute z-20 mt-0.5 w-full bg-white border border-border-default rounded-md shadow-lg max-h-48 overflow-hidden">
          <div className="flex items-center gap-1 px-2 py-1 border-b border-border-default">
            <Search size={10} className="text-text-tertiary" />
            <input
              autoFocus
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter team..."
              className="flex-1 text-[11px] text-text-primary outline-none bg-transparent placeholder:text-text-tertiary"
            />
          </div>
          <div className="overflow-y-auto max-h-36">
            {filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => { onSelect(m.name, m.email); setOpen(false); setFilter(""); }}
                className="w-full text-left px-2 py-1.5 hover:bg-bg-secondary transition-colors"
              >
                <div className="text-[11px] font-medium text-text-primary">{m.name}</div>
                <div className="text-[10px] text-text-tertiary">{m.email}</div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-2 text-[10px] text-text-tertiary text-center">No match</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CommsFields({ fields, setField, teamMembers, contactEmail, contactPhone }: {
  fields: Record<string, string>;
  setField: (k: string, v: string) => void;
  teamMembers: TeamMember[];
  contactEmail: string | null;
  contactPhone: string | null;
}) {
  const channel = fields.comms_channel ?? "sms";
  const isEmail = channel === "email";

  // Derive display details for To/From based on channel
  const toDetail = isEmail ? (fields.comms_to_email || "") : (fields.comms_to_phone || "");
  const fromDetail = fields.comms_from_email || "";

  return (
    <div className="space-y-1.5">
      <div>
        <label className={LABEL}>Channel</label>
        <div className="flex gap-1">
          {(["sms", "email"] as const).map((ch) => (
            <button key={ch} onClick={() => setField("comms_channel", ch)}
              className={`px-2.5 py-0.5 text-[10px] rounded-md font-medium ${channel === ch ? "bg-nah-blue text-white" : "bg-bg-tertiary text-text-tertiary"}`}>
              {ch === "email" ? "Email" : "SMS"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className={LABEL}>To {isEmail ? "(email)" : "(phone)"}</label>
          <ContactSearchDropdown
            value={fields.contact_name ?? ""}
            detail={toDetail}
            placeholder="Search contacts..."
            onSelect={(name, email, phone) => {
              setField("contact_name", name);
              setField("comms_to_email", email);
              setField("comms_to_phone", phone);
            }}
          />
        </div>
        <div>
          <label className={LABEL}>From {isEmail ? "(email)" : ""}</label>
          <TeamMemberDropdown
            value={fields.assigned_to_name ?? ""}
            detail={fromDetail}
            teamMembers={teamMembers}
            channel={channel}
            onSelect={(name, email) => {
              setField("assigned_to_name", name);
              setField("comms_from_email", email);
            }}
          />
        </div>
      </div>
      {isEmail && (
        <div><label className={LABEL}>Subject</label><input type="text" value={fields.comms_subject ?? ""} onChange={(e) => setField("comms_subject", e.target.value)} className={INPUT} /></div>
      )}
      <div><label className={LABEL}>Message</label><textarea value={fields.comms_body ?? ""} onChange={(e) => setField("comms_body", e.target.value)} rows={3} className={INPUT + " resize-none"} /></div>
    </div>
  );
}

function AptFields({ fields, setField, teamMembers }: { fields: Record<string, string>; setField: (k: string, v: string) => void; teamMembers: TeamMember[] }) {
  return (
    <div className="space-y-1.5">
      <div><label className={LABEL}>Title</label><input type="text" value={fields.apt_title ?? ""} onChange={(e) => setField("apt_title", e.target.value)} className={INPUT} /></div>
      <div className="grid grid-cols-2 gap-1.5">
        <div><label className={LABEL}>Date & Time</label><input type="datetime-local" value={fields.apt_date_time ?? ""} onChange={(e) => setField("apt_date_time", e.target.value)} className={INPUT} /></div>
        <div><label className={LABEL}>Assigned To</label>
          <select value={fields.assigned_to ?? ""} onChange={(e) => setField("assigned_to", e.target.value)} className={INPUT}>
            <option value="">Select...</option>
            {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div><label className={LABEL}>Contact</label><input type="text" value={fields.contact_name ?? ""} onChange={(e) => setField("contact_name", e.target.value)} className={INPUT} /></div>
        <div><label className={LABEL}>Duration (min)</label><input type="number" value={fields.apt_duration_minutes ?? "30"} onChange={(e) => setField("apt_duration_minutes", e.target.value)} className={INPUT} /></div>
      </div>
      <div><label className={LABEL}>Notes</label><textarea value={fields.apt_notes ?? ""} onChange={(e) => setField("apt_notes", e.target.value)} rows={2} className={INPUT + " resize-none"} /></div>
    </div>
  );
}

function TaskFields({ fields, setField, teamMembers }: { fields: Record<string, string>; setField: (k: string, v: string) => void; teamMembers: TeamMember[] }) {
  return (
    <div className="space-y-1.5">
      <div><label className={LABEL}>Title</label><input type="text" value={fields.task_title ?? ""} onChange={(e) => setField("task_title", e.target.value)} className={INPUT} /></div>
      <div><label className={LABEL}>Description</label><textarea value={fields.task_description ?? ""} onChange={(e) => setField("task_description", e.target.value)} rows={2} className={INPUT + " resize-none"} /></div>
      <div className="grid grid-cols-3 gap-1.5">
        <div><label className={LABEL}>Due Date</label><input type="date" value={fields.task_due_date ?? ""} onChange={(e) => setField("task_due_date", e.target.value)} className={INPUT} /></div>
        <div><label className={LABEL}>Assigned To</label>
          <select value={fields.assigned_to ?? ""} onChange={(e) => setField("assigned_to", e.target.value)} className={INPUT}>
            <option value="">Select...</option>
            {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div><label className={LABEL}>Contact</label><input type="text" value={fields.contact_name ?? ""} onChange={(e) => setField("contact_name", e.target.value)} className={INPUT} /></div>
      </div>
    </div>
  );
}

function NoteFields({ fields, setField }: { fields: Record<string, string>; setField: (k: string, v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <div><label className={LABEL}>Note</label><textarea value={fields.note_body ?? ""} onChange={(e) => setField("note_body", e.target.value)} rows={4} className={INPUT + " resize-none"} /></div>
      <div><label className={LABEL}>Contact</label><input type="text" value={fields.contact_name ?? ""} onChange={(e) => setField("contact_name", e.target.value)} className={INPUT} /></div>
    </div>
  );
}

// ── Initialize form fields from item metadata ──

function initFields(item: ActionItemData, contactEmail: string | null, contactPhone: string | null): Record<string, string> {
  const meta = item.metadata ?? {};
  const base: Record<string, string> = {
    contact_name: item.contact_name ?? "",
    assigned_to_name: item.assigned_to_name ?? "",
  };

  switch (item.category) {
    case "apt":
      return { ...base, apt_title: str(meta.apt_title) || item.title, apt_date_time: str(meta.apt_date_time), apt_duration_minutes: str(meta.apt_duration_minutes) || "30", apt_notes: str(meta.apt_notes), assigned_to: "" };
    case "comms":
      return {
        ...base,
        comms_channel: str(meta.comms_channel) || "sms",
        comms_subject: str(meta.comms_subject),
        comms_body: str(meta.comms_body) || item.description || "",
        comms_to_email: str(meta.comms_to_email) || contactEmail || "",
        comms_to_phone: str(meta.comms_to_phone) || contactPhone || "",
        comms_from_email: str(meta.comms_from_email) || "",
      };
    case "task":
      return { ...base, task_title: str(meta.task_title) || item.title, task_description: str(meta.task_description) || item.description || "", task_due_date: str(meta.task_due_date) || todayISO(), assigned_to: "" };
    case "note":
      return { ...base, note_body: str(meta.note_body) || item.description || "" };
    case "pipeline":
      return {
        ...base,
        pipeline_action: str(meta.pipeline_action),
        pipeline_name: str(meta.pipeline_name),
        pipeline_stage: str(meta.pipeline_stage),
        subtask_name: str(meta.subtask_name),
        stage_from: str(meta.stage_from),
        stage_to: str(meta.stage_to),
        pipeline_from: str(meta.pipeline_from),
        pipeline_to: str(meta.pipeline_to),
      };
    default:
      return base;
  }
}

function str(v: unknown): string { return v != null ? String(v) : ""; }
function todayISO(): string { return new Date().toISOString().split("T")[0]; }

/** Brief one-liner for the collapsed view based on category */
function getSummaryDetail(category: string, fields: Record<string, string>): string | null {
  switch (category) {
    case "comms": {
      const isEmail = fields.comms_channel === "email";
      const detail = isEmail ? (fields.comms_to_email || "") : (fields.comms_to_phone || "");
      if (detail) return `${isEmail ? "Email" : "SMS"} → ${detail}`;
      const body = (fields.comms_body ?? "").split("\n")[0].slice(0, 50);
      return body ? `${isEmail ? "Email" : "SMS"}: ${body}${body.length >= 50 ? "…" : ""}` : (isEmail ? "Email" : "SMS");
    }
    case "apt": {
      const dt = fields.apt_date_time;
      if (!dt) return null;
      try {
        return `${new Date(dt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${fields.apt_duration_minutes ?? "30"}min`;
      } catch { return null; }
    }
    case "task": {
      const due = fields.task_due_date;
      if (!due) return null;
      try {
        return `Due: ${new Date(due + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      } catch { return null; }
    }
    case "note": {
      const body = (fields.note_body ?? "").split("\n")[0].slice(0, 60);
      return body ? `${body}${body.length >= 60 ? "…" : ""}` : null;
    }
    case "pipeline": {
      const pName = fields.pipeline_name || "";
      const stage = fields.pipeline_stage || "";
      const subtask = fields.subtask_name || "";
      if (fields.pipeline_action === "advance_stage") return `${fields.stage_from ?? ""} → ${fields.stage_to ?? ""}`;
      if (fields.pipeline_action === "move_pipeline") return `${fields.pipeline_from ?? ""} → ${fields.pipeline_to ?? ""}: ${fields.stage_to ?? ""}`;
      if (subtask) return pName ? `${pName} · ${stage}: ${subtask}` : `${stage}: ${subtask}`;
      return stage || pName || null;
    }
    default:
      return null;
  }
}
