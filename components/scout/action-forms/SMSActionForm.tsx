"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/auth/api-fetch";
import SearchableDropdown, { type DropdownOption } from "@/components/ui/SearchableDropdown";
import type { DraftedMessagePayload } from "@/types/scout";

interface SMSActionFormProps {
  payload: DraftedMessagePayload;
  contactId: string;
  contactName: string;
  onChange: (payload: DraftedMessagePayload) => void;
  onContactChange?: (id: string, name: string) => void;
  disabled?: boolean;
}

export default function SMSActionForm({
  payload,
  contactId,
  contactName,
  onChange,
  onContactChange,
  disabled = false,
}: SMSActionFormProps) {
  const [teamMembers, setTeamMembers] = useState<DropdownOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/team/members")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then((data) => {
        if (!cancelled) {
          setTeamMembers(
            ((data.members ?? []) as { ghlUserId: string; fullName: string }[]).map((m) => ({
              id: m.ghlUserId,
              label: m.fullName,
              sublabel: "+1 (888) NAH-FLIP",
            }))
          );
        }
      })
      .catch(() => {
        if (!cancelled) setTeamMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const searchContacts = useCallback(async (query: string): Promise<DropdownOption[]> => {
    const res = await apiFetch(`/api/contacts/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.contacts as { id: string; name: string; phone: string | null }[]).map((c) => ({
      id: c.id,
      label: c.name,
      sublabel: c.phone ?? "No phone",
    }));
  }, []);

  function update(patch: Partial<DraftedMessagePayload>) {
    onChange({ ...payload, ...patch });
  }

  // Schedule: "now" if no scheduledAt, otherwise show the datetime
  const isScheduled = !!payload.scheduledAt;
  const scheduledValue = payload.scheduledAt ? new Date(payload.scheduledAt).toISOString().slice(0, 16) : "";

  return (
    <div className="space-y-3">
      {/* To (contact with phone) */}
      <SearchableDropdown
        value={contactId}
        valueLabel={`${contactName}${payload.toAddress ? ` — ${payload.toAddress}` : ""}`}
        onChange={(opt) => {
          if (opt && onContactChange) {
            onContactChange(opt.id, opt.label);
            update({ toAddress: opt.sublabel !== "No phone" ? opt.sublabel : undefined });
          }
        }}
        onSearch={searchContacts}
        placeholder="Search contact..."
        label="To"
        clearable={false}
        disabled={disabled}
      />

      {/* From (sender) */}
      <SearchableDropdown
        value={payload.fromAddress ?? null}
        valueLabel={payload.fromName ? `${payload.fromName} — ${payload.fromAddress}` : payload.fromAddress}
        onChange={(opt) => {
          if (opt) update({ fromAddress: "+1 (888) NAH-FLIP", fromName: opt.label });
        }}
        options={teamMembers}
        placeholder="Select sender..."
        label="From"
        clearable={false}
        disabled={disabled}
      />

      {/* Message */}
      <div>
        <label className="block text-caption text-text-tertiary mb-1">Message</label>
        <textarea
          value={payload.content}
          onChange={(e) => update({ content: e.target.value })}
          disabled={disabled}
          rows={4}
          className="w-full bg-bg-primary/50 border border-border-glass rounded-md px-3 py-2 text-body-sm outline-none focus:border-nah-blue resize-y disabled:opacity-50"
        />
        <span className="text-caption text-text-tertiary">{payload.content.length}/160</span>
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
