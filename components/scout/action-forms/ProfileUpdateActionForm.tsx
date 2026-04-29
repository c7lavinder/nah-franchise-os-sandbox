"use client";

import { useCallback } from "react";
import { apiFetch } from "@/lib/auth/api-fetch";
import SearchableDropdown, { type DropdownOption } from "@/components/ui/SearchableDropdown";
import type { DraftedProfileUpdatePayload } from "@/types/scout";

interface ProfileUpdateActionFormProps {
  payload: DraftedProfileUpdatePayload;
  contactId: string;
  contactName: string;
  onChange: (payload: DraftedProfileUpdatePayload) => void;
  onContactChange?: (id: string, name: string) => void;
  disabled?: boolean;
}

export default function ProfileUpdateActionForm({
  payload,
  contactId,
  contactName,
  onChange,
  onContactChange,
  disabled = false,
}: ProfileUpdateActionFormProps) {
  const searchContacts = useCallback(async (query: string): Promise<DropdownOption[]> => {
    const res = await apiFetch(`/api/contacts/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.contacts as { id: string; name: string }[]).map((c) => ({
      id: c.id,
      label: c.name,
    }));
  }, []);

  function updateField(index: number, value: string) {
    const updated = [...payload.fields];
    updated[index] = { ...updated[index], value };
    onChange({ ...payload, fields: updated });
  }

  function removeField(index: number) {
    const updated = payload.fields.filter((_, i) => i !== index);
    onChange({ ...payload, fields: updated });
  }

  function addField() {
    onChange({
      ...payload,
      fields: [...payload.fields, { fieldName: "", value: "", reason: "Added by user" }],
    });
  }

  function updateFieldName(index: number, fieldName: string) {
    const updated = [...payload.fields];
    updated[index] = { ...updated[index], fieldName };
    onChange({ ...payload, fields: updated });
  }

  return (
    <div className="space-y-3">
      {/* Entity (contact or territory — searchable) */}
      <SearchableDropdown
        value={contactId}
        valueLabel={contactName}
        onChange={(opt) => {
          if (opt && onContactChange) onContactChange(opt.id, opt.label);
        }}
        onSearch={searchContacts}
        placeholder="Search contact or territory..."
        label="Entity"
        clearable={false}
        disabled={disabled}
      />

      {/* Fields — each shows field name (editable) + current → new */}
      {payload.fields.map((field, idx) => (
        <div key={idx} className="border border-border-glass rounded-md p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={field.fieldName}
              onChange={(e) => updateFieldName(idx, e.target.value)}
              disabled={disabled}
              placeholder="Field name..."
              className="flex-1 bg-bg-primary/50 border border-border-glass rounded-md px-2 py-1 text-body-sm font-medium outline-none focus:border-nah-blue disabled:opacity-50"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => removeField(idx)}
                className="text-text-tertiary hover:text-danger text-caption"
              >
                Remove
              </button>
            )}
          </div>

          {/* New value */}
          <div>
            <label className="block text-caption text-text-tertiary mb-0.5">New Value</label>
            <input
              type="text"
              value={field.value}
              onChange={(e) => updateField(idx, e.target.value)}
              disabled={disabled}
              placeholder="Enter new value..."
              className="w-full bg-bg-primary/50 border border-border-glass rounded-md px-2 py-1.5 text-body-sm outline-none focus:border-nah-blue disabled:opacity-50"
            />
          </div>

          {field.reason && <p className="text-caption text-text-tertiary">{field.reason}</p>}
        </div>
      ))}

      {/* Add field button */}
      {!disabled && (
        <button
          type="button"
          onClick={addField}
          className="text-body-sm text-nah-blue hover:text-nah-blue-hover font-medium"
        >
          + Add field
        </button>
      )}
    </div>
  );
}
