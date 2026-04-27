"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * Email list + add/remove/promote UI for a single contact.
 *
 * Drops into both the slim and rich contact pages. Shows every row
 * from contact_emails sorted with primary first, lets the user add a
 * new address, promote any row to primary, or remove one. Mutations
 * hit /api/contacts/[id]/emails and push back to GHL as additionalEmails.
 */

import React, { useEffect, useState } from "react";
import { Mail, Plus, Star, Trash2, Loader2 } from "lucide-react";

interface EmailRow {
  id: string;
  email: string;
  is_primary: boolean;
  label: string | null;
  source: string;
}

interface Props {
  contactId: string;
  /** Initial server-rendered primary email so we can show something pre-hydration. */
  initialPrimaryEmail?: string | null;
}

export default function ContactEmailsPanel({ contactId, initialPrimaryEmail }: Props) {
  const [rows, setRows] = useState<EmailRow[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    const res = await apiFetch(`/api/contacts/${contactId}/emails`, { cache: "no-store" });
    if (!res.ok) { setError("Failed to load emails"); return; }
    const body = (await res.json()) as { emails: EmailRow[] };
    setRows(body.emails);
  }

  useEffect(() => { void load(); }, [contactId]);

  async function handleAdd(): Promise<void> {
    setError(null);
    const email = newEmail.trim();
    if (!email) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/contacts/${contactId}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Couldn't add email");
      } else {
        setNewEmail("");
        setAdding(false);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handlePromote(emailId: string): Promise<void> {
    setBusy(true);
    try {
      await apiFetch(`/api/contacts/${contactId}/emails/${emailId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ makePrimary: true }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(emailId: string): Promise<void> {
    if (!confirm("Remove this email from the contact?")) return;
    setBusy(true);
    try {
      await apiFetch(`/api/contacts/${contactId}/emails/${emailId}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  const display: EmailRow[] = rows ?? (initialPrimaryEmail
    ? [{ id: "__pending", email: initialPrimaryEmail, is_primary: true, label: null, source: "backfill" }]
    : []);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <dt className="text-text-tertiary text-[10px] flex items-center gap-1">
          <Mail size={10} /> Email
          {display.length > 1 ? ` (${display.length})` : ""}
        </dt>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-[10px] text-nah-blue hover:underline flex items-center gap-0.5"
          >
            <Plus size={10} /> Add
          </button>
        )}
      </div>

      <dd className="space-y-1">
        {display.length === 0 && !adding && (
          <span className="text-text-tertiary text-caption">No emails</span>
        )}

        {display.map((r) => (
          <div key={r.id} className="flex items-center gap-1.5 group">
            {r.is_primary ? (
              <Star size={10} className="text-nah-orange fill-nah-orange shrink-0" aria-label="Primary" />
            ) : (
              <button
                type="button"
                onClick={() => handlePromote(r.id)}
                disabled={busy || r.id === "__pending"}
                className="text-text-tertiary hover:text-nah-orange shrink-0 disabled:opacity-30"
                title="Make primary"
              >
                <Star size={10} />
              </button>
            )}
            <span className="text-text-primary text-body-sm break-all flex-1">{r.email}</span>
            {!r.is_primary && r.id !== "__pending" && (
              <button
                type="button"
                onClick={() => handleDelete(r.id)}
                disabled={busy}
                className="text-text-tertiary hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove email"
              >
                <Trash2 size={10} />
              </button>
            )}
          </div>
        ))}

        {adding && (
          <div className="flex items-center gap-1 mt-1">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="email@example.com"
              className="flex-1 px-2 py-1 text-caption bg-bg-primary border border-border-default rounded text-text-primary"
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); void handleAdd(); }
                if (e.key === "Escape") { setAdding(false); setNewEmail(""); setError(null); }
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy || !newEmail.trim()}
              className="text-[10px] text-nah-blue disabled:opacity-40 px-1"
            >
              {busy ? <Loader2 size={10} className="animate-spin" /> : "Save"}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setNewEmail(""); setError(null); }}
              disabled={busy}
              className="text-[10px] text-text-tertiary px-1"
            >
              Cancel
            </button>
          </div>
        )}

        {error && <p className="text-caption text-danger">{error}</p>}
      </dd>
    </div>
  );
}
