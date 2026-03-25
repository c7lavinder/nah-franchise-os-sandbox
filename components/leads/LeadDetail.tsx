"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X, Phone as PhoneIcon, Mail, Clock, Megaphone,
  Loader2, User,
} from "lucide-react";
import type { GHLContact, GHLNote, GHLTask, GHLMessage } from "@/types/ghl";
import NotesSection from "./NotesSection";
import TaskList from "./TaskList";
import ActivityTimeline from "./ActivityTimeline";
import ScoutActionHistory from "./ScoutActionHistory";

interface LeadDetailProps {
  contactId: string;
  contactName?: string;
  stageName?: string | null;
  onClose: () => void;
}

function getSpecificSource(contact: GHLContact): string {
  const tagMap: Record<string, string> = {
    "google-ads": "Google Ads",
    "facebook": "Facebook",
    "linkedin": "LinkedIn",
    "youtube": "YouTube",
    "fbr": "FBR",
    "website-form": "Website Form",
    "franchise-show": "Franchise Show",
    "referral-corey": "Referral (Corey)",
  };
  for (const tag of contact.tags) {
    if (tagMap[tag]) return tagMap[tag];
  }
  if (contact.tags.includes("referral")) return "Referral";
  if (contact.tags.includes("organic")) return "Organic";
  if (contact.tags.includes("paid-ad")) return "Paid Ad";
  return contact.source ?? "Unknown";
}

export default function LeadDetail({ contactId, contactName, stageName, onClose }: LeadDetailProps) {
  const [contact, setContact] = useState<GHLContact | null>(null);
  const [notes, setNotes] = useState<GHLNote[]>([]);
  const [tasks, setTasks] = useState<GHLTask[]>([]);
  const [messages, setMessages] = useState<GHLMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"notes" | "tasks" | "activity" | "scout">("notes");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`);
      if (res.ok) {
        const data = await res.json();
        setContact(data.contact ?? null);
        setNotes(data.notes ?? []);
        setTasks(data.tasks ?? []);
        setMessages(data.messages ?? []);
      }
    } catch {
      // Continue with empty
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const displayName = contact
    ? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || contactName || "Unknown"
    : contactName || "Loading...";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-bg-primary border-l border-border-default flex flex-col h-full">
        {/* Header */}
        <div className="bg-bg-primary border-b border-border-default px-5 py-4 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-h1 text-text-primary">{displayName}</h2>
              <div className="flex items-center gap-2 mt-1 text-body-sm text-text-secondary">
                {stageName && <span>{stageName}</span>}
                {contact?.source && (
                  <>
                    {stageName && <span className="text-text-tertiary">·</span>}
                    <span className="text-text-tertiary">{getSpecificSource(contact)}</span>
                  </>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1 text-text-tertiary hover:text-text-primary">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-text-tertiary" />
            </div>
          ) : (
            <div className="px-5 py-4 space-y-5">
              {/* Contact Info */}
              <section className="flex flex-wrap gap-x-4 gap-y-2">
                {contact?.phone && (
                  <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-body-sm text-info hover:underline">
                    <PhoneIcon size={13} /> {contact.phone}
                  </a>
                )}
                {contact?.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-body-sm text-info hover:underline">
                    <Mail size={13} /> {contact.email}
                  </a>
                )}
                {contact && (
                  <span className="flex items-center gap-1.5 text-body-sm text-text-secondary">
                    <Megaphone size={13} className="text-scout-purple" /> {getSpecificSource(contact)}
                  </span>
                )}
                {contact?.dateAdded && (
                  <span className="flex items-center gap-1.5 text-body-sm text-text-tertiary">
                    <Clock size={13} /> Since {new Date(contact.dateAdded).toLocaleDateString()}
                  </span>
                )}
              </section>

              {/* Quick Actions */}
              <section className="flex gap-2">
                {contact?.phone && (
                  <a href={`tel:${contact.phone}`} className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border border-border-default rounded-lg hover:border-success hover:bg-success/5 transition-colors text-body-sm text-text-primary">
                    <PhoneIcon size={14} className="text-success" /> Call
                  </a>
                )}
                {contact?.phone && (
                  <a href={`sms:${contact.phone}`} className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border border-border-default rounded-lg hover:border-info hover:bg-info/5 transition-colors text-body-sm text-text-primary">
                    <PhoneIcon size={14} className="text-info" /> Text
                  </a>
                )}
                {contact?.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border border-border-default rounded-lg hover:border-scout-purple hover:bg-scout-purple/5 transition-colors text-body-sm text-text-primary">
                    <Mail size={14} className="text-scout-purple" /> Email
                  </a>
                )}
              </section>

              {/* Tags */}
              {contact && contact.tags.length > 0 && (
                <section className="flex flex-wrap gap-1.5">
                  {contact.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full bg-bg-tertiary text-text-secondary text-caption">{t}</span>
                  ))}
                </section>
              )}

              {/* Tabs */}
              <div className="flex border-b border-border-default">
                {([
                  { key: "notes" as const, label: `Notes (${notes.length})` },
                  { key: "tasks" as const, label: `Tasks (${tasks.length})` },
                  { key: "activity" as const, label: "Comms" },
                  { key: "scout" as const, label: "Scout" },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-2 text-body-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.key
                        ? "border-nah-orange text-nah-orange"
                        : "border-transparent text-text-tertiary hover:text-text-primary"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "notes" && (
                <NotesSection contactId={contactId} notes={notes} onNoteAdded={fetchData} />
              )}
              {activeTab === "tasks" && (
                <TaskList contactId={contactId} tasks={tasks} onTaskUpdated={fetchData} />
              )}
              {activeTab === "activity" && (
                <ActivityTimeline messages={messages} />
              )}
              {activeTab === "scout" && (
                <ScoutActionHistory contactId={contactId} />
              )}
            </div>
          )}
        </div>

        {/* Ask Scout */}
        <div className="bg-bg-primary border-t border-border-default px-5 py-3 flex-shrink-0">
          <a
            href={`/scout?ask=${encodeURIComponent(`Tell me about ${displayName} — what's their current status, recent activity, and what should I do next?`)}`}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-scout-purple/10 border border-scout-purple/30 rounded-lg hover:bg-scout-purple/20 transition-colors text-body-sm text-scout-purple font-medium"
          >
            <User size={16} />
            Ask Scout about {displayName.split(" ")[0]}
          </a>
        </div>
      </div>
    </div>
  );
}
