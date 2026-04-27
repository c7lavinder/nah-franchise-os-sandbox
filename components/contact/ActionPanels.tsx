"use client";

/**
 * ActionPanels — in-app SMS, Email, Call, and Schedule panels for contact page.
 * Replaces browser-native tel:/sms:/mailto: links with GHL-integrated panels.
 * Follows Draft → Review → Confirm pattern per CLAUDE.md.
 */

import { useEffect, useState } from "react";
import {
  X, Send, Loader2, Sparkles, Phone, MessageSquare,
  Mail, Calendar, Clock, ChevronDown, Check,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Shared overlay wrapper                                             */
/* ------------------------------------------------------------------ */

function PanelOverlay({
  title,
  icon: Icon,
  color,
  onClose,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-primary border border-border-default rounded-xl shadow-2xl w-full max-w-lg animate-in fade-in slide-in-from-top-4 duration-200">
        {/* Header */}
        <div className={`flex items-center gap-2 px-5 py-3 border-b border-border-default bg-gradient-to-r ${color} rounded-t-xl`}>
          <Icon size={16} className="text-white" />
          <h3 className="text-body-sm font-semibold text-white flex-1">{title}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dropdown helper                                                    */
/* ------------------------------------------------------------------ */

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] font-medium text-text-tertiary tracking-wider block mb-1">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary appearance-none pr-8 focus:outline-none focus:ring-1 focus:ring-nah-blue"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SMS Panel                                                          */
/* ------------------------------------------------------------------ */

interface SMSPanelProps {
  contactId: string;
  contactName: string;
  contactPhone: string | null;
  onClose: () => void;
  onSent: () => void;
}

export function SMSPanel({ contactId, contactName, contactPhone, onClose, onSent }: SMSPanelProps) {
  const [fromNumber] = useState("+1 (888) NAH-FLIP");
  const [toNumber, setToNumber] = useState(contactPhone ?? "");
  const [message, setMessage] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [sent, setSent] = useState(false);

  const toOptions = contactPhone
    ? [{ label: `${contactName} — ${contactPhone}`, value: contactPhone }]
    : [{ label: "No phone number on file", value: "" }];

  async function handleAIDraft() {
    if (!aiPrompt.trim()) return;
    setDrafting(true);
    try {
      const res = await fetch("/api/scout/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Draft a short SMS message to ${contactName} about: ${aiPrompt}. Keep it under 160 characters, professional but warm. Return ONLY the message text, no quotes or explanation.` }],
          context: `sms-draft for contact ${contactId}`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.reply ?? data.message ?? "";
        setMessage(text.replace(/^["']|["']$/g, ""));
      }
    } catch { /* keep current */ }
    setDrafting(false);
    setAiPrompt("");
  }

  async function handleSend() {
    if (!message.trim() || !toNumber) return;
    setSending(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "SMS", message: message.trim() }),
      });
      if (res.ok) {
        setSent(true);
        setTimeout(() => { onSent(); onClose(); }, 1200);
      }
    } catch { /* keep panel open */ }
    setSending(false);
  }

  if (sent) {
    return (
      <PanelOverlay title="Text Message" icon={MessageSquare} color="from-info to-blue-600" onClose={onClose}>
        <div className="flex flex-col items-center py-6 gap-2">
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
            <Send size={20} className="text-success" />
          </div>
          <p className="text-body-sm font-medium text-text-primary">Message sent!</p>
        </div>
      </PanelOverlay>
    );
  }

  return (
    <PanelOverlay title="Text Message" icon={MessageSquare} color="from-info to-blue-600" onClose={onClose}>
      <FieldSelect label="FROM" value={fromNumber} options={[{ label: fromNumber, value: fromNumber }]} onChange={() => {}} />
      <FieldSelect label="TO" value={toNumber} options={toOptions} onChange={setToNumber} />

      {/* AI Draft */}
      <div>
        <label className="text-[10px] font-medium text-text-tertiary tracking-wider block mb-1">AI DRAFT</label>
        <div className="flex gap-2">
          <input
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleAIDraft(); }}
            placeholder="Tell Scout what to write..."
            className="flex-1 bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-scout-purple"
          />
          <button
            onClick={() => void handleAIDraft()}
            disabled={drafting || !aiPrompt.trim()}
            className="px-3 py-2 rounded-lg bg-scout-purple/10 text-scout-purple hover:bg-scout-purple/20 transition-colors disabled:opacity-40"
          >
            {drafting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          </button>
        </div>
      </div>

      {/* Message body */}
      <div>
        <label className="text-[10px] font-medium text-text-tertiary tracking-wider block mb-1">MESSAGE</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Type your message..."
          className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary resize-none focus:outline-none focus:ring-1 focus:ring-info"
        />
        <span className="text-[10px] text-text-tertiary">{message.length}/160</span>
      </div>

      <button
        onClick={() => void handleSend()}
        disabled={sending || !message.trim() || !toNumber}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-info text-white font-medium text-body-sm hover:bg-blue-600 transition-colors disabled:opacity-40"
      >
        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        Send Text
      </button>
    </PanelOverlay>
  );
}

