"use client";

/**
 * RelatedPeopleCard — shows everyone attached to this journey.
 *
 * Two modes:
 *  • Journey-aware (preferred): when `journeyMembers` is passed in, render
 *    that list directly — one row per journey_contacts member, role label
 *    derived from the member's role. The parent owns the Add flow (it has
 *    the journey id and opens AddJourneyMemberModal).
 *  • Legacy fallback: when no journey context is provided (slim /contacts
 *    page), fetch contact_related_people from the old endpoint. Gradually
 *    retired as /contacts-level pages migrate.
 */

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Users, Loader2 } from "lucide-react";
import { capitalizeName, formatPhone } from "@/lib/format/contact";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";

interface RelatedPerson {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  relationship_notes: string | null;
  is_primary_decision_maker: boolean;
}

export interface JourneyMemberLite {
  contact_id: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
  phone?: string | null;
  is_primary?: boolean;
}

const ROLES = ["spouse", "family", "attorney", "accountant", "financial_advisor", "business_partner", "other"];
const ROLE_LABELS: Record<string, string> = {
  primary: "Primary",
  co_primary: "Co-primary",
  spouse: "Spouse", family: "Family", attorney: "Attorney",
  accountant: "Accountant", financial_advisor: "Financial Advisor",
  business_partner: "Business Partner", other: "Other",
};

