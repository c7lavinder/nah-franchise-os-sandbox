"use client";

/**
 * MergeContactModal — pick a keeper contact to merge the current contact INTO.
 *
 * Convention: the user is viewing a duplicate and wants to retire it in
 * favor of the canonical record. The current contact (passed as
 * `duplicateContact`) gets marked merged; the chosen keeper inherits the
 * activity. After confirmation, calls/emails/journey memberships are
 * reassigned and a merge note is added to the keeper in GHL.
 */

import { useEffect, useState } from "react";
import { X, Loader2, Search, GitMerge, AlertTriangle, Check } from "lucide-react";

interface ContactRow {
  id: string;
  ghl_contact_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
}

interface MergeStep {
  step: string;
  ok: boolean;
  detail?: string;
}

interface Props {
  duplicateContact: { id: string; ghlContactId: string; name: string };
  onClose: () => void;
  onMerged: (keeperLocalId: string) => void;
}

export default function MergeContactModal({ duplicateContact, onClose, onMerged }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [keeper, setKeeper] = useState<ContactRow | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<MergeStep[] | null>(null);

  useEffect(() => {
    if (query.trim().length < 2 || keeper) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          // Hide the duplicate itself from results — can't merge into yourself
          const filtered = (data.contacts ?? []).filter(
            (c: ContactRow) => c.id !== duplicateContact.id,
          );
          if (!cancelled) setResults(filtered);
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
  }, [query, keeper, duplicateContact.id]);

  async function handleMerge() {
    if (!keeper) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/contacts/${duplicateContact.ghlContactId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keepContactId: keeper.id,
          reason: reason.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(data.error ?? "Merge failed");
      }
      const data = await res.json();
      setSteps(data.steps as MergeStep[]);
      // Caller will likely navigate away; keep the result panel visible
      // until they close so they can read the per-step summary.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (steps && keeper) {
      onMerged(keeper.id);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-bg-primary border border-border-default rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border-default">
          <GitMerge size={16} className="text-warning" />
          <h3 className="text-body-sm font-semibold text-text-primary flex-1">
            Merge {duplicateContact.name} into another contact
          </h3>
          <button onClick={handleClose} className="text-text-tertiary hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        {steps ? (
          <div className="p-5 overflow-y-auto">
            <p className="text-body-sm font-medium text-text-primary mb-3">
              Merged into {keeper?.name}
            </p>
            <ul className="border border-border-default rounded-lg divide-y divide-border-default">
              {steps.map((s) => (
                <li key={s.step} className="flex items-center justify-between px-3 py-2">
                  <span className="text-body-sm text-text-primary">{s.step.replace(/_/g, " ")}</span>
                  {s.ok ? (
                    <span className="flex items-center gap-1 text-caption text-success">
                      <Check size={12} />
                      {s.detail ?? "ok"}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-caption text-danger">
                      <AlertTriangle size={12} />
                      {s.detail ?? "failed"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex justify-end mt-4">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-lg bg-nah-blue text-white text-body-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-3 overflow-y-auto">
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle size={14} className="text-warning mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-body-sm font-medium text-text-primary mb-0.5">
                  This action cannot be auto-undone.
                </p>
                <p className="text-caption text-text-secondary">
                  Calls, emails, and journey memberships from {duplicateContact.name} will move to
                  the chosen keeper. The duplicate stays in GHL but is tagged{" "}
                  <code className="bg-bg-secondary rounded px-1">duplicate-merged</code>.
                </p>
              </div>
            </div>

            {/* Search / picker */}
            {!keeper ? (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search for the keeper contact..."
                    autoFocus
                    className="w-full bg-bg-secondary border border-border-default rounded-lg pl-9 pr-3 py-2 text-body-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-nah-blue"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto border border-border-default rounded-lg">
                  {query.trim().length < 2 ? (
                    <p className="px-3 py-6 text-center text-caption text-text-tertiary">
                      Type at least 2 characters to search.
                    </p>
                  ) : searching ? (
                    <div className="flex items-center justify-center py-6 gap-2 text-caption text-text-tertiary">
                      <Loader2 size={14} className="animate-spin" /> Searching…
                    </div>
                  ) : results.length === 0 ? (
                    <p className="px-3 py-6 text-center text-caption text-text-tertiary">
                      No matching contacts.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border-default">
                      {results.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => setKeeper(c)}
                            className="w-full text-left px-3 py-2.5 hover:bg-bg-secondary"
                          >
                            <p className="text-body-sm font-medium text-text-primary truncate">
                              {c.name}
                            </p>
                            <p className="text-caption text-text-tertiary truncate">
                              {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="bg-bg-secondary border border-border-default rounded-lg p-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-caption text-text-tertiary">Keeper:</p>
                    <p className="text-body-sm font-medium text-text-primary truncate">{keeper.name}</p>
                    <p className="text-caption text-text-tertiary truncate">
                      {[keeper.email, keeper.phone].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <button
                    onClick={() => setKeeper(null)}
                    className="text-caption text-nah-blue hover:underline"
                  >
                    Change
                  </button>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-text-tertiary tracking-wider block mb-1">
                    REASON (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Same person, different email"
                    className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-nah-blue"
                  />
                </div>
              </>
            )}

            {error && <p className="text-caption text-danger">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-body-sm font-medium text-text-secondary hover:bg-bg-secondary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleMerge()}
                disabled={submitting || !keeper}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-warning text-white text-body-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-40"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {submitting ? "Merging…" : "Merge"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
