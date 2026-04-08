"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, Mail, User, Loader2, RefreshCw,
  MapPin, Clock, Megaphone, Save, MessageSquare,
} from "lucide-react";
import { ProfileSection } from "@/components/profile";
import { PROFILE_FIELDS, CATEGORY_META } from "@/lib/profile/field-registry";
import type { FieldCategory } from "@/lib/profile/field-registry";
import type { GHLContact, GHLNote, GHLTask, GHLMessage } from "@/types/ghl";
import { NotesSection, TaskList, ActivityTimeline } from "@/components/leads";
import PipelinesAccordion from "@/components/contact/PipelinesAccordion";

const CATEGORIES: FieldCategory[] = [
  "territory", "franchise_fit", "financial", "trainual",
  "validation", "engagement", "ai_scout", "compliance",
];

export default function LeadProfilePage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.contactId as string;

  const [contact, setContact] = useState<GHLContact | null>(null);
  const [notes, setNotes] = useState<GHLNote[]>([]);
  const [tasks, setTasks] = useState<GHLTask[]>([]);
  const [messages, setMessages] = useState<GHLMessage[]>([]);
  const [profileValues, setProfileValues] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"stages" | "profile" | "notes" | "tasks" | "activity">("stages");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Sprint 4A bugfix: fetch GHL contact + local pipeline-state in parallel.
      // The contactId in the URL may be a local UUID or a GHL ID.
      // The GHL fetch may fail if it's a local UUID — that's OK, we fall back to local data.
      const [contactRes, profileRes, pipelineStateRes] = await Promise.all([
        fetch(`/api/contacts/${contactId}`).catch(() => null),
        fetch(`/api/contacts/${contactId}/profile`).catch(() => null),
        fetch(`/api/contacts/${contactId}/pipeline-state`).catch(() => null),
      ]);

      if (contactRes?.ok) {
        const data = await contactRes.json();
        setContact(data.contact ?? null);
        setNotes(data.notes ?? []);
        setTasks(data.tasks ?? []);
        setMessages(data.messages ?? []);
      }

      // If GHL contact fetch failed but pipeline-state has contact info, use that
      if (!contactRes?.ok && pipelineStateRes?.ok) {
        const psData = await pipelineStateRes.json();
        if (psData.contact) {
          setContact({
            id: psData.contact.ghl_contact_id ?? contactId,
            locationId: "",
            firstName: psData.contact.first_name ?? "",
            lastName: psData.contact.last_name ?? "",
            email: psData.contact.email ?? null,
            phone: psData.contact.phone ?? null,
            tags: [],
            source: psData.contact.opportunity_source ?? null,
            dateAdded: "",
            customFields: [],
            assignedTo: null,
          } as GHLContact);
        }
      }

      if (profileRes?.ok) {
        const data = await profileRes.json();
        setProfileValues(data.raw ?? {});
      }
    } catch {
      // Continue with empty
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  function handleFieldChange(fieldName: string, value: string) {
    setProfileValues((prev) => ({ ...prev, [fieldName]: value }));
    setPendingChanges((prev) => ({ ...prev, [fieldName]: value }));
  }

  async function handleSave() {
    if (Object.keys(pendingChanges).length === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: pendingChanges }),
      });
      if (res.ok) {
        setPendingChanges({});
      }
    } catch {
      // Keep pending changes on failure
    } finally {
      setSaving(false);
    }
  }

  const displayName = contact
    ? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "Unknown"
    : "Loading...";

  const hasPending = Object.keys(pendingChanges).length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-1 py-3 flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="btn-ghost p-1.5"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-headline text-page-title text-text-primary truncate">{displayName}</h1>
          <div className="flex items-center gap-3 mt-0.5">
            {contact?.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-caption text-info hover:underline">
                <Phone size={11} /> {contact.phone}
              </a>
            )}
            {contact?.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-caption text-info hover:underline">
                <Mail size={11} /> {contact.email}
              </a>
            )}
            {contact?.source && (
              <span className="flex items-center gap-1 text-caption text-text-tertiary">
                <Megaphone size={11} /> {contact.source}
              </span>
            )}
            {contact?.dateAdded && (
              <span className="flex items-center gap-1 text-caption text-text-tertiary">
                <Clock size={11} /> Since {new Date(contact.dateAdded).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        {/* Quick Actions */}
        {contact && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-success/10 text-success text-caption font-medium hover:bg-success/20 transition-colors">
                <Phone size={12} /> Call
              </a>
            )}
            {contact.phone && (
              <a href={`sms:${contact.phone}`} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-info/10 text-info text-caption font-medium hover:bg-info/20 transition-colors">
                <MessageSquare size={12} /> Text
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-scout-purple/10 text-scout-purple text-caption font-medium hover:bg-scout-purple/20 transition-colors">
                <Mail size={12} /> Email
              </a>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          {hasPending && (
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="btn-primary text-caption px-3 py-1.5 flex items-center gap-1"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save ({Object.keys(pendingChanges).length})
            </button>
          )}
          <button onClick={() => void fetchAll()} className="btn-ghost p-1.5" disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <a
            href={`/scout?ask=${encodeURIComponent(`Tell me about ${displayName} — what's their current status, recent activity, and what should I do next?`)}`}
            className="btn-ghost text-caption px-3 py-1.5 flex items-center gap-1 text-scout-purple border-scout-purple/30 hover:bg-scout-purple/10"
          >
            <User size={13} /> Ask Scout
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-default px-1 flex-shrink-0">
        {([
          { key: "stages" as const, label: "Stages" },
          { key: "profile" as const, label: "Profile" },
          { key: "notes" as const, label: `Notes (${notes.length})` },
          { key: "tasks" as const, label: `Tasks (${tasks.length})` },
          { key: "activity" as const, label: "Comms" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-body-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-nah-orange text-nah-orange"
                : "border-transparent text-text-tertiary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-text-tertiary" />
          </div>
        ) : activeTab === "stages" ? (
          <div className="p-4">
            <PipelinesAccordion contactId={contactId} />
          </div>
        ) : activeTab === "profile" ? (
          <div className="p-4 space-y-4">
            {/* AI Scout summary card (if available) */}
            {profileValues["Auto Summary"] && (
              <div className="bg-scout-purple/5 border border-scout-purple/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={14} className="text-scout-purple" />
                  <span className="text-caption font-medium text-scout-purple">Scout AI Summary</span>
                </div>
                <p className="text-body-sm text-text-primary">{profileValues["Auto Summary"]}</p>
                {profileValues["Recommended Next Action"] && (
                  <p className="text-body-sm text-nah-orange font-medium mt-2">
                    Next: {profileValues["Recommended Next Action"]}
                  </p>
                )}
              </div>
            )}

            {/* Score bar (if available) */}
            {profileValues["Scout Lead Score"] && (
              <div className="flex items-center gap-4 bg-bg-secondary border border-border-default rounded-lg p-4">
                <div className="text-center">
                  <div className="text-h1 text-nah-orange">{profileValues["Scout Lead Score"]}</div>
                  <div className="text-caption text-text-tertiary">Lead Score</div>
                </div>
                {profileValues["Predicted Close Probability"] && (
                  <div className="text-center">
                    <div className="text-h1 text-success">{profileValues["Predicted Close Probability"]}%</div>
                    <div className="text-caption text-text-tertiary">Close Prob.</div>
                  </div>
                )}
                {profileValues["Lookalike Score"] && (
                  <div className="text-center">
                    <div className="text-h1 text-info">{profileValues["Lookalike Score"]}</div>
                    <div className="text-caption text-text-tertiary">Lookalike</div>
                  </div>
                )}
                {profileValues["Engagement Velocity"] && (
                  <div className="text-center">
                    <div className={`text-h3 ${
                      profileValues["Engagement Velocity"] === "Accelerating" ? "text-success" :
                      profileValues["Engagement Velocity"] === "Stalled" ? "text-danger" : "text-text-primary"
                    }`}>{profileValues["Engagement Velocity"]}</div>
                    <div className="text-caption text-text-tertiary">Velocity</div>
                  </div>
                )}
                {profileValues["Sentiment Trend"] && (
                  <div className="text-center">
                    <div className={`text-h3 ${
                      profileValues["Sentiment Trend"]?.includes("Positive") ? "text-success" :
                      profileValues["Sentiment Trend"] === "Negative" ? "text-danger" : "text-text-primary"
                    }`}>{profileValues["Sentiment Trend"]}</div>
                    <div className="text-caption text-text-tertiary">Sentiment</div>
                  </div>
                )}
              </div>
            )}

            {/* Category sections */}
            {CATEGORIES.map((cat) => {
              const fields = PROFILE_FIELDS.filter((f) => f.category === cat);
              return (
                <ProfileSection
                  key={cat}
                  category={cat}
                  fields={fields}
                  values={profileValues}
                  onFieldChange={handleFieldChange}
                  saving={saving}
                />
              );
            })}
          </div>
        ) : activeTab === "notes" ? (
          <div className="p-4">
            <NotesSection contactId={contactId} notes={notes} onNoteAdded={fetchAll} />
          </div>
        ) : activeTab === "tasks" ? (
          <div className="p-4">
            <TaskList contactId={contactId} tasks={tasks} onTaskUpdated={fetchAll} />
          </div>
        ) : activeTab === "activity" ? (
          <div className="p-4">
            <ActivityTimeline messages={messages} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
