"use client";

/**
 * TerritoryAssignModal — shown when advancing to a terminal stage (Closed).
 * Creates a new territory and assigns it to the contact, so onboarding
 * auto-spawn can create per-territory pipeline rows.
 */

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/auth/api-fetch";
import { useToast } from "@/components/ui/Toast";

interface TerritoryAssignModalProps {
  ghlContactId: string;
  contactName: string;
  onClose: () => void;
  onCreated: () => void;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

export default function TerritoryAssignModal({
  ghlContactId,
  contactName,
  onClose,
  onCreated,
}: TerritoryAssignModalProps) {
  const { toast } = useToast();
  const [territoryName, setTerritoryName] = useState("");
  const [slug, setSlug] = useState("");
  const [region, setRegion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSlug, setAutoSlug] = useState(true);

  function handleNameChange(val: string) {
    setTerritoryName(val);
    if (autoSlug) setSlug(slugify(val));
  }

  async function handleCreate() {
    if (!territoryName.trim() || !slug.trim()) {
      setError("Territory name and slug are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/territories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          TerritorySlug: slug.trim(),
          Nickname: territoryName.trim(),
          region: region.trim() || undefined,
          ghl_contact_id: ghlContactId,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: "Failed to create territory" }));
        throw new Error(d.error ?? "Failed to create territory");
      }
      toast(`Territory "${territoryName}" created and assigned to ${contactName}`);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create territory");
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-tertiary border border-border-default rounded-lg w-full max-w-sm mx-4 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-h2 text-text-primary">Create Territory</h2>
          <button onClick={onClose} className="btn-ghost p-1">
            <X size={18} />
          </button>
        </div>

        <p className="text-caption text-text-tertiary mb-4">
          Assign a territory to {contactName} before closing. This links them for onboarding.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-caption text-text-tertiary mb-1">Territory Name</label>
            <input
              value={territoryName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Chattanooga"
              className="w-full bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary"
            />
          </div>

          <div>
            <label className="block text-caption text-text-tertiary mb-1">Slug (ID)</label>
            <input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setAutoSlug(false);
              }}
              placeholder="e.g. chattanooga"
              className="w-full bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary font-mono"
            />
          </div>

          <div>
            <label className="block text-caption text-text-tertiary mb-1">Region (optional)</label>
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. Southeast"
              className="w-full bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary"
            />
          </div>
        </div>

        {error && <p className="text-body-sm text-danger mt-3">{error}</p>}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-body-sm">
            Cancel
          </button>
          <button
            onClick={() => void handleCreate()}
            disabled={saving || !territoryName.trim()}
            className="btn-primary px-4 py-2 text-body-sm ml-auto flex items-center gap-1"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Creating..." : "Create & Assign"}
          </button>
        </div>
      </div>
    </div>
  );
}
