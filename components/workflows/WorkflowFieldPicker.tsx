"use client";

import { useEffect, useMemo, useState } from "react";
import { Braces } from "lucide-react";
import { apiFetch } from "@/lib/auth/api-fetch";
import SearchableDropdown, { type DropdownOption } from "@/components/ui/SearchableDropdown";

interface WorkflowDataField {
  token: string;
  label: string;
  group: string;
  type: string;
}

interface WorkflowFieldPickerProps {
  onInsert: (token: string) => void;
  disabled?: boolean;
}

export default function WorkflowFieldPicker({ onInsert, disabled = false }: WorkflowFieldPickerProps) {
  const [fields, setFields] = useState<WorkflowDataField[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/workflows/data-fields")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load workflow fields"))))
      .then((data) => {
        if (!cancelled) setFields((data.fields ?? []) as WorkflowDataField[]);
      })
      .catch(() => {
        if (!cancelled) setFields([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo<DropdownOption[]>(
    () =>
      fields.map((field) => ({
        id: field.token,
        label: field.label,
        sublabel: `${field.group} · ${field.token}`,
      })),
    [fields]
  );

  return (
    <div className="mt-2 max-w-[260px]">
      <div className="flex items-center gap-1.5 text-caption text-text-tertiary mb-1">
        <Braces size={12} />
        <span>Insert data field</span>
      </div>
      <SearchableDropdown
        value={null}
        valueLabel={undefined}
        onChange={(option) => {
          if (option) onInsert(option.id);
        }}
        options={options}
        placeholder={fields.length > 0 ? "Choose field..." : "No fields loaded"}
        clearable={false}
        disabled={disabled || fields.length === 0}
      />
    </div>
  );
}
