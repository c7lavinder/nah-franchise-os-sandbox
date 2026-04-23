"use client";

/**
 * Add a new contact to the ecosystem.
 *
 * Two flavors based on role:
 *
 *   - Territory role (employee, contractor, agent, lender, partner, lawyer,
 *     other): creates a `contacts` row + `territory_stakeholders` row
 *     (with contact_id FK). Anchors to the territory, not to a person —
 *     survives ownership transfer. Feeds the ecosystem visual and the
 *     call classifier (via the stakeholder → active-journey fallback in
 *     lib/calls/resolve-participants.ts).
 *
 *   - Personal role (spouse, family, attorney, accountant, financial
 *     advisor, business partner): creates a `contacts` row + a
 *     `contact_related_people` row linked to a specific contact. Follows
 *     the primary (Brian's attorney stays with Brian through any sale).
 *
 * Prefill comes from the call participant being mapped. Returns the new
 * contact id so the Reassign caller can map the participant to it.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";

interface Prefill {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

interface TerritoryOption {
  ms_slug: string;
  territory_name: string;
}

interface ContactOption {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

const TERRITORY_ROLES: Array<{ value: string; label: string }> = [
  { value: "employee", label: "Employee" },
  { value: "contractor", label: "Contractor" },
  { value: "agent", label: "Agent" },
  { value: "lender", label: "Lender" },
  { value: "partner", label: "Partner" },
  { value: "lawyer", label: "Lawyer (local/deal)" },
  { value: "other", label: "Other (territory)" },
];

const PERSONAL_ROLES: Array<{ value: string; label: string }> = [
  { value: "spouse", label: "Spouse" },
  { value: "family", label: "Family" },
  { value: "attorney", label: "Personal attorney" },
  { value: "accountant", label: "Accountant" },
  { value: "financial_advisor", label: "Financial advisor" },
  { value: "business_partner", label: "Business partner" },
  { value: "other", label: "Other (personal)" },
];

interface Props {
  open: boolean;
  /** The call's current primary contact — defaulted as the target of a
   *  personal-role relationship, editable inside the modal. */
  primaryContactId: string | null;
  primaryContactName?: string | null;
  /** The call's territories (from call_territories). Used to default the
   *  territory selector when the user picks a territory role. */
  callTerritorySlugs?: string[];
  /** If the participant we're adding is already mapped to a contact, pass
   *  it here — the modal will link that contact to the territory/relationship
   *  instead of creating a duplicate contact record. */
  existingContactId?: string | null;
  prefill?: Prefill;
  onClose: () => void;
  onCreated: (newContactId: string) => void;
}

type Anchor = "territory" | "personal";