/* ------------------------------------------------------------------ */
/*  Email Panel                                                        */
/* ------------------------------------------------------------------ */

interface EmailPanelProps {
  contactId: string;
  contactName: string;
  contactEmail: string | null;
  onClose: () => void;
  onSent: () => void;
}

export function EmailPanel({ contactId, contactName, contactEmail, onClose, onSent }: EmailPanelProps) {
  const [fromEmail] = useState("notifications@newagainhouses.com");
  const [toEmail, setToEmail] = useState(contactEmail ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [sent, setSent] = useState(false);

  const toOptions = contactEmail
    ? [{ label: `${contactName} — ${contactEmail}`, value: contactEmail }]
    : [{ label: "No email on file", value: "" }];

  async function handleAIDraft() {
    if (!aiPrompt.trim()) return;
    setDrafting(true);
    try {
      const res = await fetch("/api/scout/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Draft a professional email to ${contactName} about: ${aiPrompt}. Return a JSON object with "subject" and "body" fields. The body should be plain text, professional but warm. No markdown.` }],
          context: `email-draft for contact ${contactId}`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.reply ?? data.message ?? "";
        try {
          const parsed = JSON.parse(text);
          if (parsed.subject) setSubject(parsed.subject);
          if (parsed.body) setBody(parsed.body);
        } catch {
          setBody(text.replace(/^["']|["']$/g, ""));
        }
      }
    } catch { /* keep current */ }
    setDrafting(false);
    setAiPrompt("");
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim() || !toEmail) return;
    setSending(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "Email",
          subject: subject.trim(),
          html: body.trim().replace(/\n/g, "<br/>"),
          emailFrom: fromEmail,
        }),
      });
      if (res.ok) {
        setSent(true);
        setTimeout(() => { onSent(); onClose(); }, 1200);
      }
    } catch { /* keep panel open */ }
    setSending(false);
  }

  if (sent) {
    return (
      <PanelOverlay title="Email" icon={Mail} color="from-scout-purple to-purple-700" onClose={onClose}>
        <div className="flex flex-col items-center py-6 gap-2">
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
            <Send size={20} className="text-success" />
          </div>
          <p className="text-body-sm font-medium text-text-primary">Email sent!</p>
        </div>
      </PanelOverlay>
    );
  }

  return (
    <PanelOverlay title="Email" icon={Mail} color="from-scout-purple to-purple-700" onClose={onClose}>
      <FieldSelect label="FROM" value={fromEmail} options={[{ label: fromEmail, value: fromEmail }]} onChange={() => {}} />
      <FieldSelect label="TO" value={toEmail} options={toOptions} onChange={setToEmail} />

      {/* Subject */}
      <div>
        <label className="text-[10px] font-medium text-text-tertiary tracking-wider block mb-1">SUBJECT</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Email subject..."
          className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-scout-purple"
        />
      </div>

      {/* AI Draft */}
      <div>
        <label className="text-[10px] font-medium text-text-tertiary tracking-wider block mb-1">AI DRAFT</label>
        <div className="flex gap-2">
          <input
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleAIDraft(); }}
            placeholder="Tell Scout what to write..."
            className="flex-1 bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-scout-purple"
          />
          <button
            onClick={() => void handleAIDraft()}
            disabled={drafting || !aiPrompt.trim()}
            className="px-3 py-2 rounded-lg bg-scout-purple/10 text-scout-purple hover:bg-scout-purple/20 transition-colors disabled:opacity-40"
          >
            {drafting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          </button>
        </div>
      </div>

      {/* Body */}
      <div>
        <label className="text-[10px] font-medium text-text-tertiary tracking-wider block mb-1">BODY</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          placeholder="Write your email..."
          className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary resize-none focus:outline-none focus:ring-1 focus:ring-scout-purple"
        />
      </div>

      <button
        onClick={() => void handleSend()}
        disabled={sending || !subject.trim() || !body.trim() || !toEmail}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-scout-purple text-white font-medium text-body-sm hover:bg-purple-700 transition-colors disabled:opacity-40"
      >
        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        Send Email
      </button>
    </PanelOverlay>
  );
}

