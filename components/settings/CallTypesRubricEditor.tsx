"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * CallTypesRubricEditor — admin UI for managing call types and their rubric criteria.
 */

import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, Trash2, ChevronRight, ChevronDown, GripVertical } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import ConfirmModal from "@/components/ui/ConfirmModal";
import PromptModal from "@/components/ui/PromptModal";

interface Criterion {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  sort_order: number;
}

interface CallType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export default function CallTypesRubricEditor() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === "leadership" || user?.role === "admin";
  const [callTypes, setCallTypes] = useState<CallType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loadingCriteria, setLoadingCriteria] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [promptModal, setPromptModal] = useState<{ title: string; placeholder: string; onSubmit: (v: string) => void } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ title: string; body: string; onConfirm: () => void } | null>(null);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const bodyUserId = { userId: user?.id };

  const fetchCallTypes = useCallback(async () => {
    const res = await apiFetch("/api/settings/call-types");
    if (res.ok) {
      const data = await res.json();
      setCallTypes(data.callTypes ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchCallTypes(); }, [fetchCallTypes]);

  async function fetchCriteria(callTypeId: string) {
    setLoadingCriteria(true);
    const res = await apiFetch(`/api/settings/call-types/${callTypeId}/rubric`);
    if (res.ok) {
      const data = await res.json();
      setCriteria(data.criteria ?? []);
    }
    setLoadingCriteria(false);
  }

  function handleSelect(id: string) {
    if (selectedId === id) { setSelectedId(null); return; }
    setSelectedId(id);
    void fetchCriteria(id);
  }

  async function apiCall(url: string, method: string, body?: Record<string, unknown>): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(url, { method, headers, body: JSON.stringify({ ...body, ...bodyUserId }) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? `Failed (${res.status})`);
        return false;
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function handleAddCallType() {
    setPromptModal({
      title: "New call type name",
      placeholder: "e.g., Discovery Call",
      onSubmit: async (name) => {
        setPromptModal(null);
        if (await apiCall("/api/settings/call-types", "POST", { name })) await fetchCallTypes();
      },
    });
  }

  function handleDeleteCallType(id: string) {
    setConfirmModal({
      title: "Delete call type",
      body: "Delete this call type and its rubric?",
      onConfirm: async () => {
        setConfirmModal(null);
        if (await apiCall(`/api/settings/call-types/${id}`, "DELETE")) {
          if (selectedId === id) setSelectedId(null);
          await fetchCallTypes();
        }
      },
    });
  }

  function handleAddCriterion() {
    if (!selectedId) return;
    const ctId = selectedId;
    setPromptModal({
      title: "New criterion name",
      placeholder: "e.g., Rapport, Discovery, Objection Handling",
      onSubmit: async (name) => {
        setPromptModal(null);
        const res = await apiFetch(`/api/settings/call-types/${ctId}/rubric`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.rubric?.id) { setError("No rubric found"); return; }
        if (await apiCall(`/api/settings/rubrics/${data.rubric.id}/criteria`, "POST", { name })) {
          await fetchCriteria(ctId);
        }
      },
    });
  }

  function handleDeleteCriterion(criterionId: string) {
    setConfirmModal({
      title: "Delete criterion",
      body: "Delete this rubric criterion?",
      onConfirm: async () => {
        setConfirmModal(null);
        if (await apiCall(`/api/settings/rubric-criteria/${criterionId}`, "DELETE")) {
          if (selectedId) await fetchCriteria(selectedId);
        }
      },
    });
  }

  async function handleUpdateWeight(criterionId: string, weight: number) {
    if (await apiCall(`/api/settings/rubric-criteria/${criterionId}`, "PATCH", { weight })) {
      if (selectedId) await fetchCriteria(selectedId);
    }
  }

  async function handleCriterionDrop(e: React.DragEvent, targetIdx: number, dragId: string) {
    e.preventDefault();
    if (!selectedId) return;
    const items = [...criteria];
    const fromIdx = items.findIndex((c) => c.id === dragId);
    if (fromIdx === -1 || fromIdx === targetIdx) return;
    const [moved] = items.splice(fromIdx, 1);
    items.splice(targetIdx, 0, moved);

    const res = await apiFetch(`/api/settings/call-types/${selectedId}/rubric`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.rubric?.id) return;

    if (await apiCall(`/api/settings/rubrics/${data.rubric.id}/criteria/reorder`, "POST", {
      criterionIds: items.map((c) => c.id),
    })) {
      await fetchCriteria(selectedId);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-text-tertiary" /></div>;
  }

  return (
    <div>
      {error && <div className="mb-4 px-3 py-2 bg-danger/10 border border-danger/20 rounded-lg text-body-sm text-danger">{error}</div>}

      <div className="space-y-2">
        {callTypes.map((ct) => {
          const isSelected = selectedId === ct.id;
          return (
            <div key={ct.id} className="border border-border-default rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-bg-secondary">
                <button onClick={() => handleSelect(ct.id)}>
                  {isSelected ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <span className="text-body-sm font-medium text-text-primary flex-1">{ct.name}</span>
                <span className="text-[10px] text-text-tertiary">{ct.slug}</span>
                {isAdmin && (
                  <button onClick={() => void handleDeleteCallType(ct.id)}
                    className="p-1 rounded hover:bg-danger/10 text-text-tertiary hover:text-danger">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              {isSelected && (
                <div className="px-3 py-3">
                  {loadingCriteria ? (
                    <Loader2 size={14} className="animate-spin text-text-tertiary" />
                  ) : criteria.length === 0 ? (
                    <p className="text-caption text-text-tertiary italic">No criteria defined — add criteria to enable rubric-based grading</p>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[10px] text-text-tertiary px-2 mb-1">
                        <span className="flex-1">Criterion</span>
                        <span className="w-16 text-center">Weight</span>
                        <span className="w-6" />
                      </div>
                      {criteria.map((c, idx) => (
                        <CriterionRow
                          key={c.id}
                          criterion={c}
                          isAdmin={isAdmin}
                          onWeightChange={(w) => void handleUpdateWeight(c.id, w)}
                          onDelete={() => void handleDeleteCriterion(c.id)}
                          onDrop={(e) => void handleCriterionDrop(e, idx, c.id)}
                        />
                      ))}
                    </div>
                  )}
                  {isAdmin && (
                    <button onClick={() => void handleAddCriterion()}
                      className="flex items-center gap-1 text-caption text-nah-blue hover:underline mt-2">
                      <Plus size={11} /> Add criterion
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isAdmin && (
        <button onClick={() => void handleAddCallType()} disabled={saving}
          className="flex items-center gap-1 text-body-sm text-nah-blue hover:underline mt-3">
          <Plus size={14} /> Add call type
        </button>
      )}

      {saving && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 px-3 py-2 bg-bg-tertiary border border-border-default rounded-lg shadow-lg text-caption text-text-secondary">
          <Loader2 size={12} className="animate-spin" /> Saving...
        </div>
      )}

      {promptModal && (
        <PromptModal title={promptModal.title} placeholder={promptModal.placeholder} submitLabel="Add" onSubmit={promptModal.onSubmit} onCancel={() => setPromptModal(null)} />
      )}
      {confirmModal && (
        <ConfirmModal title={confirmModal.title} body={confirmModal.body} destructive confirmLabel="Delete" onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(null)} />
      )}
    </div>
  );
}

function CriterionRow({ criterion, isAdmin, onWeightChange, onDelete, onDrop }: {
  criterion: Criterion;
  isAdmin: boolean;
  onWeightChange: (w: number) => void;
  onDelete: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const [dragId] = useState(criterion.id);

  return (
    <div
      draggable={isAdmin}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", dragId)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-bg-hover group"
    >
      {isAdmin && <GripVertical size={12} className="text-text-tertiary cursor-grab opacity-0 group-hover:opacity-100" />}
      <span className="text-caption text-text-primary flex-1">{criterion.name}</span>
      <input
        type="number"
        min={0}
        max={2}
        step={0.1}
        value={criterion.weight}
        onChange={(e) => onWeightChange(parseFloat(e.target.value) || 1)}
        disabled={!isAdmin}
        className="w-16 text-center bg-bg-secondary border border-border-default rounded px-1 py-0.5 text-[11px] text-text-primary disabled:opacity-50"
      />
      {isAdmin && (
        <button onClick={onDelete}
          className="p-0.5 rounded hover:bg-danger/10 text-text-tertiary hover:text-danger opacity-0 group-hover:opacity-100">
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}
