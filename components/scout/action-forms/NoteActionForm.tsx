"use client";

import { useCallback } from "react";
import { apiFetch } from "@/lib/auth/api-fetch";
import SearchableDropdown, { type DropdownOption } from "@/components/ui/SearchableDropdown";
import type { DraftedNotePayload } from "@/types/scout";

interface NoteActionFormProps {
  payload: DraftedNotePayload;
  contactId: string;
  contactName: string;
  onChange: (payload: DraftedNotePayload) => void;
  onContactChange?: (id: string, name: string) => void;
  disabled?: boolean;
}

export default function NoteActionForm({
  payload,
  contactId,
  contactName,
  onChange,
  onContactChange,
  disabled = false,
}: NoteActionFormProps) {
  const searchContacts = useCallback(async (query: string): Promise<DropdownOption[]> => {
    const res = await apiFetch(`/api/contacts/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    // GHL note APIs require the GHL contact ID, not our internal Supabase UUID.
    return (data.contacts as { id: string; ghl_contact_id: string | null; name: string }[])
      .filter((c) => !!c.ghl_contact_id)
      .map((c) => ({ id: c.ghl_contact_id as string, label: c.name }));
  }, []);

  return (
    <div className="space-y-3">
      {/* Contact */}
      <SearchableDropdown
        value={contactId}
        valueLabel={contactName}
        onChange={(opt) => {
          if (opt && onContactChange) onContactChange(opt.id, opt.label);
        }}
        onSearch={searchContacts}
        placeholder="Search contact..."
        label="Contact"
        clearable={false}
        disabled={disabled}
      />

      {/* Note body */}
      <div>
        <label className="block text-caption text-text-tertiary mb-1">Note</label>
        <textarea
          value={payload.body}
          onChange={(e) => onChange({ ...payload, body: e.target.value })}
          disabled={disabled}
          rows={4}
          className="w-full bg-bg-primary/50 border border-border-glass rounded-md px-3 py-2 text-body-sm outline-none focus:border-nah-blue resize-y disabled:opacity-50"
        />
      </div>
    </div>
  );
}