/* ------------------------------------------------------------------ */
/*  Call Panel                                                         */
/* ------------------------------------------------------------------ */

interface CallPanelProps {
  contactId: string;
  contactName: string;
  contactPhone: string | null;
  onClose: () => void;
  onLogged?: () => void;
}

/**
 * Log a call to GHL.
 *
 * The previous version simulated a connect with setTimeout. We don't
 * have telephony provisioned (GHL doesn't expose a programmatic dial
 * endpoint without Twilio + LC Phone numbers), so this is a record-
 * keeping panel: the user dials from their own phone, then comes back
 * here to log what happened. The log is written as a GHL note on the
 * contact so it lives on the timeline. An optional follow-up task can
 * be created in the same step.
 */
const CALL_OUTCOMES = [
  { value: "connected", label: "Connected — full conversation" },
  { value: "voicemail", label: "Voicemail left" },
  { value: "no_answer", label: "No answer" },
  { value: "busy", label: "Busy / call back" },
  { value: "wrong_number", label: "Wrong number" },
  { value: "bad_number", label: "Bad / disconnected number" },
] as const;

type CallOutcome = (typeof CALL_OUTCOMES)[number]["value"];

const FOLLOWUP_DEFAULTS: Record<CallOutcome, { title: string; daysOut: number } | null> = {
  connected: null,
  voicemail: { title: "Follow up after voicemail", daysOut: 2 },
  no_answer: { title: "Retry call", daysOut: 1 },
  busy: { title: "Retry call", daysOut: 1 },
  wrong_number: null,
  bad_number: null,
};

export function CallPanel({ contactId, contactName, contactPhone, onClose, onLogged }: CallPanelProps) {
  const [outcome, setOutcome] = useState<CallOutcome>("connected");
  const [durationMin, setDurationMin] = useState("5");
  const [notes, setNotes] = useState("");
  const [createFollowup, setCreateFollowup] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [logged, setLogged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset follow-up checkbox when outcome changes to one without a default task
  useEffect(() => {
    setCreateFollowup(FOLLOWUP_DEFAULTS[outcome] !== null);
  }, [outcome]);

  async function handleLog() {
    setError(null);
    setSubmitting(true);

    const outcomeLabel = CALL_OUTCOMES.find((o) => o.value === outcome)?.label ?? outcome;
    const lines = [
      `Outbound call — ${outcomeLabel}`,
      `Phone: ${contactPhone ?? "(none on file)"}`,
    ];
    if (outcome === "connected" && durationMin) {
      lines.push(`Duration: ~${durationMin} min`);
    }
    if (notes.trim()) {
      lines.push("", notes.trim());
    }
    const noteBody = lines.join("\n");

    try {
      // 1. Always log a note
      const noteRes = await fetch(`/api/contacts/${contactId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody }),
      });
      if (!noteRes.ok) {
        const data = await noteRes.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(data.error ?? "Failed to log call");
      }

      // 2. Optionally create a follow-up task
      const followup = FOLLOWUP_DEFAULTS[outcome];
      if (createFollowup && followup) {
        const due = new Date(Date.now() + followup.daysOut * 24 * 60 * 60 * 1000).toISOString();
        await fetch(`/api/contacts/${contactId}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: followup.title,
            dueDate: due,
            body: `Auto-created from call log (${outcomeLabel})`,
          }),
        });
      }

      setLogged(true);
      setTimeout(() => {
        onLogged?.();
        onClose();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log call");
    } finally {
      setSubmitting(false);
    }
  }

  if (logged) {
    return (
      <PanelOverlay title="Call Logged" icon={Phone} color="from-success to-green-700" onClose={onClose}>
        <div className="flex flex-col items-center py-6 gap-2">
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
            <Check size={20} className="text-success" />
          </div>
          <p className="text-body-sm font-medium text-text-primary">Call logged to {contactName}</p>
          <p className="text-caption text-text-tertiary">Saved as a note in GHL.</p>
        </div>
      </PanelOverlay>
    );
  }

  return (
    <PanelOverlay title="Log Call" icon={Phone} color="from-success to-green-700" onClose={onClose}>
      <div className="bg-bg-secondary border border-border-default rounded-lg p-3 text-center">
        <p className="text-caption text-text-secondary">
          {contactName}{contactPhone ? ` — ${contactPhone}` : ""}
        </p>
        <p className="text-[10px] text-text-tertiary mt-1">
          Dial from your phone, then come back to log the call.
        </p>
      </div>

      <FieldSelect
        label="OUTCOME"
        value={outcome}
        options={CALL_OUTCOMES.map((o) => ({ label: o.label, value: o.value }))}
        onChange={(v) => setOutcome(v as CallOutcome)}
      />

      {outcome === "connected" && (
        <div>
          <label className="text-[10px] font-medium text-text-tertiary tracking-wider block mb-1">DURATION (MINUTES)</label>
          <input
            type="number"
            min="1"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-success"
          />
        </div>
      )}

      <div>
        <label className="text-[10px] font-medium text-text-tertiary tracking-wider block mb-1">NOTES (OPTIONAL)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="What was discussed, next steps, key info captured…"
          className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-success resize-y"
        />
      </div>

      {FOLLOWUP_DEFAULTS[outcome] && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={createFollowup}
            onChange={(e) => setCreateFollowup(e.target.checked)}
            className="rounded border-border-default text-success focus:ring-success"
          />
          <span className="text-body-sm text-text-secondary">
            Create follow-up task: &quot;{FOLLOWUP_DEFAULTS[outcome]?.title}&quot;
            {" — due in "}{FOLLOWUP_DEFAULTS[outcome]?.daysOut}d
          </span>
        </label>
      )}

      {error && (
        <p className="text-caption text-danger">{error}</p>
      )}

      <button
        onClick={() => void handleLog()}
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-success text-white font-medium text-body-sm hover:bg-green-700 transition-colors disabled:opacity-40"
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
        {submitting ? "Logging…" : "Log Call"}
      </button>
    </PanelOverlay>
  );
}

