"use client";

/**
 * RelatedPeopleCard — shows related people (spouse, attorney, etc.) for a contact.
 * Reusable across Overview and Messages tabs.
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

const ROLES = ["spouse", "family", "attorney", "accountant", "financial_advisor", "business_partner", "other"];
const ROLE_LABELS: Record<string, string> = {
  spouse: "Spouse", family: "Family", attorney: "Attorney",
  accountant: "Accountant", financial_advisor: "Financial Advisor",
  business_partner: "Business Partner", other: "Other",
};

interface RelatedPeopleCardProps {
  contactId: string;
}

export default function RelatedPeopleCard({ contactId }: RelatedPeopleCardProps) {
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

  useEffect(() => { void fetchPeople(); }, [fetchPeople]);

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

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Users size={14} className="text-text-tertiary" />
          <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider">CONTACTS ({people.length})</h3>
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

      {/* People list */}
      {people.length === 0 && !showForm && (
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
