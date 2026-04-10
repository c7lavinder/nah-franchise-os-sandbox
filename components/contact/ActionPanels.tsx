"use client";

/**
 * ActionPanels — in-app SMS, Email, Call, and Schedule panels for contact page.
 * Replaces browser-native tel:/sms:/mailto: links with GHL-integrated panels.
 * Follows Draft → Review → Confirm pattern per CLAUDE.md.
 */

import { useState } from "react";
import {
  X, Send, Loader2, Sparkles, Phone, MessageSquare,
  Mail, Calendar, Clock, ChevronDown,
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
  contactName: string;
  contactPhone: string | null;
  onClose: () => void;
}

export function CallPanel({ contactName, contactPhone, onClose }: CallPanelProps) {
  const [fromNumber] = useState("+1 (888) NAH-FLIP");
  const [toNumber, setToNumber] = useState(contactPhone ?? "");
  const [calling, setCalling] = useState(false);
  const [connected, setConnected] = useState(false);

  const toOptions = contactPhone
    ? [{ label: `${contactName} — ${contactPhone}`, value: contactPhone }]
    : [{ label: "No phone number on file", value: "" }];

  function handleCall() {
    if (!toNumber) return;
    setCalling(true);
    // Simulate GHL call initiation — in production this triggers GHL's call API
    setTimeout(() => {
      setConnected(true);
      setCalling(false);
    }, 2000);
  }

  return (
    <PanelOverlay title="Call" icon={Phone} color="from-success to-green-700" onClose={onClose}>
      <FieldSelect label="FROM" value={fromNumber} options={[{ label: fromNumber, value: fromNumber }]} onChange={() => {}} />
      <FieldSelect label="TO" value={toNumber} options={toOptions} onChange={setToNumber} />

      {connected ? (
        <div className="flex flex-col items-center py-6 gap-3">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center animate-pulse">
            <Phone size={24} className="text-success" />
          </div>
          <p className="text-body-sm font-medium text-text-primary">Connected to {contactName}</p>
          <p className="text-caption text-text-tertiary">Call in progress via GHL</p>
          <button
            onClick={onClose}
            className="mt-2 px-6 py-2 rounded-lg bg-danger text-white font-medium text-body-sm hover:bg-red-700 transition-colors"
          >
            End Call
          </button>
        </div>
      ) : (
        <>
          <div className="bg-bg-secondary border border-border-default rounded-lg p-4 text-center">
            <p className="text-caption text-text-tertiary mb-1">Calls are initiated through GHL</p>
            <p className="text-[10px] text-text-tertiary">The call will connect through your GHL phone system</p>
          </div>

          <button
            onClick={handleCall}
            disabled={calling || !toNumber}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-success text-white font-medium text-body-sm hover:bg-green-700 transition-colors disabled:opacity-40"
          >
            {calling ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
            {calling ? "Connecting..." : "Start Call"}
          </button>
        </>
      )}
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

export function SchedulePanel({ contactId, contactName, contactEmail, onClose, onScheduled }: SchedulePanelProps) {
  const [calendarId] = useState("default");
  const [title, setTitle] = useState(`Meeting with ${contactName}`);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState("30");
  const [timezone, setTimezone] = useState("America/New_York");
  const [sendInvite, setSendInvite] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState(false);

  const calendarOptions = [
    { label: "NAH Sales Calendar", value: "default" },
    { label: "Discovery Calls", value: "discovery" },
    { label: "FDD Review", value: "fdd" },
  ];

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
      }
    } catch { /* keep panel open */ }
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
      <FieldSelect label="CALENDAR" value={calendarId} options={calendarOptions} onChange={() => {}} />

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

      <button
        onClick={() => void handleSchedule()}
        disabled={scheduling || !date || !time}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-nah-orange text-white font-medium text-body-sm hover:bg-orange-600 transition-colors disabled:opacity-40"
      >
        {scheduling ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
        Schedule Appointment
      </button>
    </PanelOverlay>
  );
}
