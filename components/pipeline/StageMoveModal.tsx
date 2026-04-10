"use client";

import { useState } from "react";
import { ArrowRight, X, Loader2 } from "lucide-react";

interface StageMoveModalProps {
  leadName: string;
  fromStage: string;
  toStage: string;
  onConfirm: (reason?: string) => Promise<void>;
  onCancel: () => void;
}

export default function StageMoveModal({
  leadName,
  fromStage,
  toStage,
  onConfirm,
  onCancel,
}: StageMoveModalProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      await onConfirm(reason || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move prospect");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-bg-tertiary border border-border-default rounded-lg w-full max-w-md mx-4 p-5">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 text-text-tertiary hover:text-text-primary"
        >
          <X size={18} />
        </button>

        {/* Title */}
        <h2 className="text-h2 text-text-primary mb-4">Confirm Stage Move</h2>

        {/* Move details */}
        <div className="flex items-center gap-2 mb-4 text-body text-text-secondary">
          <span className="font-medium text-text-primary">{leadName}</span>
        </div>
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-bg-secondary rounded-md">
          <span className="text-body-sm text-text-secondary">{fromStage}</span>
          <ArrowRight size={14} className="text-nah-orange flex-shrink-0" />
          <span className="text-body-sm text-text-primary font-medium">{toStage}</span>
        </div>

        {/* Optional reason */}
        <label className="block mb-1 text-caption text-text-tertiary">
          Reason (optional)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Add a note about this move..."
          className="w-full bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-nah-orange focus:outline-none resize-none"
          rows={2}
          disabled={loading}
        />

        {/* Error */}
        {error && (
          <p className="mt-2 text-body-sm text-danger">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={onCancel}
            className="btn-ghost px-4 py-2 text-body-sm"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="btn-primary px-4 py-2 text-body-sm flex items-center gap-2 ml-auto"
            disabled={loading}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Confirm Move
          </button>
        </div>
      </div>
    </div>
  );
}
