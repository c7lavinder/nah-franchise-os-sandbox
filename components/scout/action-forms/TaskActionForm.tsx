"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/auth/api-fetch";
import SearchableDropdown, { type DropdownOption } from "@/components/ui/SearchableDropdown";
import type { DraftedTaskPayload } from "@/types/scout";

interface TaskActionFormProps {
  payload: DraftedTaskPayload;
  contactId: string;
  contactName: string;
  onChange: (payload: DraftedTaskPayload) => void;
  onContactChange?: (id: string, name: string) => void;
  disabled?: boolean;
}

export default function TaskActionForm({
  payload,
  contactId,
  contactName,
  onChange,
  onContactChange,
  disabled = false,
}: TaskActionFormProps) {
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
    return (data.contacts as { id: string; name: string }[]).map((c) => ({
      id: c.id,
      label: c.name,
    }));
  }, []);

  function update(patch: Partial<DraftedTaskPayload>) {
    onChange({ ...payload, ...patch });
  }

  const dueDateValue = payload.dueDate ? new Date(payload.dueDate).toISOString().split("T")[0] : "";

  return (
    <div className="space-y-3">
      {/* Title */}
      <div>
        <label className="block text-caption text-text-tertiary mb-1">Title</label>
        <input
          type="text"
          value={payload.title}
          onChange={(e) => update({ title: e.target.value })}
          disabled={disabled}
          className="w-full bg-bg-primary/50 border border-border-glass rounded-md px-3 py-2 text-body-sm outline-none focus:border-nah-blue disabled:opacity-50"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-caption text-text-tertiary mb-1">Description</label>
        <textarea
          value={payload.description ?? ""}
          onChange={(e) => update({ description: e.target.value || undefined })}
          disabled={disabled}
          rows={2}
          className="w-full bg-bg-primary/50 border border-border-glass rounded-md px-3 py-2 text-body-sm outline-none focus:border-nah-blue resize-y disabled:opacity-50"
        />
      </div>

      {/* Contact + Assigned To */}
      <div className="grid grid-cols-2 gap-3">
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

        <SearchableDropdown
          value={payload.assignedTo ?? null}
          valueLabel={payload.assignedToName}
          onChange={(opt) =>
            update({
              assignedTo: opt?.id ?? undefined,
              assignedToName: opt?.label ?? undefined,
            })
          }
          options={teamMembers}
          placeholder="Assign to..."
          label="Assigned To"
          disabled={disabled}
        />
      </div>

      {/* Due Date */}
      <div>
        <label className="block text-caption text-text-tertiary mb-1">Due Date</label>
        <input
          type="date"
          value={dueDateValue}
          onChange={(e) => {
            const d = e.target.value;
            update({ dueDate: d ? new Date(d + "T12:00:00").toISOString() : payload.dueDate });
          }}
          disabled={disabled}
          className="w-full bg-bg-primary/50 border border-border-glass rounded-md px-3 py-2 text-body-sm outline-none focus:border-nah-blue disabled:opacity-50"
        />
      </div>
    </div>
  );
}
