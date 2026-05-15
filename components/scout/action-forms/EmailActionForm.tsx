"use client";

import { useCallback } from "react";
import { apiFetch } from "@/lib/auth/api-fetch";
import SearchableDropdown, { type DropdownOption } from "@/components/ui/SearchableDropdown";
import type { DraftedMessagePayload } from "@/types/scout";

const FROM_OPTIONS: DropdownOption[] = [
  { id: "notifications@newagainhouses.com", label: "Notifications", sublabel: "notifications@newagainhouses.com" },
  { id: "chad@newagainhouses.com", label: "Chad", sublabel: "chad@newagainhouses.com" },
  { id: "team@newagainhouses.com", label: "Team", sublabel: "team@newagainhouses.com" },
  { id: "franchise@newagainhouses.com", label: "Franchise", sublabel: "franchise@newagainhouses.com" },
];

interface EmailActionFormProps {
  payload: DraftedMessagePayload;
  contactId: string;
  contactName: string;
  onChange: (payload: DraftedMessagePayload) => void;
  onContactChange?: (id: string, name: string) => void;
  disabled?: boolean;
}

export default function EmailActionForm({
  payload,
  contactId,
  contactName,
  onChange,
  onContactChange,
  disabled = false,
}: EmailActionFormProps) {
  const searchContacts = useCallback(async (query: string): Promise<DropdownOption[]> => {
    const res = await apiFetch(`/api/contacts/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    // GHL email sends require the GHL contact ID, not our internal Supabase UUID.
    return (data.contacts as { id: string; ghl_contact_id: string | null; name: string; email: string | null }[])
      .filter((c) => !!c.ghl_contact_id)
      .map((c) => ({ id: c.ghl_contact_id as string, label: c.name, sublabel: c.email ?? "No email" }));
  }, []);

  function update(patch: Partial<DraftedMessagePayload>) {
    onChange({ ...payload, ...patch });
  }

  const isScheduled = !!payload.scheduledAt;
  const scheduledValue = payload.scheduledAt ? new Date(payload.scheduledAt).toISOString().slice(0, 16) : "";

  return (
    <div className="space-y-3">
      {/* To (contact with email) */}
      <SearchableDropdown
        value={contactId}
        valueLabel={`${contactName}${payload.toAddress ? ` — ${payload.toAddress}` : ""}`}
        onChange={(opt) => {
          if (opt && onContactChange) {
            onContactChange(opt.id, opt.label);
            update({ toAddress: opt.sublabel !== "No email" ? opt.sublabel : undefined });
          }
        }}
        onSearch={searchContacts}
        placeholder="Search contact..."
        label="To"
        clearable={false}
        disabled={disabled}
      />

      {/* From (email address) */}
      <SearchableDropdown
        value={payload.fromAddress ?? null}
        valueLabel={payload.fromName ? `${payload.fromName} — ${payload.fromAddress}` : payload.fromAddress}
        onChange={(opt) => {
          if (opt) update({ fromAddress: opt.id, fromName: opt.label });
        }}
        options={FROM_OPTIONS}
        placeholder="Select sender..."
        label="From"
        clearable={false}
        disabled={disabled}
      />

      {/* Subject */}
      <div>
        <label className="block text-caption text-text-tertiary mb-1">Subject</label>
        <input
          type="text"
          value={payload.subject ?? ""}
          onChange={(e) => update({ subject: e.target.value || undefined })}
          disabled={disabled}
          placeholder="Email subject..."
          className="w-full bg-bg-primary/50 border border-border-glass rounded-md px-3 py-2 text-body-sm outline-none focus:border-nah-blue disabled:opacity-50"
        />
      </div>

      {/* Body */}
      <div>
        <label className="block text-caption text-text-tertiary mb-1">Body</label>
        <textarea
          value={payload.content}
          onChange={(e) => update({ content: e.target.value })}
          disabled={disabled}
          rows={6}
          className="w-full bg-bg-primary/50 border border-border-glass rounded-md px-3 py-2 text-body-sm outline-none focus:border-nah-blue resize-y disabled:opacity-50"
        />
      </div>

      {/* Schedule */}
      <div>
        <label className="block text-caption text-text-tertiary mb-1">Send</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => update({ scheduledAt: null })}
            disabled={disabled}
            className={`px-3 py-2 rounded-md text-body-sm font-medium transition-colors ${
              !isScheduled
                ? "bg-nah-blue text-white"
                : "bg-bg-primary/50 border border-border-glass text-text-secondary hover:bg-bg-hover"
            } disabled:opacity-50`}
          >
            Now
          </button>
          <button
            type="button"
            onClick={() => update({ scheduledAt: new Date(Date.now() + 3600000).toISOString() })}
            disabled={disabled}
            className={`px-3 py-2 rounded-md text-body-sm font-medium transition-colors ${
              isScheduled
                ? "bg-nah-blue text-white"
                : "bg-bg-primary/50 border border-border-glass text-text-secondary hover:bg-bg-hover"
            } disabled:opacity-50`}
          >
            Schedule
          </button>
          {isScheduled && (
            <input
              type="datetime-local"
              value={scheduledValue}
              onChange={(e) => update({ scheduledAt: new Date(e.target.value).toISOString() })}
              disabled={disabled}
              className="flex-1 bg-bg-primary/50 border border-border-glass rounded-md px-3 py-2 text-body-sm outline-none focus:border-nah-blue disabled:opacity-50"
            />
          )}
        </div>
      </div>
    </div>
  );
}
