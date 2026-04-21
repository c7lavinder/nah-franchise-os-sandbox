"use client";

/**
 * Reclassify + Reassign buttons for the call detail page header.
 *
 * Reclassify: pick a new call_type from the dropdown of all call_types.
 * Reassign: pick a new contact and/or a new territory via search inputs.
 * Both submit to POST /api/calls/[id]/override and trigger a page refresh.
 * Visible only to admins and the call's owning rep (hosted_by_user_id).
 */

import { useEffect, useRef, useState } from "react";
import { Tag, UserCog, X, Loader2, Search } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

interface CallType {
  id: string;
  name: string;
  slug: string;
}

interface ContactOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface TerritoryOption {
  ms_slug: string;
  territory_name: string;
}

interface Props {
  callId: string;
  hostedByUserId: string | null;
  currentCallTypeId: string | null;
  currentContactId: string | null;
  currentTerritorySlug: string | null;
  onChange: () => void;
}

export default function CallOverrideControls(props: Props) {
  const { user, token } = useAuth();

  if (!user) return null;
  const isAdmin = user.role === "admin";
  const isOwner = props.hostedByUserId === user.id;
  if (!isAdmin && !isOwner) return null;

  return (
    <>
      <ReclassifyButton {...props} token={token} />
      <ReassignButton {...props} token={token} />
    </>
  );
}

// ─── Reclassify ───────────────────────────────────────────────────────────

