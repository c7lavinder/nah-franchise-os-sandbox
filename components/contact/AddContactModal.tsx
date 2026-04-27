"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * AddContactModal — create a new contact and (optionally) add them to a
 * journey as a member in one step.
 *
 * Scope difference from AddProspectModal:
 *   - Label is "Add contact" (contact-type agnostic).
 *   - Contact type is the journey role (Franchisee/Prospect for core,
 *     spouse/family/attorney/etc. for side roles). No lead-source or
 *     sub-source fields — those belong on the journey, not the contact.
 *   - When journeyId is set, the modal also links the new contact to
 *     the journey in a single flow.
 */

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  journeyId?: string | null;
  /** Label shown on the "core" role option ("Franchisee" when the journey
   *  has a franchisee-stage pipeline, "Prospect" otherwise). */
  coreRoleLabel?: string;
  /** Default role to preselect (otherwise co_primary). */
  defaultRole?: string;
  onClose: () => void;
  onCreated: (contactId: string, displayName: string) => void;
}

function buildRoleOptions(coreLabel?: string): { value: string; label: string }[] {
  const core = coreLabel ?? "Co-owner";
  return [
    { value: "co_primary", label: core },
    { value: "spouse", label: "Spouse" },
    { value: "family", label: "Family" },
    { value: "business_partner", label: "Business partner" },
    { value: "attorney", label: "Attorney" },
    { value: "accountant", label: "Accountant" },
    { value: "financial_advisor", label: "Financial advisor" },
    { value: "realtor", label: "Realtor" },
    { value: "other", label: "Other" },
  ];
}

export default function AddContactModal({ open, journeyId, coreRoleLabel, defaultRole, onClose, onCreated }: Props) {
  const ROLE_OPTIONS = buildRoleOptions(coreRoleLabel);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [role, setRole] = useState<string>(defaultRole ?? "co_primary");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFirstName(""); setLastName(""); setEmail(""); setPhone("");
      setCity(""); setState(""); setRole(defaultRole ?? "co_primary");
      setError(null);
    }
  }, [open, defaultRole]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError("Email or phone is required.");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Create the contact.
      const res = await apiFetch("/api/contacts/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(), lastName: lastName.trim(),
          email: email.trim() || undefined, phone: phone.trim() || undefined,
          city: city.trim() || undefined, state: state.trim() || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? "Failed to create contact.");
        setSubmitting(false);
        return;
      }
      const contactId = result.contactId as string;
      const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();

      // 2. If a journey was provided, link the contact as a member with the
      //    selected role. Journey-member endpoint is idempotent.
      if (journeyId) {
        // Map "realtor" to "other" since the journey_contacts role enum
        // doesn't include realtor yet — the label is still correct to display.
        const apiRole = role === "realtor" ? "other" : role;
        const linkRes = await apiFetch(`/api/journeys/${journeyId}/members`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contact_id: contactId, role: apiRole }),
        });
        if (!linkRes.ok) {
          const d = await linkRes.json().catch(() => ({}));
          setError(d.error ?? "Contact created, but linking to journey failed.");
          setSubmitting(false);
          return;
        }
      }
      setSubmitting(false);
      onCreated(contactId, displayName);
      onClose();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form onSubmit={submit} className="relative bg-surface-solid rounded-lg border border-border-default shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-body-lg font-semibold text-text-primary">Add contact</h2>
          <button type="button" onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>

        {error && <div className="text-body-sm text-danger bg-danger/10 rounded-md px-3 py-2">{error}</div>}

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-caption text-text-secondary">First name *</span>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required
              className="w-full bg-bg-tertiary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary focus:border-nah-orange focus:outline-none" />
          </label>
          <label className="space-y-1">
            <span className="text-caption text-text-secondary">Last name *</span>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required
              className="w-full bg-bg-tertiary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary focus:border-nah-orange focus:outline-none" />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-caption text-text-secondary">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-bg-tertiary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-nah-orange focus:outline-none" />
        </label>
        <label className="block space-y-1">
          <span className="text-caption text-text-secondary">Phone</span>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567"
            className="w-full bg-bg-tertiary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-nah-orange focus:outline-none" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-caption text-text-secondary">City</span>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
              className="w-full bg-bg-tertiary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary focus:border-nah-orange focus:outline-none" />
          </label>
          <label className="space-y-1">
            <span className="text-caption text-text-secondary">State</span>
            <input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="TX" maxLength={2}
              className="w-full bg-bg-tertiary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-nah-orange focus:outline-none" />
          </label>
        </div>

        {journeyId && (
          <label className="block space-y-1">
            <span className="text-caption text-text-secondary">Contact type</span>
            <select value={role} onChange={(e) => setRole(e.target.value)}
              className="w-full bg-bg-tertiary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary focus:border-nah-orange focus:outline-none">
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-body-sm text-text-secondary hover:text-text-primary transition-colors">Cancel</button>
          <button type="submit" disabled={submitting}
            className="px-4 py-2 bg-nah-orange text-white text-body-sm font-medium rounded-md hover:bg-nah-orange/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? "Adding…" : "Add contact"}
          </button>
        </div>
      </form>
    </div>
  );
}
