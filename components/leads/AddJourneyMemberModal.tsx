"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * AddJourneyMemberModal — surfaced from the Profile tab header on a
 * journey page. Lets the rep find an existing contact (by name/email)
 * and attach them to the journey with a role, or jump into the
 * AddProspectModal if the person isn't in the contacts table yet.
 *
 * On save: POST /api/journeys/[journeyId]/members. Idempotent against
 * re-adds so a duplicate click resolves to the existing membership
 * instead of erroring.
 */

import { useEffect, useRef, useState } from "react";
import { X, Search, Loader2, UserPlus } from "lucide-react";
import AddContactModal from "@/components/contact/AddContactModal";
import { useScrollLock } from "@/lib/hooks/useScrollLock";

interface ContactOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string;
  email: string | null;
  phone: string | null;
}

interface Props {
  open: boolean;
  journeyId: string;
  existingMemberIds: string[];
  /** When set, the "co_primary" option displays as "Additional Prospect" or
   *  "Additional Franchisee" so reps see the label that matches the
   *  journey's current stage instead of the internal term. */
  coreRoleLabel?: string;
  onClose: () => void;
  onAdded: () => void;
}

function buildRoleOptions(coreRoleLabel?: string): { value: string; label: string }[] {
  const coOwnerLabel = coreRoleLabel ? `Additional ${coreRoleLabel}` : "Co-owner";
  return [
    { value: "co_primary", label: coOwnerLabel },
    { value: "spouse", label: "Spouse" },
    { value: "family", label: "Family" },
    { value: "business_partner", label: "Business partner" },
    { value: "attorney", label: "Attorney" },
    { value: "accountant", label: "Accountant" },
    { value: "financial_advisor", label: "Financial advisor" },
    { value: "other", label: "Other" },
  ];
}

export default function AddJourneyMemberModal({
  open,
  journeyId,
  existingMemberIds,
  coreRoleLabel,
  onClose,
  onAdded,
}: Props) {
  useScrollLock(open);
  const ROLE_OPTIONS = buildRoleOptions(coreRoleLabel);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactOption[]>([]);
  const [selected, setSelected] = useState<ContactOption | null>(null);
  const [role, setRole] = useState<string>("co_primary");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddProspect, setShowAddProspect] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelected(null);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || query.length < 2) {
      setResults([]);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/contacts/search?q=${encodeURIComponent(query)}&limit=8`);
        if (!res.ok) return;
        const data = await res.json();
        const raw = (data.results ?? data.contacts ?? []) as ContactOption[];
        // Filter out contacts already on this journey so the user can't
        // try to add a duplicate; backend is idempotent anyway but the
        // list shouldn't tempt the click.
        setResults(raw.filter((c) => !existingMemberIds.includes(c.id)));
      } catch {
        /* keep previous */
      }
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, open, existingMemberIds]);

  async function submit() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/journeys/${journeyId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: selected.id, role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to add");
        setSaving(false);
        return;
      }
      setSaving(false);
      onAdded();
      onClose();
    } catch {
      setError("Network error");
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
        <div
          className="bg-surface-solid border border-border-default rounded-lg p-5 w-[460px] shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-h3 text-text-primary">Add contact to journey</h3>
            <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
              <X size={16} />
            </button>
          </div>

          {!selected ? (
            <>
              <div className="relative mb-2">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search contacts by name or email…"
                  autoFocus
                  className="w-full bg-bg-tertiary border border-border-default rounded-md pl-7 pr-2 py-1.5 text-body-sm text-text-primary placeholder:text-text-tertiary"
                />
              </div>

              {query.length >= 2 && (
                <div className="max-h-64 overflow-y-auto border border-border-default rounded-md divide-y divide-border-default">
                  {results.length === 0 ? (
                    <div className="px-3 py-2 text-caption text-text-tertiary">No matches.</div>
                  ) : (
                    results.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelected(c)}
                        className="w-full text-left px-3 py-1.5 text-caption hover:bg-bg-tertiary"
                      >
                        <div className="text-text-primary font-medium">{c.name}</div>
                        {(c.email || c.phone) && (
                          <div className="text-text-tertiary truncate">
                            {c.email ?? ""}
                            {c.email && c.phone ? " · " : ""}
                            {c.phone ?? ""}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}

              <button
                onClick={() => setShowAddProspect(true)}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-border-default text-caption text-nah-blue hover:bg-bg-tertiary"
              >
                <UserPlus size={13} /> Add a new contact instead
              </button>
            </>
          ) : (
            <>
              <div className="px-3 py-2 rounded-md bg-bg-tertiary mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-body-sm font-medium text-text-primary">{selected.name}</div>
                    {(selected.email || selected.phone) && (
                      <div className="text-caption text-text-tertiary truncate">
                        {selected.email ?? ""}
                        {selected.email && selected.phone ? " · " : ""}
                        {selected.phone ?? ""}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setSelected(null)} className="text-caption text-nah-blue hover:underline">
                    Change
                  </button>
                </div>
              </div>

              <label className="block text-caption text-text-tertiary mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border-default bg-bg-tertiary text-body-sm mb-3"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>

              {error && <div className="text-caption text-danger mb-2">{error}</div>}

              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="btn-ghost px-3 py-1.5 text-caption">
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={saving}
                  className="btn-primary px-3 py-1.5 text-caption disabled:opacity-50"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : "Add to journey"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <AddContactModal
        open={showAddProspect}
        journeyId={journeyId}
        coreRoleLabel={coreRoleLabel}
        onClose={() => setShowAddProspect(false)}
        onCreated={() => {
          // AddContactModal already links the new contact to the journey
          // with the selected role. Just notify the parent and close.
          setShowAddProspect(false);
          onAdded();
          onClose();
        }}
      />
    </>
  );
}