/* ------------------------------------------------------------------ */
/*  Schedule Appointment Panel                                         */
/* ------------------------------------------------------------------ */

interface SchedulePanelProps {
  contactId: string;
  contactName: string;
  contactEmail: string | null;
  onClose: () => void;
  onScheduled: () => void;
}

interface CalendarOption {
  id: string;
  name: string;
  description?: string;
}

export function SchedulePanel({ contactId, contactName, contactEmail, onClose, onScheduled }: SchedulePanelProps) {
  const [calendars, setCalendars] = useState<CalendarOption[] | null>(null);
  const [calendarId, setCalendarId] = useState<string>("");
  const [calendarName, setCalendarName] = useState<string>("");
  const [calendarSearch, setCalendarSearch] = useState("");
  const [calendarPickerOpen, setCalendarPickerOpen] = useState(false);
  const [title, setTitle] = useState(`Meeting with ${contactName}`);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState("30");
  const [timezone, setTimezone] = useState("America/New_York");
  const [sendInvite, setSendInvite] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch real calendars from GHL on mount. The previous version had a
  // hardcoded "default" calendar ID that wasn't a real GHL calendar — the
  // appointment POST would have failed in production.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/ghl/calendars")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load calendars"))))
      .then((data) => {
        if (cancelled) return;
        const list = (data.calendars ?? []) as CalendarOption[];
        setCalendars(list);
        if (list.length > 0) {
          setCalendarId(list[0].id);
          setCalendarName(list[0].name);
        }
      })
      .catch(() => {
        if (!cancelled) setCalendars([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const timezoneOptions = [
    { label: "Eastern (ET)", value: "America/New_York" },
    { label: "Central (CT)", value: "America/Chicago" },
    { label: "Mountain (MT)", value: "America/Denver" },
    { label: "Pacific (PT)", value: "America/Los_Angeles" },
  ];

  const durationOptions = [
    { label: "15 min", value: "15" },
    { label: "30 min", value: "30" },
    { label: "45 min", value: "45" },
    { label: "60 min", value: "60" },
  ];

  async function handleSchedule() {
    if (!date || !time) return;
    if (!calendarId) {
      setError("Please pick a calendar.");
      return;
    }
    setError(null);
    setScheduling(true);

    const startTime = new Date(`${date}T${time}:00`).toISOString();
    const endMs = new Date(`${date}T${time}:00`).getTime() + parseInt(duration) * 60 * 1000;
    const endTime = new Date(endMs).toISOString();

    try {
      const res = await fetch(`/api/contacts/${contactId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarId, title, startTime, endTime, timezone }),
      });
      if (res.ok) {
        setScheduled(true);
        setTimeout(() => { onScheduled(); onClose(); }, 1200);
      } else {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        setError(data.error ?? "Failed to schedule");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule");
    }
    setScheduling(false);
  }

  if (scheduled) {
    return (
      <PanelOverlay title="Schedule Appointment" icon={Calendar} color="from-nah-orange to-orange-600" onClose={onClose}>
        <div className="flex flex-col items-center py-6 gap-2">
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
            <Calendar size={20} className="text-success" />
          </div>
          <p className="text-body-sm font-medium text-text-primary">Appointment scheduled!</p>
        </div>
      </PanelOverlay>
    );
  }

  return (
    <PanelOverlay title="Schedule Appointment" icon={Calendar} color="from-nah-orange to-orange-600" onClose={onClose}>
      {/* Calendar picker — searchable, populated from GHL */}
      <div>
        <label className="text-[10px] font-medium text-text-tertiary tracking-wider block mb-1">CALENDAR</label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setCalendarPickerOpen((v) => !v)}
            className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary text-left flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-nah-orange"
          >
            <span className="truncate">
              {calendarName || (calendars === null ? "Loading…" : "Select calendar")}
            </span>
            <ChevronDown size={14} className="text-text-tertiary" />
          </button>
          {calendarPickerOpen && (
            <div className="absolute z-10 mt-1 w-full bg-bg-primary border border-border-default rounded-lg shadow-lg max-h-64 overflow-hidden flex flex-col">
              <input
                type="text"
                value={calendarSearch}
                onChange={(e) => setCalendarSearch(e.target.value)}
                placeholder="Search calendars..."
                className="px-3 py-2 text-body-sm border-b border-border-default bg-transparent outline-none"
                autoFocus
              />
              <div className="overflow-y-auto flex-1">
                {calendars === null ? (
                  <div className="px-3 py-2 text-caption text-text-tertiary">Loading…</div>
                ) : calendars.length === 0 ? (
                  <div className="px-3 py-2 text-caption text-text-tertiary">No calendars found</div>
                ) : (
                  calendars
                    .filter((c) =>
                      !calendarSearch.trim()
                        ? true
                        : c.name.toLowerCase().includes(calendarSearch.toLowerCase().trim())
                    )
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCalendarId(c.id);
                          setCalendarName(c.name);
                          setCalendarPickerOpen(false);
                          setCalendarSearch("");
                        }}
                        className="w-full text-left px-3 py-2 text-body-sm hover:bg-bg-secondary"
                      >
                        <div className="font-medium">{c.name}</div>
                        {c.description && (
                          <div className="text-caption text-text-tertiary truncate">
                            {c.description}
                          </div>
                        )}
                      </button>
                    ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="text-[10px] font-medium text-text-tertiary tracking-wider block mb-1">TITLE</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-nah-orange"
        />
      </div>

      {/* Date + Time row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-medium text-text-tertiary tracking-wider block mb-1">DATE</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-nah-orange"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-text-tertiary tracking-wider block mb-1">TIME</label>
          <div className="relative">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-nah-orange"
            />
            <Clock size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Duration + Timezone row */}
      <div className="grid grid-cols-2 gap-3">
        <FieldSelect label="DURATION" value={duration} options={durationOptions} onChange={setDuration} />
        <FieldSelect label="TIMEZONE" value={timezone} options={timezoneOptions} onChange={setTimezone} />
      </div>

      {/* Email invite toggle */}
      {contactEmail && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={sendInvite}
            onChange={(e) => setSendInvite(e.target.checked)}
            className="rounded border-border-default text-nah-orange focus:ring-nah-orange"
          />
          <span className="text-body-sm text-text-secondary">
            Send email invite to {contactEmail}
          </span>
        </label>
      )}

      {error && (
        <p className="text-caption text-danger">{error}</p>
      )}

      <button
        onClick={() => void handleSchedule()}
        disabled={scheduling || !date || !time || !calendarId}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-nah-orange text-white font-medium text-body-sm hover:bg-orange-600 transition-colors disabled:opacity-40"
      >
        {scheduling ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
        Schedule Appointment
      </button>
    </PanelOverlay>
  );
}
