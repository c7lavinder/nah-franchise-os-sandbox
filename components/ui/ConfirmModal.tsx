"use client";

import { X, AlertTriangle } from "lucide-react";
import { useScrollLock } from "@/lib/hooks/useScrollLock";

interface ConfirmModalProps {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useScrollLock(true);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-bg-tertiary border border-border-default rounded-lg w-full max-w-sm mx-4 p-5">
        <div className="flex items-center gap-2 mb-3">
          {destructive && <AlertTriangle size={16} className="text-danger" />}
          <h2 className="text-h2 text-text-primary">{title}</h2>
          <button onClick={onCancel} className="btn-ghost p-1 ml-auto">
            <X size={16} />
          </button>
        </div>
        <p className="text-body-sm text-text-secondary mb-4">{body}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn-ghost px-4 py-2 text-body-sm">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-md text-body-sm font-medium ${
              destructive ? "bg-danger text-white hover:bg-danger/90" : "bg-nah-blue text-white hover:bg-nah-blue/90"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
