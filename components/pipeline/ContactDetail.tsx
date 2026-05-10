"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { X, Phone as PhoneIcon, Mail, Clock, Megaphone, Loader2, ExternalLink, User } from "lucide-react";
import type { GHLOpportunity, GHLContact, GHLNote, GHLTask, GHLMessage } from "@/types/ghl";
import { NotesSection, TaskList, ActivityTimeline, ScoutActionHistory, StageHistory } from "@/components/leads";
import IntelligenceTab from "@/components/intelligence/IntelligenceTab";
import CallLogForm from "@/components/intelligence/CallLogForm";

interface ContactDetailProps {
  opportunity: GHLOpportunity;
  stageName: string;
  onClose: () => void;
  onMoveClick: (opportunity: GHLOpportunity) => void;
}

/** Extract specific source from tags, fall back to broad source field */
function getSpecificSource(contact: GHLContact): string {
  const tagMap: Record<string, string> = {
    "google-ads": "Google Ads",
    facebook: "Facebook",
    linkedin: "LinkedIn",
    youtube: "YouTube",
    fbr: "FBR",
    "website-form": "Website Form",
    "franchise-show": "Franchise Show",
    "referral-corey": "Referral (Corey)",
  };
  for (const tag of contact.tags) {
    if (tagMap[tag]) return tagMap[tag];
  }
  // Fall back to broad categories
  if (contact.tags.includes("referral")) return "Referral";
  if (contact.tags.includes("organic")) return "Organic";
  if (contact.tags.includes("paid-ad")) return "Paid Ad";
  return contact.source ?? "Unknown";
}

function daysInStage(updatedAt: string): number {
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
}

