"use client";

/**
 * Compact modal — create a new contact that's linked to the call's primary
 * contact as a related person (spouse, accountant, advisor, etc).
 *
 * Fires two writes on submit:
 *   1. POST /api/contacts/create — new contacts row (no pipeline).
 *   2. POST /api/contacts/[primaryId]/related-people — link with role.
 *
 * Returns the new contact id so the caller can map the call participant to it.
 */

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

const ROLES: Array<{ value: string; label: string }> = [
  { value: "spouse", label: "Spouse" },
  { value: "family", label: "Family" },
  { value: "attorney", label: "Attorney" },
  { value: "accountant", label: "Accountant" },
  { value: "financial_advisor", label: "Financial advisor" },
  { value: "business_partner", label: "Business partner" },
  { value: "other", label: "Other" },
];

interface Prefill {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

interface Props {
  open: boolean;
  primaryContactId: string | null;
  prefill?: Prefill;
  onClose: () => void;
  onCreated: (newContactId: string) => void;
}

export default function AddRelatedContactModal({ open, primaryContactId, prefill, onClose, onCreated }: Props) {
  const [firstName, setFirstName] = useState(prefill?.firstName ?? "");
  const [lastName, setLastName] = useState(prefill?.lastName ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [phone, setPhone] = useState(prefill?.phone ?? "");
  const [role, setRole] = useState("spouse");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFirstName(prefill?.firstName ?? "");
    setLastName(prefill?.lastName ?? "");
    setEmail(prefill?.email ?? "");
    setPhone(prefill?.phone ?? "");
    setRole("spouse");
    setNotes("");
    setError(null);
  }, [open, prefill]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!primaryContactId) {
      setError("Set a primary contact on the call first.");
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name required.");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError("Email or phone required.");
      return;
    }

    setSaving(true);
    try {
      const createRes = await fetch("/api/contacts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok || !created.contactId) {
        setError(created.error ?? "Failed to create contact.");
        setSaving(false);
        return;
      }

      const linkRes = await fetch(`/api/contacts/${primaryContactId}/related-people`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          role,
          relationship_notes: notes.trim() || null,
          linked_contact_id: created.contactId,
        }),
      });
      if (!linkRes.ok) {
        const data = await linkRes.json().catch(() => ({}));
        // Non-fatal — the contact was created; link failure can be retried from the contact page.
        console.warn("[AddRelatedContactModal] link failed:", data.error);
      }

      setSaving(false);
      onCreated(created.contactId as string);
      onClose();
    } catch {
      setError("Network error.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-bg-secondary border border-border-default rounded-lg shadow-xl w-full max-w-md mx-4 p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-body-sm font-medium text-text-primary">Add related contact</h3>
          <button type="button" onClick={onClose} className="btn-ghost p-1"><X size={14} /></button>
        </div>

        {!primaryContactId && (
          <div className="text-caption text-danger">
            Set a primary contact on the call first — use the star next to any mapped participant.
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-caption text-text-tertiary">First name *</span>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full bg-bg-primary border border-border-default rounded-md px-2.5 py-1.5 text-body-sm text-text-primary"
            />
          </label>
          <label className="space-y-1">
            <span className="text-caption text-text-tertiary">Last name *</span>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full bg-bg-primary border border-border-default rounded-md px-2.5 py-1.5 text-body-sm text-text-primary"
            />
          </label>
        </div>

        <label className="space-y-1 block">
          <span className="text-caption text-text-tertiary">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-bg-primary border border-border-default rounded-md px-2.5 py-1.5 text-body-sm text-text-primary"
          />
        </label>

        <label className="space-y-1 block">
          <span className="text-caption text-text-tertiary">Phone</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-bg-primary border border-border-default rounded-md px-2.5 py-1.5 text-body-sm text-text-primary"
          />
        </label>

        <label className="space-y-1 block">
          <span className="text-caption text-text-tertiary">Relationship to primary contact *</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full bg-bg-primary border border-border-default rounded-md px-2.5 py-1.5 text-body-sm text-text-primary"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1 block">
          <span className="text-caption text-text-tertiary">Notes</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional context"
            className="w-full bg-bg-primary border border-border-default rounded-md px-2.5 py-1.5 text-body-sm text-text-primary placeholder:text-text-tertiary"
          />
        </label>

        {error && <div className="text-caption text-danger">{error}</div>}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-default -mx-4 px-4">
          <button type="button" onClick={onClose} disabled={saving} className="btn-ghost px-3 py-1.5 text-caption">Cancel</button>
          <button
            type="submit"
            disabled={saving || !primaryContactId}
            className="btn-primary px-3 py-1.5 text-caption disabled:opacity-50 flex items-center gap-1"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : null}
            Create & link
          </button>
        </div>
      </form>
    </div>
  );
}