export default function AddRelatedContactModal({
  open,
  primaryContactId,
  primaryContactName,
  callTerritorySlugs,
  existingContactId,
  prefill,
  onClose,
  onCreated,
}: Props) {
  const [anchor, setAnchor] = useState<Anchor>("territory");
  const [firstName, setFirstName] = useState(prefill?.firstName ?? "");
  const [lastName, setLastName] = useState(prefill?.lastName ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [phone, setPhone] = useState(prefill?.phone ?? "");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("employee");
  const [notes, setNotes] = useState("");

  // Territory-anchored state
  const [territories, setTerritories] = useState<TerritoryOption[]>([]);
  const [territorySlug, setTerritorySlug] = useState<string>("");

  // Personal-anchored state
  const [targetContactId, setTargetContactId] = useState<string | null>(primaryContactId);
  const [targetContactName, setTargetContactName] = useState<string | null>(primaryContactName ?? null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state every open, apply prefill.
  useEffect(() => {
    if (!open) return;
    setAnchor("territory");
    setFirstName(prefill?.firstName ?? "");
    setLastName(prefill?.lastName ?? "");
    setEmail(prefill?.email ?? "");
    setPhone(prefill?.phone ?? "");
    setCompany("");
    setRole("employee");
    setNotes("");
    setTargetContactId(primaryContactId);
    setTargetContactName(primaryContactName ?? null);
    setError(null);
  }, [open, prefill, primaryContactId, primaryContactName]);

  // Load territories when the modal opens.
  useEffect(() => {
    if (!open) return;
    void (async () => {
      const res = await fetch("/api/territories?status=active");
      if (!res.ok) return;
      const data = await res.json() as { territories?: TerritoryOption[] };
      const list = data.territories ?? [];
      setTerritories(list);
      const fromCall = (callTerritorySlugs ?? []).find((s) => list.some((t) => t.ms_slug === s));
      setTerritorySlug(fromCall ?? list[0]?.ms_slug ?? "");
    })();
  }, [open, callTerritorySlugs]);

  // Lock body scroll while the modal is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Keep the role select in-range when the user flips anchor.
  useEffect(() => {
    if (anchor === "territory" && !TERRITORY_ROLES.some((r) => r.value === role)) {
      setRole("employee");
    }
    if (anchor === "personal" && !PERSONAL_ROLES.some((r) => r.value === role)) {
      setRole("spouse");
    }
  }, [anchor, role]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name required.");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError("Email or phone required.");
      return;
    }
    if (anchor === "territory" && !territorySlug) {
      setError("Pick a territory.");
      return;
    }
    if (anchor === "personal" && !targetContactId) {
      setError("Pick the contact this person is related to.");
      return;
    }

    setSaving(true);
    try {
      // 1. Resolve the contact id — reuse the already-mapped contact when
      //    available (don't create duplicates), otherwise create fresh.
      let newContactId: string;
      if (existingContactId) {
        newContactId = existingContactId;
      } else {
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
        newContactId = created.contactId as string;
      }

      // 2. Write the anchor row.
      if (anchor === "territory") {
        const linkRes = await fetch(
          `/api/territories/${encodeURIComponent(territorySlug)}/stakeholders`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              email: email.trim() || null,
              phone: phone.trim() || null,
              company: company.trim() || null,
              role,
              notes: notes.trim() || null,
              contact_id: newContactId,
            }),
          },
        );
        if (!linkRes.ok) {
          const data = await linkRes.json().catch(() => ({}));
          setError(data.error ?? "Contact created, but ecosystem link failed — retry from the territory page.");
          setSaving(false);
          return;
        }
      } else {
        const linkRes = await fetch(`/api/contacts/${targetContactId}/related-people`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim() || null,
            phone: phone.trim() || null,
            role,
            relationship_notes: notes.trim() || null,
            linked_contact_id: newContactId,
          }),
        });
        if (!linkRes.ok) {
          const data = await linkRes.json().catch(() => ({}));
          setError(data.error ?? "Contact created, but relationship link failed.");
          setSaving(false);
          return;
        }
      }

      setSaving(false);
      onCreated(newContactId);
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
        className="bg-surface-solid border border-border-default rounded-lg shadow-xl w-full max-w-md mx-4 p-4 space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-body-sm font-medium text-text-primary">Add contact to ecosystem</h3>
          <button type="button" onClick={onClose} className="btn-ghost p-1"><X size={14} /></button>
        </div>

        {/* Anchor toggle */}
        <div className="grid grid-cols-2 gap-2 p-0.5 bg-bg-secondary rounded-md">
          <button
            type="button"
            onClick={() => setAnchor("territory")}
            className={`px-2.5 py-1.5 text-caption rounded transition-colors ${
              anchor === "territory" ? "bg-bg-primary text-text-primary shadow-sm" : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            Works at a territory
          </button>
          <button
            type="button"
            onClick={() => setAnchor("personal")}
            className={`px-2.5 py-1.5 text-caption rounded transition-colors ${
              anchor === "personal" ? "bg-bg-primary text-text-primary shadow-sm" : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            Personal to a contact
          </button>
        </div>

        <p className="text-[10px] text-text-tertiary leading-relaxed">
          {anchor === "territory"
            ? "Employees, contractors, agents — anchored to the territory. Stays if ownership changes."
            : "Spouse, family, attorney — anchored to a contact. Follows the contact."}
        </p>

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
          <span className="text-caption text-text-tertiary">Role *</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full bg-bg-primary border border-border-default rounded-md px-2.5 py-1.5 text-body-sm text-text-primary"
          >
            {(anchor === "territory" ? TERRITORY_ROLES : PERSONAL_ROLES).map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </label>

        {anchor === "territory" ? (
          <>
            <label className="space-y-1 block">
              <span className="text-caption text-text-tertiary">Territory *</span>
              <select
                value={territorySlug}
                onChange={(e) => setTerritorySlug(e.target.value)}
                className="w-full bg-bg-primary border border-border-default rounded-md px-2.5 py-1.5 text-body-sm text-text-primary"
              >
                <option value="">— Pick a territory —</option>
                {territories.map((t) => (
                  <option key={t.ms_slug} value={t.ms_slug}>
                    {t.territory_name} ({t.ms_slug})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 block">
              <span className="text-caption text-text-tertiary">Company (optional)</span>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full bg-bg-primary border border-border-default rounded-md px-2.5 py-1.5 text-body-sm text-text-primary"
              />
            </label>
          </>
        ) : (
          <ContactPicker
            label="Related to contact *"
            selectedId={targetContactId}
            selectedName={targetContactName}
            onChange={(id, name) => {
              setTargetContactId(id);
              setTargetContactName(name);
            }}
          />
        )}

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
          <button type="button" onClick={onClose} disabled={saving} className="btn-ghost px-3 py-1.5 text-caption">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
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

function ContactPicker({
  label,
  selectedId,
  selectedName,
  onChange,
}: {
  label: string;
  selectedId: string | null;
  selectedName: string | null;
  onChange: (id: string | null, name: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactOption[]>([]);
  const [editing, setEditing] = useState(!selectedId);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editing) return;
    if (query.length < 2) { setResults([]); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(query)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setResults((data.results ?? data.contacts ?? []) as ContactOption[]);
      }
    }, 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [editing, query]);

  const showResults = useMemo(() => editing && query.length >= 2, [editing, query]);

  return (
    <div className="space-y-1">
      <span className="text-caption text-text-tertiary">{label}</span>
      {selectedId && !editing ? (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-bg-tertiary border border-border-default">
          <span className="flex-1 text-body-sm text-text-primary truncate">{selectedName ?? selectedId}</span>
          <button
            type="button"
            onClick={() => { setEditing(true); setQuery(""); setResults([]); }}
            className="text-caption text-nah-blue hover:underline"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts by name…"
            autoFocus
            className="w-full bg-bg-primary border border-border-default rounded-md pl-7 pr-2.5 py-1.5 text-body-sm text-text-primary placeholder:text-text-tertiary"
          />
          {showResults && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-bg-primary border border-border-default rounded-md shadow-lg max-h-80 overflow-y-auto">
              {results.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => {
                    onChange(c.id, c.name);
                    setEditing(false);
                    setQuery("");
                    setResults([]);
                  }}
                  className="w-full text-left px-3 py-2 text-body-sm hover:bg-bg-tertiary"
                >
                  <div className="text-text-primary font-medium">{c.name}</div>
                  {(c.email || c.phone) && (
                    <div className="text-caption text-text-tertiary truncate">
                      {c.email ?? ""}{c.email && c.phone ? " · " : ""}{c.phone ?? ""}
                    </div>
                  )}
                </button>
              ))}
              {results.length === 0 && (
                <div className="px-3 py-2 text-caption text-text-tertiary">No matches.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