function daysInPipeline(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

/** Categorize tags for display */
function categorizeTags(tags: string[]): { source: string[]; status: string[]; other: string[] } {
  const sourceTags = new Set([
    "google-ads",
    "facebook",
    "linkedin",
    "youtube",
    "fbr",
    "referral",
    "referral-corey",
    "website-form",
    "franchise-show",
    "organic",
    "paid-ad",
    "unknown-source",
  ]);
  const statusTags = new Set([
    "closed-won",
    "closed-lost",
    "nurture",
    "ct-import",
    "has-notes",
    "no-sms",
    "do-not-contact",
    "needs-name-update",
  ]);
  const source: string[] = [];
  const status: string[] = [];
  const other: string[] = [];
  for (const tag of tags) {
    if (sourceTags.has(tag)) source.push(tag);
    else if (statusTags.has(tag)) status.push(tag);
    else other.push(tag);
  }
  return { source, status, other };
}

export default function ContactDetail({ opportunity, stageName, onClose, onMoveClick }: ContactDetailProps) {
  const [contact, setContact] = useState<GHLContact | null>(null);
  const [notes, setNotes] = useState<GHLNote[]>([]);
  const [tasks, setTasks] = useState<GHLTask[]>([]);
  const [messages, setMessages] = useState<GHLMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"notes" | "tasks" | "activity" | "scout" | "history" | "intel">("notes");
  const [showCallLog, setShowCallLog] = useState(false);
  const [callType, setCallType] = useState<"intro" | "matt" | "sam" | "mark">("intro");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/contacts/${opportunity.contactId}`);
      if (res.ok) {
        const data = await res.json();
        setContact(data.contact ?? null);
        setNotes(data.notes ?? []);
        setTasks(data.tasks ?? []);
        setMessages(data.messages ?? []);
      }
    } catch {
      // Continue with empty data
    } finally {
      setLoading(false);
    }
  }, [opportunity.contactId]);

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

  const tagGroups = contact ? categorizeTags(contact.tags) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-bg-primary border-l border-border-default flex flex-col h-full">
        {/* Header — sticky top */}
        <div className="bg-bg-primary border-b border-border-default px-5 py-4 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-h1 text-text-primary">{opportunity.name}</h2>
              <div className="flex items-center gap-2 mt-1 text-body-sm text-text-secondary">
                <span>{stageName}</span>
                <span className="text-text-tertiary">·</span>
                <span className="text-text-tertiary">{daysInStage(opportunity.updatedAt)}d in stage</span>
                <span className="text-text-tertiary">·</span>
                <span className="text-text-tertiary">{daysInPipeline(opportunity.createdAt)}d total</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href={`/contacts/${opportunity.contactId}`}
                className="p-1 text-text-tertiary hover:text-nah-orange transition-colors"
                title="Open full profile"
              >
                <ExternalLink size={16} />
              </Link>
              <button onClick={onClose} className="p-1 text-text-tertiary hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
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
                  <a
                    href={`tel:${contact.phone}`}
                    className="flex items-center gap-1.5 text-body-sm text-info hover:underline"
                  >
                    <PhoneIcon size={13} /> {contact.phone}
                  </a>
                )}
                {contact?.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-1.5 text-body-sm text-info hover:underline"
                  >
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
              <section className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onMoveClick(opportunity)}
                  className="flex items-center gap-2 px-3 py-2.5 bg-bg-secondary border border-border-default rounded-lg hover:border-nah-orange hover:bg-nah-orange/5 transition-colors text-body-sm text-text-primary"
                >
                  <ExternalLink size={14} className="text-nah-orange" /> Move Stage
                </button>
                {contact?.phone && (
                  <a
                    href={`tel:${contact.phone}`}
                    className="flex items-center gap-2 px-3 py-2.5 bg-bg-secondary border border-border-default rounded-lg hover:border-success hover:bg-success/5 transition-colors text-body-sm text-text-primary"
                  >
                    <PhoneIcon size={14} className="text-success" /> Call
                  </a>
                )}
                {contact?.phone && (
                  <a
                    href={`sms:${contact.phone}`}
                    className="flex items-center gap-2 px-3 py-2.5 bg-bg-secondary border border-border-default rounded-lg hover:border-info hover:bg-info/5 transition-colors text-body-sm text-text-primary"
                  >
                    <PhoneIcon size={14} className="text-info" /> Text
                  </a>
                )}
                {contact?.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-2 px-3 py-2.5 bg-bg-secondary border border-border-default rounded-lg hover:border-scout-purple hover:bg-scout-purple/5 transition-colors text-body-sm text-text-primary"
                  >
                    <Mail size={14} className="text-scout-purple" /> Email
                  </a>
                )}
              </section>

              {/* Tags */}
              {tagGroups &&
                (tagGroups.source.length > 0 || tagGroups.status.length > 0 || tagGroups.other.length > 0) && (
                  <section className="flex flex-wrap gap-1.5">
                    {tagGroups.source.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-full bg-scout-purple/15 text-scout-purple text-caption"
                      >
                        {t}
                      </span>
                    ))}
                    {tagGroups.status.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-full bg-warning/15 text-warning text-caption">
                        {t}
                      </span>
                    ))}
                    {tagGroups.other.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-full bg-bg-tertiary text-text-secondary text-caption"
                      >
                        {t}
                      </span>
                    ))}
                  </section>
                )}

              {/* Tabs */}
              <div className="flex border-b border-border-default overflow-x-auto">
                {[
                  { key: "notes" as const, label: `Notes (${notes.length})` },
                  { key: "tasks" as const, label: `Tasks (${tasks.length})` },
                  { key: "activity" as const, label: "Comms" },
                  { key: "scout" as const, label: "Scout" },
                  { key: "history" as const, label: "Stages" },
                  { key: "intel" as const, label: "Intel" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-2 text-body-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.key
                        ? "border-nah-orange text-nah-orange"
                        : "border-transparent text-text-tertiary hover:text-text-primary"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {activeTab === "notes" && (
                <NotesSection
                  contactId={opportunity.contactId}
                  contactName={opportunity.name ?? ""}
                  notes={notes}
                  onNoteAdded={fetchData}
                />
              )}
              {activeTab === "tasks" && (
                <TaskList contactId={opportunity.contactId} tasks={tasks} onTaskUpdated={fetchData} />
              )}
              {activeTab === "activity" && <ActivityTimeline messages={messages} />}
              {activeTab === "scout" && <ScoutActionHistory contactId={opportunity.contactId} />}
              {activeTab === "history" && <StageHistory contactId={opportunity.contactId} />}
              {activeTab === "intel" && !showCallLog && (
                <IntelligenceTab contactId={opportunity.contactId} onLogCall={() => setShowCallLog(true)} />
              )}
              {activeTab === "intel" && showCallLog && (
                <div className="p-4">
                  <div className="flex gap-2 mb-3">
                    {(["intro", "matt", "sam", "mark"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setCallType(t)}
                        className={`px-3 py-1.5 rounded-md text-body-sm capitalize ${
                          callType === t ? "bg-nah-blue text-white" : "text-text-secondary hover:bg-bg-hover"
                        }`}
                      >
                        {t === "intro"
                          ? "Chad (Intro)"
                          : t === "matt"
                            ? "Matt (Discovery)"
                            : t === "sam"
                              ? "Sam (Validation)"
                              : "Mark (Lending)"}
                      </button>
                    ))}
                  </div>
                  <CallLogForm
                    callType={callType}
                    contactId={opportunity.contactId}
                    contactName={opportunity.name ?? ""}
                    onSave={() => {
                      setShowCallLog(false);
                      void fetchData();
                    }}
                    onCancel={() => setShowCallLog(false)}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ask Scout — always visible at bottom */}
        <div className="bg-bg-primary border-t border-border-default px-5 py-3 flex-shrink-0">
          <Link
            href={`/scout?ask=${encodeURIComponent(`Tell me about ${opportunity.name} — what's their current status, recent activity, and what should I do next?`)}`}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-scout-purple/10 border border-scout-purple/30 rounded-lg hover:bg-scout-purple/20 transition-colors text-body-sm text-scout-purple font-medium"
          >
            <User size={16} />
            Ask Scout about {opportunity.name.split(" ")[0]}
          </Link>
        </div>
      </div>
    </div>
  );
}
