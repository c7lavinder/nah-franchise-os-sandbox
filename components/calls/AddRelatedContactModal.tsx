"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

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
  TerritorySlug: string;
  Nickname: string;
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

type Anchor = "territory" | "journey" | "personal";

/** Roles offered on the journey-partner anchor for the OPTIONAL
 *  contact_related_people row. "None" skips writing the relationship row. */
const JOURNEY_RELATIONSHIP_ROLES: Array<{ value: string; label: string }> = [
  { value: "", label: "— none —" },
  { value: "family", label: "Family" },
  { value: "spouse", label: "Spouse" },
  { value: "business_partner", label: "Business partner" },
  { value: "other", label: "Other" },
];

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

  // Personal-anchored + journey-partner state (shared contact picker)
  const [targetContactId, setTargetContactId] = useState<string | null>(primaryContactId);
  const [targetContactName, setTargetContactName] = useState<string | null>(primaryContactName ?? null);
  // Journey-partner: optional family relationship to ALSO write as a
  // contact_related_people row alongside the journey_contacts co_primary.
  const [journeyRelationship, setJourneyRelationship] = useState<string>("");

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
    setJourneyRelationship("");
    setError(null);
  }, [open, prefill, primaryContactId, primaryContactName]);

  // Load territories when the modal opens.
  useEffect(() => {
    if (!open) return;
    void (async () => {
      const res = await apiFetch("/api/territories?status=active");
      if (!res.ok) return;
      const data = (await res.json()) as { territories?: TerritoryOption[] };
      const list = data.territories ?? [];
      setTerritories(list);
      const fromCall = (callTerritorySlugs ?? []).find((s) => list.some((t) => t.TerritorySlug === s));
      setTerritorySlug(fromCall ?? list[0]?.TerritorySlug ?? "");
    })();
  }, [open, callTerritorySlugs]);

  // Lock body scroll while the modal is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
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
    if (anchor === "journey" && !targetContactId) {
      setError("Pick the contact whose journey this person is partnering on.");
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
        const createRes = await apiFetch("/api/contacts/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
            // Only prospects/franchisees own journeys — ecosystem contacts
            // (employees, contractors, spouses, attorneys) do not.
            createJourney: false,
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
        const linkRes = await apiFetch(`/api/territories/${encodeURIComponent(territorySlug)}/stakeholders`, {
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
        });
        if (!linkRes.ok) {
          const data = await linkRes.json().catch(() => ({}));
          setError(data.error ?? "Contact created, but ecosystem link failed — retry from the territory page.");
          setSaving(false);
          return;
        }
      } else if (anchor === "journey") {
        // Find the target contact's active direct journey.
        const jRes = await apiFetch(`/api/contacts/${targetContactId}/journey`);
        const jData = (await jRes.json()) as {
          journeys?: Array<{ journey_id: string; journey_name: string; role: string }>;
        };
        const direct = (jData.journeys ?? []).find((j) => j.role !== "stakeholder");
        if (!direct) {
          setError(`${targetContactName ?? "That contact"} has no active journey to partner on.`);
          setSaving(false);
          return;
        }
        // Add new contact as co_primary; endpoint rebuilds the journey name.
        const memberRes = await apiFetch(`/api/journeys/${direct.journey_id}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contact_id: newContactId, role: "co_primary" }),
        });
        if (!memberRes.ok) {
          const data = await memberRes.json().catch(() => ({}));
          setError(data.error ?? "Contact created, but journey link failed.");
          setSaving(false);
          return;
        }
        // Optional — also record the family/spouse/business-partner relationship.
        if (journeyRelationship) {
          await apiFetch(`/api/contacts/${targetContactId}/related-people`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              email: email.trim() || null,
              phone: phone.trim() || null,
              role: journeyRelationship,
              relationship_notes: notes.trim() || null,
              linked_contact_id: newContactId,
            }),
          });
        }
      } else {
        const linkRes = await apiFetch(`/api/contacts/${targetContactId}/related-people`, {
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
          <button type="button" onClick={onClose} className="btn-ghost p-1">
            <X size={14} />
          </button>
        </div>

        {/* Anchor toggle */}
        <div className="grid grid-cols-3 gap-1 p-0.5 bg-bg-secondary rounded-md">
          <button
            type="button"
            onClick={() => setAnchor("territory")}
            className={`px-2 py-1.5 text-[11px] rounded transition-colors ${
              anchor === "territory"
                ? "bg-bg-primary text-text-primary shadow-sm"
                : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            Works at territory
          </button>
          <button
            type="button"
            onClick={() => setAnchor("journey")}
            className={`px-2 py-1.5 text-[11px] rounded transition-colors ${
              anchor === "journey"
                ? "bg-bg-primary text-text-primary shadow-sm"
                : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            Journey partner
          </button>
          <button
            type="button"
            onClick={() => setAnchor("personal")}
            className={`px-2 py-1.5 text-[11px] rounded transition-colors ${
              anchor === "personal"
                ? "bg-bg-primary text-text-primary shadow-sm"
                : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            Personal to contact
          </button>
        </div>

        <p className="text-[10px] text-text-tertiary leading-relaxed">
          {anchor === "territory" &&
            "Employees, contractors, agents — anchored to the territory. Stays when ownership changes."}
          {anchor === "journey" &&
            "Business partner on the franchise deal — added as 50/50 co-primary on the target's journey. Shows up on both the journey page and (once awarded) the territory's owners block."}
          {anchor === "personal" &&
            "Spouse, family, attorney — anchored to a specific contact. Doesn't survive a franchise sale."}
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

        {anchor !== "journey" && (
          <label className="space-y-1 block">
            <span className="text-caption text-text-tertiary">Role *</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-bg-primary border border-border-default rounded-md px-2.5 py-1.5 text-body-sm text-text-primary"
            >
              {(anchor === "territory" ? TERRITORY_ROLES : PERSONAL_ROLES).map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {anchor === "territory" && (
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
                  <option key={t.TerritorySlug} value={t.TerritorySlug}>
                    {t.Nickname} ({t.TerritorySlug})
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
        )}

        {anchor === "personal" && (
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

        {anchor === "journey" && (
          <>
            <ContactPicker
              label="Partner of *"
              selectedId={targetContactId}
              selectedName={targetContactName}
              onChange={(id, name) => {
                setTargetContactId(id);
                setTargetContactName(name);
              }}
            />
            <label className="space-y-1 block">
              <span className="text-caption text-text-tertiary">
                Family relationship (optional)
                <span className="text-text-tertiary/70 ml-1">— also records a relationship row</span>
              </span>
              <select
                value={journeyRelationship}
                onChange={(e) => setJourneyRelationship(e.target.value)}
                className="w-full bg-bg-primary border border-border-default rounded-md px-2.5 py-1.5 text-body-sm text-text-primary"
              >
                {JOURNEY_RELATIONSHIP_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </>
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
    if (query.length < 2) {
      setResults([]);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const res = await apiFetch(`/api/contacts/search?q=${encodeURIComponent(query)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setResults((data.results ?? data.contacts ?? []) as ContactOption[]);
      }
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
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
            onClick={() => {
              setEditing(true);
              setQuery("");
              setResults([]);
            }}
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
                      {c.email ?? ""}
                      {c.email && c.phone ? " · " : ""}
                      {c.phone ?? ""}
                    </div>
                  )}
                </button>
              ))}
              {results.length === 0 && <div className="px-3 py-2 text-caption text-text-tertiary">No matches.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
