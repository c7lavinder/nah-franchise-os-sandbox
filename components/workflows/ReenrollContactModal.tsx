"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * ReenrollContactModal — pick a contact and (re-)enroll them in a workflow.
 *
 * Used from WorkflowDetail to manually enroll any contact, including those
 * whose previous enrollment completed/exited. The enrollment endpoint
 * itself blocks duplicate active enrollments — surface that as an error
 * if it happens.
 */

import { useEffect, useState } from "react";
import { X, Loader2, Search, UserPlus } from "lucide-react";
import { useScrollLock } from "@/lib/hooks/useScrollLock";

interface ContactRow {
  id: string;
  ghl_contact_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
}

interface Props {
  workflowId: string;
  workflowVersionId: string;
  workflowName: string;
  onClose: () => void;
  onEnrolled: () => void;
}

export default function ReenrollContactModal({
  workflowId,
  workflowVersionId,
  workflowName,
  onClose,
  onEnrolled,
}: Props) {
  useScrollLock(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/contacts/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setResults(data.contacts ?? []);
        }
      } catch {
        if (!cancelled) setResults([]);
      }
      if (!cancelled) setSearching(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  async function handleEnroll(contact: ContactRow) {
    if (!contact.ghl_contact_id) {
      setError(`${contact.name} has no GHL ID — can't enroll.`);
      return;
    }
    setError(null);
    setSubmitting(true);
    setSubmittedId(contact.id);
    try {
      const res = await apiFetch("/api/workflows/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId,
          workflowVersionId,
          ghlContactId: contact.ghl_contact_id,
          contactName: contact.name,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(data.error ?? "Failed to enroll");
      }
      onEnrolled();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enroll");
    } finally {
      setSubmitting(false);
      setSubmittedId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-primary border border-border-default rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border-default">
          <UserPlus size={16} className="text-nah-blue" />
          <h3 className="text-body-sm font-semibold text-text-primary flex-1">
            Enroll contact in &quot;{workflowName}&quot;
          </h3>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, or phone..."
              autoFocus
              className="w-full bg-bg-secondary border border-border-default rounded-lg pl-9 pr-3 py-2 text-body-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-nah-blue"
            />
          </div>

          {error && <p className="text-caption text-danger">{error}</p>}

          <div className="max-h-72 overflow-y-auto border border-border-default rounded-lg">
            {query.trim().length < 2 ? (
              <p className="px-3 py-6 text-center text-caption text-text-tertiary">
                Type at least 2 characters to search.
              </p>
            ) : searching ? (
              <div className="flex items-center justify-center py-6 gap-2 text-caption text-text-tertiary">
                <Loader2 size={14} className="animate-spin" />
                Searching…
              </div>
            ) : results.length === 0 ? (
              <p className="px-3 py-6 text-center text-caption text-text-tertiary">No contacts found.</p>
            ) : (
              <ul className="divide-y divide-border-default">
                {results.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleEnroll(c)}
                      className="w-full text-left px-3 py-2.5 hover:bg-bg-secondary disabled:opacity-50 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-body-sm font-medium text-text-primary truncate">{c.name}</p>
                        <p className="text-caption text-text-tertiary truncate">
                          {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      {submittedId === c.id ? (
                        <Loader2 size={14} className="animate-spin text-nah-blue" />
                      ) : (
                        <span className="text-caption text-nah-blue">Enroll</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