function ReclassifyButton(props: Props & { token: string | null }) {
  const [open, setOpen] = useState(false);
  const [callTypes, setCallTypes] = useState<CallType[]>([]);
  const [selected, setSelected] = useState<string>(props.currentCallTypeId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(props.currentCallTypeId ?? "");
    setError(null);
    void (async () => {
      const res = await fetch("/api/settings/call-types");
      if (res.ok) {
        const data = await res.json();
        setCallTypes(data.callTypes ?? data ?? []);
      }
    })();
  }, [open, props.currentCallTypeId]);

  async function submit() {
    if (!selected || selected === props.currentCallTypeId) {
      setOpen(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/calls/${props.callId}/override`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(props.token ? { Authorization: `Bearer ${props.token}` } : {}),
        },
        body: JSON.stringify({ call_type_id: selected }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save");
        setSaving(false);
        return;
      }
      setSaving(false);
      setOpen(false);
      props.onChange();
    } catch {
      setError("Network error");
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost p-1.5 flex-shrink-0"
        title="Reclassify call type"
      >
        <Tag size={14} />
      </button>
      {open && (
        <ModalShell title="Reclassify call" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <label className="block text-caption text-text-tertiary">Call type</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full bg-bg-primary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary"
            >
              <option value="">Select...</option>
              {callTypes.map((ct) => (
                <option key={ct.id} value={ct.id}>{ct.name}</option>
              ))}
            </select>
            {error && <div className="text-caption text-danger">{error}</div>}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="btn-ghost px-3 py-1.5 text-caption">Cancel</button>
              <button onClick={submit} disabled={saving || !selected} className="btn-primary px-3 py-1.5 text-caption disabled:opacity-50">
                {saving ? <Loader2 size={12} className="animate-spin" /> : "Save"}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  );
}

// ─── Reassign (Contact / Territory) ──────────────────────────────────────

function ReassignButton(props: Props & { token: string | null }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"contact" | "territory">("contact");

  // Contact search state
  const [contactQuery, setContactQuery] = useState("");
  const [contactResults, setContactResults] = useState<ContactOption[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(props.currentContactId);
  const [selectedContactName, setSelectedContactName] = useState<string>("");

  // Territory state
  const [territories, setTerritories] = useState<TerritoryOption[]>([]);
  const [selectedTerritorySlug, setSelectedTerritorySlug] = useState<string | null>(
    props.currentTerritorySlug,
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSelectedContactId(props.currentContactId);
    setSelectedTerritorySlug(props.currentTerritorySlug);
    void (async () => {
      const res = await fetch("/api/territories");
      if (res.ok) {
        const data = await res.json();
        setTerritories((data.territories ?? data ?? []) as TerritoryOption[]);
      }
    })();
  }, [open, props.currentContactId, props.currentTerritorySlug]);

  // Debounced contact search
  useEffect(() => {
    if (contactQuery.length < 2) { setContactResults([]); return; }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/pipeline/contacts?q=${encodeURIComponent(contactQuery)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setContactResults((data.contacts ?? []) as ContactOption[]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [contactQuery]);

  const lastSavedRef = useRef<string>("");

  async function submit() {
    const payload: Record<string, string | null> = {};
    if (selectedContactId !== props.currentContactId) payload.contact_id = selectedContactId;
    if (selectedTerritorySlug !== props.currentTerritorySlug) payload.territory_ms_slug = selectedTerritorySlug;

    if (Object.keys(payload).length === 0) {
      setOpen(false);
      return;
    }

    const key = JSON.stringify(payload);
    if (key === lastSavedRef.current) { setOpen(false); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/calls/${props.callId}/override`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(props.token ? { Authorization: `Bearer ${props.token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save");
        setSaving(false);
        return;
      }
      lastSavedRef.current = key;
      setSaving(false);
      setOpen(false);
      props.onChange();
    } catch {
      setError("Network error");
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost p-1.5 flex-shrink-0"
        title="Reassign contact or territory"
      >
        <UserCog size={14} />
      </button>
      {open && (
        <ModalShell title="Reassign call" onClose={() => setOpen(false)}>
          <div className="flex gap-1 mb-3 border-b border-border-default">
            {(["contact", "territory"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-caption font-medium capitalize border-b-2 -mb-px ${
                  tab === t ? "border-nah-blue text-text-primary" : "border-transparent text-text-tertiary hover:text-text-primary"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "contact" && (
            <div className="space-y-2">
              {selectedContactId && selectedContactName ? (
                <div className="flex items-center gap-2 bg-bg-primary border border-border-default rounded-md px-3 py-2">
                  <span className="text-body-sm text-text-primary flex-1 truncate">{selectedContactName}</span>
                  <button
                    onClick={() => { setSelectedContactId(null); setSelectedContactName(""); setContactQuery(""); }}
                    className="text-text-tertiary hover:text-text-primary"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
                    <input
                      type="text"
                      value={contactQuery}
                      onChange={(e) => setContactQuery(e.target.value)}
                      placeholder="Search contacts..."
                      className="w-full bg-bg-primary border border-border-default rounded-md pl-8 pr-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary"
                    />
                  </div>
                  {contactResults.length > 0 && (
                    <div className="bg-bg-primary border border-border-default rounded-md max-h-40 overflow-y-auto">
                      {contactResults.map((c) => {
                        const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unknown";
                        return (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSelectedContactId(c.id);
                              setSelectedContactName(name);
                              setContactQuery("");
                              setContactResults([]);
                            }}
                            className="w-full text-left px-3 py-2 text-body-sm text-text-primary hover:bg-bg-secondary"
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "territory" && (
            <div className="space-y-2">
              <select
                value={selectedTerritorySlug ?? ""}
                onChange={(e) => setSelectedTerritorySlug(e.target.value || null)}
                className="w-full bg-bg-primary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary"
              >
                <option value="">— none —</option>
                {territories.map((t) => (
                  <option key={t.ms_slug} value={t.ms_slug}>{t.territory_name}</option>
                ))}
              </select>
            </div>
          )}

          {error && <div className="text-caption text-danger mt-2">{error}</div>}
          <div className="flex items-center justify-end gap-2 pt-3">
            <button onClick={() => setOpen(false)} className="btn-ghost px-3 py-1.5 text-caption">Cancel</button>
            <button onClick={submit} disabled={saving} className="btn-primary px-3 py-1.5 text-caption disabled:opacity-50">
              {saving ? <Loader2 size={12} className="animate-spin" /> : "Save"}
            </button>
          </div>
        </ModalShell>
      )}
    </>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-bg-secondary border border-border-default rounded-lg shadow-xl w-full max-w-md p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-body-sm font-medium text-text-primary">{title}</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
