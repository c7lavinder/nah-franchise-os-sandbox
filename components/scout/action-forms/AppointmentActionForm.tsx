"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/auth/api-fetch";
import SearchableDropdown, { type DropdownOption } from "@/components/ui/SearchableDropdown";
import type { DraftedAppointmentPayload } from "@/types/scout";

interface AppointmentActionFormProps {
  payload: DraftedAppointmentPayload;
  contactId: string;
  contactName: string;
  onChange: (payload: DraftedAppointmentPayload) => void;
  onContactChange?: (id: string, name: string) => void;
  disabled?: boolean;
}

function toDatetimeLocal(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AppointmentActionForm({
  payload,
  contactId,
  contactName,
  onChange,
  onContactChange,
  disabled = false,
}: AppointmentActionFormProps) {
  const [calendars, setCalendars] = useState<DropdownOption[]>([]);
  const [teamMembers, setTeamMembers] = useState<DropdownOption[]>([]);

  useEffect(() => {
    let cancelled = false;

    apiFetch("/api/ghl/calendars")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then((data) => {
        if (!cancelled) {
          setCalendars(
            ((data.calendars ?? []) as { id: string; name: string }[]).map((c) => ({
              id: c.id,
              label: c.name,
            }))
          );
        }
      })
      .catch(() => {
        if (!cancelled) setCalendars([]);
      });

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
    // GHL bookings require the GHL contact ID, not our internal Supabase UUID.
    // Skip contacts without a GHL link (rare — would mean an unsynced row).
    return (data.contacts as { id: string; ghl_contact_id: string | null; name: string }[])
      .filter((c) => !!c.ghl_contact_id)
      .map((c) => ({ id: c.ghl_contact_id as string, label: c.name }));
  }, []);

  function update(patch: Partial<DraftedAppointmentPayload>) {
    onChange({ ...payload, ...patch });
  }

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

      {/* Contact + Calendar */}
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
          value={payload.calendarId}
          valueLabel={payload.calendarName}
          onChange={(opt) =>
            opt && update({ calendarId: opt.id, calendarName: opt.label, calendarReason: "selected by user" })
          }
          options={calendars}
          placeholder="Select calendar..."
          label="Calendar"
          clearable={false}
          disabled={disabled}
        />
      </div>

      {/* Start + End */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-caption text-text-tertiary mb-1">Start</label>
          <input
            type="datetime-local"
            value={toDatetimeLocal(payload.startTime)}
            onChange={(e) => update({ startTime: new Date(e.target.value).toISOString() })}
            disabled={disabled}
            className="w-full bg-bg-primary/50 border border-border-glass rounded-md px-3 py-2 text-body-sm outline-none focus:border-nah-blue disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-caption text-text-tertiary mb-1">End</label>
          <input
            type="datetime-local"
            value={toDatetimeLocal(payload.endTime)}
            onChange={(e) => update({ endTime: new Date(e.target.value).toISOString() })}
            disabled={disabled}
            className="w-full bg-bg-primary/50 border border-border-glass rounded-md px-3 py-2 text-body-sm outline-none focus:border-nah-blue disabled:opacity-50"
          />
        </div>
      </div>

      {/* Assigned To */}
      <SearchableDropdown
        value={payload.assignedUserId ?? null}
        onChange={(opt) => update({ assignedUserId: opt?.id ?? undefined })}
        options={teamMembers}
        placeholder="Assign host..."
        label="Assigned To"
        disabled={disabled}
      />
    </div>
  );
}