interface MainContact {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

interface RelatedPeopleCardProps {
  contactId: string;
  mainContact?: MainContact | null;
  /** When provided, the card renders from journey_contacts instead of
   *  contact_related_people. The journey context also gates the Add flow
   *  onto the parent via onAddRequested. */
  journeyMembers?: JourneyMemberLite[];
  /** Label to use for primary + co_primary members instead of the default
   *  "Primary" / "Co-primary" text. Typically "Prospect" or "Franchisee"
   *  derived from the journey's current pipeline stage. */
  coreRoleLabel?: string;
  onAddRequested?: () => void;
}

export default function RelatedPeopleCard({ contactId, mainContact, journeyMembers, coreRoleLabel, onAddRequested }: RelatedPeopleCardProps) {
  const { toast } = useToast();
  const [people, setPeople] = useState<RelatedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({ first_name: "", last_name: "", email: "", phone: "", role: "spouse", relationship_notes: "", is_primary_decision_maker: false });

  const fetchPeople = useCallback(async () => {
    try {
      const res = await fetch(`/api/contacts/${contactId}/related-people`);
      if (res.ok) {
        const data = await res.json();
        setPeople(data.people ?? []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [contactId]);

  // Journey mode = the parent passed journey_contacts. No network call
  // needed; loading state resolves immediately.
  const journeyMode = Array.isArray(journeyMembers);
  useEffect(() => {
    if (journeyMode) { setLoading(false); return; }
    void fetchPeople();
  }, [journeyMode, fetchPeople]);

  async function handleAdd() {
    if (!formData.first_name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/related-people`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast("Contact added");
        setShowForm(false);
        setFormData({ first_name: "", last_name: "", email: "", phone: "", role: "spouse", relationship_notes: "", is_primary_decision_maker: false });
        await fetchPeople();
      }
    } catch { /* silent */ }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/contacts/${contactId}/related-people/${id}`, { method: "DELETE" });
    if (res.ok) { toast("Contact removed"); setDeleteId(null); await fetchPeople(); }
  }

  if (loading) return <div className="flex items-center justify-center py-4"><Loader2 size={16} className="animate-spin text-text-tertiary" /></div>;

  // In journey mode render every journey_contacts member directly. The
  // header count reflects the real membership list; the Add button bubbles
  // up to the parent (which already owns AddJourneyMemberModal).
  if (journeyMode) {
    const list = journeyMembers ?? [];
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Users size={14} className="text-text-tertiary" />
            <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider">CONTACTS ({list.length})</h3>
          </div>
          {onAddRequested && (
            <button onClick={onAddRequested} className="text-caption text-nah-blue hover:underline flex items-center gap-0.5">
              <Plus size={11} /> Add
            </button>
          )}
        </div>
        {list.length === 0 && (
          <p className="text-caption text-text-tertiary py-2">No contacts on this journey.</p>
        )}
        <div className="space-y-1.5">
          {list.map((m) => {
            const name = capitalizeName(`${m.first_name ?? ""} ${m.last_name ?? ""}`.trim()) || "Unknown";
            const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
            // Core roles (primary + co_primary) share one label derived from
            // the journey's current stage — "Prospect" / "Franchisee". Other
            // roles (spouse, attorney, etc.) display their specific role. No
            // visual hierarchy between primary and co_primary; they read as
            // co-equal deal members.
            const isCore = m.role === "primary" || m.role === "co_primary";
            const roleLabel = isCore
              ? (coreRoleLabel ?? (ROLE_LABELS[m.role] ?? m.role))
              : (ROLE_LABELS[m.role] ?? m.role.replace(/_/g, " "));
            // Core members (prospects + franchisees) get a link to their
            // person page — same pattern as territory ownership → territory
            // page. Side members (spouse/attorney/etc.) don't have a rich
            // person page, so their name stays plain text.
            const nameNode = isCore ? (
              <a
                href={`/contacts/${m.contact_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-caption font-medium text-nah-blue hover:underline truncate"
              >
                {name}
              </a>
            ) : (
              <span className="text-caption font-medium text-text-primary truncate">{name}</span>
            );

            return (
              <div key={m.contact_id} className="flex items-center gap-2.5 py-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${isCore ? "bg-nah-orange/15 text-nah-orange" : "bg-nah-blue/10 text-nah-blue"}`}>{initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {nameNode}
                    <span className={`text-[9px] px-1 py-0.5 rounded ${isCore ? "bg-nah-orange/10 text-nah-orange" : "bg-text-tertiary/10 text-text-tertiary"}`}>{roleLabel}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
                    {m.email && <span className="truncate">{m.email}</span>}
                    {m.phone && <span>{formatPhone(m.phone)}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Users size={14} className="text-text-tertiary" />
          <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider">CONTACTS ({people.length + (mainContact ? 1 : 0)})</h3>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="text-caption text-nah-blue hover:underline flex items-center gap-0.5">
          <Plus size={11} /> Add
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-3 p-3 bg-bg-secondary border border-border-default rounded-lg space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="First name" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              className="bg-bg-tertiary border border-border-default rounded px-2 py-1.5 text-caption text-text-primary" />
            <input placeholder="Last name" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              className="bg-bg-tertiary border border-border-default rounded px-2 py-1.5 text-caption text-text-primary" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-bg-tertiary border border-border-default rounded px-2 py-1.5 text-caption text-text-primary" />
            <input placeholder="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="bg-bg-tertiary border border-border-default rounded px-2 py-1.5 text-caption text-text-primary" />
          </div>
          <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            className="w-full bg-bg-tertiary border border-border-default rounded px-2 py-1.5 text-caption text-text-primary">
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="btn-ghost px-3 py-1 text-caption">Cancel</button>
            <button onClick={() => void handleAdd()} disabled={saving || !formData.first_name.trim()}
              className="btn-primary px-3 py-1 text-caption flex items-center gap-1">
              {saving && <Loader2 size={11} className="animate-spin" />} Add
            </button>
          </div>
        </div>
      )}

      {/* Main contact — always first, pinned as primary */}
      {mainContact && (() => {
        const mcName = capitalizeName(`${mainContact.first_name ?? ""} ${mainContact.last_name ?? ""}`.trim()) || "Unknown";
        const mcInitials = mcName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
        return (
          <div className="flex items-center gap-2.5 py-1.5 mb-1 border-b border-border-default/50 pb-2">
            <div className="w-7 h-7 rounded-full bg-nah-orange/15 text-nah-orange flex items-center justify-center text-[10px] font-semibold flex-shrink-0">{mcInitials}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-caption font-medium text-text-primary truncate">{mcName}</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-nah-orange/10 text-nah-orange">Primary</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
                {mainContact.email && <span className="truncate">{mainContact.email}</span>}
                {mainContact.phone && <span>{formatPhone(mainContact.phone)}</span>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Related people list */}
      {people.length === 0 && !mainContact && !showForm && (
        <p className="text-caption text-text-tertiary py-2">No related contacts</p>
      )}
      <div className="space-y-1.5">
        {people.map((p) => {
          const name = capitalizeName(`${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()) || "Unknown";
          const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

          return (
            <div key={p.id} className="flex items-center gap-2.5 py-1.5 group">
              <div className="w-7 h-7 rounded-full bg-nah-blue/10 text-nah-blue flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-caption font-medium text-text-primary truncate">{name}</span>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-text-tertiary/10 text-text-tertiary">{ROLE_LABELS[p.role] ?? p.role}</span>
                  {p.is_primary_decision_maker && <span className="text-[9px] px-1 py-0.5 rounded bg-nah-orange/10 text-nah-orange">Primary</span>}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
                  {p.email && <span className="truncate">{p.email}</span>}
                  {p.phone && <span>{formatPhone(p.phone)}</span>}
                </div>
              </div>
              <button onClick={() => setDeleteId(p.id)}
                className="p-0.5 rounded hover:bg-danger/10 text-text-tertiary hover:text-danger opacity-0 group-hover:opacity-100">
                <Trash2 size={11} />
              </button>
            </div>
          );
        })}
      </div>

      {deleteId && (
        <ConfirmModal title="Remove contact" body="Remove this related contact?" destructive confirmLabel="Remove"
          onConfirm={() => void handleDelete(deleteId)} onCancel={() => setDeleteId(null)} />
      )}
    </div>
  );
}
