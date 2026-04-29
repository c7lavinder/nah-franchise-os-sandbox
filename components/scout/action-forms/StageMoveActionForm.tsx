"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/auth/api-fetch";
import SearchableDropdown, { type DropdownOption } from "@/components/ui/SearchableDropdown";
import type { DraftedStageMovePayload } from "@/types/scout";

interface PipelineData {
  id: string;
  name: string;
  slug: string;
  stages: { id: string; name: string; slug: string; sortOrder: number }[];
}

interface StageMoveActionFormProps {
  payload: DraftedStageMovePayload;
  contactId: string;
  contactName: string;
  onChange: (payload: DraftedStageMovePayload) => void;
  onContactChange?: (id: string, name: string) => void;
  disabled?: boolean;
}

export default function StageMoveActionForm({
  payload,
  contactId,
  contactName,
  onChange,
  onContactChange,
  disabled = false,
}: StageMoveActionFormProps) {
  const [pipelines, setPipelines] = useState<PipelineData[]>([]);

  // Fetch all pipelines + stages
  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/pipelines/stages")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then((data) => {
        if (!cancelled) setPipelines(data.pipelines as PipelineData[]);
      })
      .catch(() => {
        if (!cancelled) setPipelines([]);
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

  function update(patch: Partial<DraftedStageMovePayload>) {
    onChange({ ...payload, ...patch });
  }

  // Pipeline options
  const pipelineOptions: DropdownOption[] = pipelines.map((p) => ({
    id: p.id,
    label: p.name,
  }));

  // Current pipeline options (what they're currently in)
  const currentPipelineOptions: DropdownOption[] = pipelines.map((p) => ({
    id: p.id,
    label: p.name,
  }));
  const currentPipeline = pipelines.find((p) => p.id === payload.currentPipelineId);
  const currentStageOptions: DropdownOption[] = (currentPipeline?.stages ?? []).map((s) => ({
    id: s.name,
    label: s.name,
  }));

  // Target pipeline + stages
  const selectedPipelineId = payload.newPipelineId ?? payload.currentPipelineId;
  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);
  const stageOptions: DropdownOption[] = (selectedPipeline?.stages ?? []).map((s) => ({
    id: s.name,
    label: s.name,
  }));

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

      {/* Current pipeline + stage */}
      <div className="grid grid-cols-2 gap-3">
        <SearchableDropdown
          value={payload.currentPipelineId ?? null}
          valueLabel={payload.currentPipeline}
          onChange={(opt) => {
            if (opt) {
              const pl = pipelines.find((p) => p.id === opt.id);
              update({
                currentPipelineId: opt.id,
                currentPipeline: opt.label,
                currentStage: pl?.stages[0]?.name ?? payload.currentStage,
              });
            }
          }}
          options={currentPipelineOptions}
          placeholder="Current pipeline..."
          label="Current Pipeline"
          clearable={false}
          disabled={disabled}
        />

        <SearchableDropdown
          value={payload.currentStage}
          onChange={(opt) => opt && update({ currentStage: opt.id })}
          options={currentStageOptions}
          placeholder="Current stage..."
          label="Current Stage"
          clearable={false}
          disabled={disabled}
        />
      </div>

      {/* Target pipeline + stage */}
      <div className="grid grid-cols-2 gap-3">
        <SearchableDropdown
          value={payload.newPipelineId ?? payload.currentPipelineId ?? null}
          valueLabel={payload.newPipeline ?? payload.currentPipeline}
          onChange={(opt) => {
            if (opt) {
              const pl = pipelines.find((p) => p.id === opt.id);
              update({
                newPipelineId: opt.id,
                newPipeline: opt.label,
                newStage: pl?.stages[0]?.name ?? payload.newStage,
              });
            }
          }}
          options={pipelineOptions}
          placeholder="Target pipeline..."
          label="Move To Pipeline"
          clearable={false}
          disabled={disabled}
        />

        <SearchableDropdown
          value={payload.newStage}
          onChange={(opt) => opt && update({ newStage: opt.id })}
          options={stageOptions}
          placeholder="Target stage..."
          label="Move To Stage"
          clearable={false}
          disabled={disabled}
        />
      </div>

      {/* Reason */}
      <div>
        <label className="block text-caption text-text-tertiary mb-1">Reason</label>
        <input
          type="text"
          value={payload.reason ?? ""}
          onChange={(e) => update({ reason: e.target.value || undefined })}
          disabled={disabled}
          placeholder="Why is this contact moving?"
          className="w-full bg-bg-primary/50 border border-border-glass rounded-md px-3 py-2 text-body-sm outline-none focus:border-nah-blue disabled:opacity-50"
        />
      </div>
    </div>
  );
}
