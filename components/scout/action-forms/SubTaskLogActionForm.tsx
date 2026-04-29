"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/auth/api-fetch";
import SearchableDropdown, { type DropdownOption } from "@/components/ui/SearchableDropdown";
import type { DraftedSubTaskLogPayload } from "@/types/scout";

type LogContentType = DraftedSubTaskLogPayload["contentType"];

interface SubTaskLogActionFormProps {
  payload: DraftedSubTaskLogPayload;
  contactName: string;
  onChange: (payload: DraftedSubTaskLogPayload) => void;
  disabled?: boolean;
}

const CONTENT_TYPE_OPTIONS: DropdownOption[] = [
  { id: "note", label: "Note" },
  { id: "file", label: "File" },
  { id: "link", label: "Link" },
  { id: "transcript", label: "Transcript" },
  { id: "appointment", label: "Appointment" },
  { id: "email", label: "Email" },
  { id: "sms", label: "SMS" },
  { id: "call", label: "Call" },
];

/** Content types that use a text input */
const TEXT_TYPES: LogContentType[] = ["note", "transcript", "email", "sms", "call", "appointment"];
/** Content types that use a URL input */
const URL_TYPES: LogContentType[] = ["file", "link"];

export default function SubTaskLogActionForm({
  payload,
  contactName,
  onChange,
  disabled = false,
}: SubTaskLogActionFormProps) {
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

  function update(patch: Partial<DraftedSubTaskLogPayload>) {
    onChange({ ...payload, ...patch });
  }

  const isTextType = TEXT_TYPES.includes(payload.contentType);
  const isUrlType = URL_TYPES.includes(payload.contentType);

  return (
    <div className="space-y-3">
      {/* Contact + Stage */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-caption text-text-tertiary mb-1">Contact</label>
          <div className="bg-bg-primary/50 border border-border-glass rounded-md px-3 py-2 text-body-sm text-text-primary truncate">
            {contactName}
          </div>
        </div>
        <div>
          <label className="block text-caption text-text-tertiary mb-1">Stage</label>
          <div className="bg-bg-primary/50 border border-border-glass rounded-md px-3 py-2 text-body-sm text-text-secondary">
            {payload.stageName ?? "Unknown"}
          </div>
        </div>
      </div>

      {/* Sub-Task name (read-only) */}
      <div>
        <label className="block text-caption text-text-tertiary mb-1">Sub-Task</label>
        <div className="bg-bg-primary/50 border border-border-glass rounded-md px-3 py-2 text-body-sm text-text-primary font-medium">
          {payload.subTaskName}
        </div>
      </div>

      {/* State Advance — only for two_state */}
      {payload.stateType === "two_state" && (
        <div>
          <label className="block text-caption text-text-tertiary mb-1">State</label>
          <div className="flex rounded-md overflow-hidden border border-border-glass">
            <button
              type="button"
              onClick={() => update({ stateAdvance: "first" })}
              disabled={disabled}
              className={`flex-1 py-2 text-body-sm font-medium transition-colors ${
                payload.stateAdvance === "first"
                  ? "bg-nah-blue text-white"
                  : "bg-bg-primary/50 text-text-secondary hover:bg-bg-hover"
              } disabled:opacity-50`}
            >
              {payload.firstStateLabel ?? "First"}
            </button>
            <button
              type="button"
              onClick={() => update({ stateAdvance: "second" })}
              disabled={disabled}
              className={`flex-1 py-2 text-body-sm font-medium transition-colors border-l border-border-glass ${
                payload.stateAdvance === "second"
                  ? "bg-nah-blue text-white"
                  : "bg-bg-primary/50 text-text-secondary hover:bg-bg-hover"
              } disabled:opacity-50`}
            >
              {payload.secondStateLabel ?? "Second"}
            </button>
          </div>
        </div>
      )}

      {/* Content Type + Logger — side by side */}
      <div className="grid grid-cols-2 gap-3">
        <SearchableDropdown
          value={payload.contentType}
          onChange={(opt) => opt && update({ contentType: opt.id as LogContentType })}
          options={CONTENT_TYPE_OPTIONS}
          placeholder="Content type..."
          label="Content Type"
          clearable={false}
          disabled={disabled}
        />

        <SearchableDropdown
          value={payload.loggerUserId ?? null}
          valueLabel={payload.loggerName}
          onChange={(opt) =>
            update({
              loggerUserId: opt?.id ?? undefined,
              loggerName: opt?.label ?? undefined,
            })
          }
          options={teamMembers}
          placeholder="Logger..."
          label="Logged By"
          disabled={disabled}
        />
      </div>

      {/* Content — text area for text types */}
      {isTextType && (
        <div>
          <label className="block text-caption text-text-tertiary mb-1">
            {payload.contentType === "note" ? "Note" : payload.contentType === "transcript" ? "Transcript" : "Content"}
          </label>
          <textarea
            value={payload.contentText ?? ""}
            onChange={(e) => update({ contentText: e.target.value || undefined })}
            disabled={disabled}
            rows={3}
            className="w-full bg-bg-primary/50 border border-border-glass rounded-md px-3 py-2 text-body-sm outline-none focus:border-nah-blue resize-y disabled:opacity-50"
          />
        </div>
      )}

      {/* Content — URL input for file/link types */}
      {isUrlType && (
        <div>
          <label className="block text-caption text-text-tertiary mb-1">
            {payload.contentType === "file" ? "File URL" : "Link URL"}
          </label>
          <input
            type="url"
            value={(payload.contentType === "file" ? payload.contentFileUrl : payload.contentLinkUrl) ?? ""}
            onChange={(e) => {
              const val = e.target.value || undefined;
              if (payload.contentType === "file") {
                update({ contentFileUrl: val });
              } else {
                update({ contentLinkUrl: val });
              }
            }}
            disabled={disabled}
            placeholder="https://..."
            className="w-full bg-bg-primary/50 border border-border-glass rounded-md px-3 py-2 text-body-sm outline-none focus:border-nah-blue disabled:opacity-50"
          />
        </div>
      )}
    </div>
  );
}
