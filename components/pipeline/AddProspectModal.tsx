"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useEffect, useCallback } from "react";
import { X, Loader2 } from "lucide-react";

interface LeadSubSource {
  id: string;
  lead_source_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

interface LeadSource {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  subSources: LeadSubSource[];
}

interface AddProspectModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (contactId?: string, displayName?: string) => void;
  prefill?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
}

export default function AddProspectModal({ open, onClose, onCreated, prefill }: AddProspectModalProps) {
  const [firstName, setFirstName] = useState(prefill?.firstName ?? "");
  const [lastName, setLastName] = useState(prefill?.lastName ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [phone, setPhone] = useState(prefill?.phone ?? "");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [source, setSource] = useState("");
  const [subSource, setSubSource] = useState("");

  const [sources, setSources] = useState<LeadSource[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch lead sources on mount
  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const res = await apiFetch("/api/settings/lead-sources");
        if (res.ok) {
          const data = await res.json();
          setSources((data.sources as LeadSource[]).filter((s) => s.is_active));
        }
      } catch {
        /* silent */
      }
    })();
  }, [open]);

  // Apply prefill when modal opens
  useEffect(() => {
    if (!open) return;
    setFirstName(prefill?.firstName ?? "");
    setLastName(prefill?.lastName ?? "");
    setEmail(prefill?.email ?? "");
    setPhone(prefill?.phone ?? "");
  }, [open, prefill]);

  // Reset sub-source when source changes
  useEffect(() => {
    setSubSource("");
  }, [source]);

  const selectedSource = sources.find((s) => s.name === source);
  const activeSubSources = (selectedSource?.subSources ?? []).filter((ss) => ss.is_active);

  const resetForm = useCallback(() => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setCity("");
    setState("");
    setSource("");
    setSubSource("");
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError("At least an email or phone number is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/contacts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          source: source || undefined,
          subSource: subSource || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? "Failed to create prospect.");
        return;
      }
      const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
      resetForm();
      onCreated(result.contactId, displayName || undefined);
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* Modal */}
      <form
        onSubmit={handleSubmit}
        className="relative bg-surface-solid rounded-lg border border-border-default shadow-xl w-full max-w-md mx-4 p-6 space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-body-lg font-semibold text-text-primary">Add Journey</h2>
          <button type="button" onClick={handleClose} className="btn-ghost p-1.5">
            <X size={16} />
          </button>
        </div>

        {error && <div className="text-body-sm text-danger bg-danger/10 rounded-md px-3 py-2">{error}</div>}

        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-caption text-text-secondary">First Name *</span>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full bg-bg-tertiary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary focus:border-nah-orange focus:outline-none"
              required
            />
          </label>
          <label className="space-y-1">
            <span className="text-caption text-text-secondary">Last Name *</span>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full bg-bg-tertiary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary focus:border-nah-orange focus:outline-none"
              required
            />
          </label>
        </div>

        {/* Contact info */}
        <label className="block space-y-1">
          <span className="text-caption text-text-secondary">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prospect@email.com"
            className="w-full bg-bg-tertiary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-nah-orange focus:outline-none"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-caption text-text-secondary">Phone</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
            className="w-full bg-bg-tertiary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-nah-orange focus:outline-none"
          />
        </label>

        {/* Location row */}
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-caption text-text-secondary">City</span>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full bg-bg-tertiary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary focus:border-nah-orange focus:outline-none"
            />
          </label>
          <label className="space-y-1">
            <span className="text-caption text-text-secondary">State</span>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="TX"
              maxLength={2}
              className="w-full bg-bg-tertiary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-nah-orange focus:outline-none"
            />
          </label>
        </div>

        {/* Lead source row */}
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-caption text-text-secondary">Lead Source</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full bg-bg-tertiary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary focus:border-nah-orange focus:outline-none"
            >
              <option value="">Select...</option>
              {sources.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-caption text-text-secondary">Sub-Source</span>
            <select
              value={subSource}
              onChange={(e) => setSubSource(e.target.value)}
              disabled={!source || activeSubSources.length === 0}
              className="w-full bg-bg-tertiary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary focus:border-nah-orange focus:outline-none disabled:opacity-50"
            >
              <option value="">Select...</option>
              {activeSubSources.map((ss) => (
                <option key={ss.id} value={ss.name}>
                  {ss.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-body-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-nah-orange text-white text-body-sm font-medium rounded-md hover:bg-nah-orange/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? "Creating..." : "Add Journey"}
          </button>
        </div>
      </form>
    </div>
  );
}
