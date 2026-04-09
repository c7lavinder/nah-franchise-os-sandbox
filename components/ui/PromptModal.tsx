"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface PromptModalProps {
  title: string;
  placeholder?: string;
  submitLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export default function PromptModal({ title, placeholder = "", submitLabel = "Submit", onSubmit, onCancel }: PromptModalProps) {
  const [value, setValue] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-bg-tertiary border border-border-default rounded-lg w-full max-w-sm mx-4 p-5">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-h2 text-text-primary">{title}</h2>
          <button onClick={onCancel} className="btn-ghost p-1 ml-auto"><X size={16} /></button>
        </div>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary mb-4"
          onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onSubmit(value.trim()); }}
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn-ghost px-4 py-2 text-body-sm">Cancel</button>
          <button onClick={() => value.trim() && onSubmit(value.trim())} disabled={!value.trim()}
            className="btn-primary px-4 py-2 text-body-sm">{submitLabel}</button>
        </div>
      </div>
    </div>
  );
}
