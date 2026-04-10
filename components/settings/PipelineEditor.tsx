"use client";

/**
 * PipelineEditor — admin-only visual editor for pipeline templates.
 * Shows pipelines → stages → sub-tasks with inline editing, reorder, add/delete.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, ChevronRight, ChevronDown, Plus, Trash2, GripVertical,
  GitBranch, Zap, Check, X, AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import ConfirmModal from "@/components/ui/ConfirmModal";
import PromptModal from "@/components/ui/PromptModal";

interface SubTask {
  id: string;
  name: string;
  sort_order: number;
  state_type: string;
  first_state_label: string | null;
  second_state_label: string | null;
  is_required: boolean;
}

interface Stage {
  id: string;
  name: string;
  sort_order: number;
  is_terminal: boolean;
  auto_advance_enabled: boolean;
  subTasks: SubTask[];
}

interface Pipeline {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  stages: Stage[];
}

export default function PipelineEditor() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === "leadership" || user?.role === "admin";
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [editingName, setEditingName] = useState<{ type: string; id: string; value: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Modal state
  const [promptModal, setPromptModal] = useState<{ title: string; placeholder: string; onSubmit: (v: string) => void } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ title: string; body: string; onConfirm: () => void } | null>(null);

  // Drag state
  const [dragType, setDragType] = useState<"stage" | "subtask" | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const bodyUserId = { userId: user?.id };

  const fetchPipelines = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/settings/pipelines");
      if (res.ok) {
        const data = await res.json();
        setPipelines(data.pipelines ?? []);
        if (!selectedPipelineId && data.pipelines?.length > 0) {
          setSelectedPipelineId(data.pipelines[0].id);
        }
      } else {
        setError("Failed to load pipelines");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pipelines");
    }
    setLoading(false);
  }, [selectedPipelineId]);

  useEffect(() => { void fetchPipelines(); }, [fetchPipelines]);

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);

  async function apiCall(url: string, method: string, body?: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({ ...body, ...bodyUserId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed (${res.status})`);
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

  // ─── Stage actions ───

  function handleAddStage() {
    if (!selectedPipeline) return;
    setPromptModal({
      title: "New stage name",
      placeholder: "e.g., Discovery",
      onSubmit: async (name) => {
        setPromptModal(null);
        if (await apiCall(`/api/settings/pipelines/${selectedPipeline.id}/stages`, "POST", { name })) {
          await fetchPipelines();
        }
      },
    });
  }

  function handleDeleteStage(stageId: string) {
    if (!selectedPipeline) return;
    setConfirmModal({
      title: "Delete stage",
      body: "Delete this stage? This cannot be undone.",
      onConfirm: async () => {
        setConfirmModal(null);
        if (await apiCall(`/api/settings/pipelines/${selectedPipeline.id}/stages/${stageId}`, "DELETE")) {
          await fetchPipelines();
        }
      },
    });
  }

  async function handleToggleAutoAdvance(stageId: string, current: boolean) {
    if (!selectedPipeline) return;
    if (await apiCall(`/api/settings/pipelines/${selectedPipeline.id}/stages/${stageId}/auto-advance`, "POST", { enabled: !current })) {
      await fetchPipelines();
    }
  }

  async function handleStageDrop(e: React.DragEvent, targetIdx: number) {
    e.preventDefault();
    if (dragType !== "stage" || !dragId || !selectedPipeline) return;
    const stages = [...selectedPipeline.stages];
    const fromIdx = stages.findIndex((s) => s.id === dragId);
    if (fromIdx === -1 || fromIdx === targetIdx) return;
    const [moved] = stages.splice(fromIdx, 1);
    stages.splice(targetIdx, 0, moved);
    if (await apiCall(`/api/settings/pipelines/${selectedPipeline.id}/stages/reorder`, "POST", { stageIds: stages.map((s) => s.id) })) {
      await fetchPipelines();
    }
    setDragType(null);
    setDragId(null);
  }

  // ─── Sub-task actions ───

  function handleAddSubTask(stageId: string) {
    setPromptModal({
      title: "New sub-task name",
      placeholder: "e.g., NDA Signed",
      onSubmit: async (name) => {
        setPromptModal(null);
        if (await apiCall(`/api/settings/stages/${stageId}/sub-tasks`, "POST", { name })) {
          await fetchPipelines();
        }
      },
    });
  }

  function handleDeleteSubTask(subTaskId: string) {
    setConfirmModal({
      title: "Delete sub-task",
      body: "Delete this sub-task?",
      onConfirm: async () => {
        setConfirmModal(null);
        if (await apiCall(`/api/settings/sub-tasks/${subTaskId}`, "DELETE")) {
          await fetchPipelines();
        }
      },
    });
  }

  async function handleSubTaskDrop(e: React.DragEvent, stageId: string, targetIdx: number) {
    e.preventDefault();
    if (dragType !== "subtask" || !dragId || !selectedPipeline) return;
    const stage = selectedPipeline.stages.find((s) => s.id === stageId);
    if (!stage) return;
    const tasks = [...stage.subTasks];
    const fromIdx = tasks.findIndex((t) => t.id === dragId);
    if (fromIdx === -1 || fromIdx === targetIdx) return;
    const [moved] = tasks.splice(fromIdx, 1);
    tasks.splice(targetIdx, 0, moved);
    if (await apiCall(`/api/settings/stages/${stageId}/sub-tasks/reorder`, "POST", { subTaskIds: tasks.map((t) => t.id) })) {
      await fetchPipelines();
    }
    setDragType(null);
    setDragId(null);
  }

  // ─── Inline name edit ───

  async function handleNameSave() {
    if (!editingName) return;
    const { type, id, value } = editingName;
    if (!value.trim()) { setEditingName(null); return; }

    let url = "";
    if (type === "pipeline") url = `/api/settings/pipelines/${id}`;
    else if (type === "stage" && selectedPipeline) url = `/api/settings/pipelines/${selectedPipeline.id}/stages/${id}`;
    else if (type === "subtask") url = `/api/settings/sub-tasks/${id}`;

    if (url && await apiCall(url, "PATCH", { name: value.trim() })) {
      await fetchPipelines();
    }
    setEditingName(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div>
      {!isAdmin && (
        <div className="mb-4 px-3 py-2 bg-warning/10 border border-warning/20 rounded-lg flex items-center gap-2">
          <AlertTriangle size={14} className="text-warning" />
          <span className="text-body-sm text-warning font-medium">Admin access required to edit pipeline templates</span>
        </div>
      )}

      {error && (
        <div className="mb-4 px-3 py-2 bg-danger/10 border border-danger/20 rounded-lg text-body-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex gap-4">
        {/* Pipeline sidebar */}
        <div className="w-48 flex-shrink-0 space-y-1">
          {pipelines.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPipelineId(p.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-body-sm transition-colors ${
                p.id === selectedPipelineId
                  ? "bg-nah-blue/10 text-nah-blue font-medium"
                  : "text-text-secondary hover:bg-bg-hover"
              }`}
            >
              <div className="flex items-center gap-2">
                <GitBranch size={14} />
                {editingName?.type === "pipeline" && editingName.id === p.id ? (
                  <input
                    autoFocus
                    value={editingName.value}
                    onChange={(e) => setEditingName({ ...editingName, value: e.target.value })}
                    onBlur={() => void handleNameSave()}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleNameSave(); if (e.key === "Escape") setEditingName(null); }}
                    className="bg-transparent border-b border-nah-blue text-body-sm outline-none w-full"
                    disabled={!isAdmin}
                  />
                ) : (
                  <span
                    onDoubleClick={() => isAdmin && setEditingName({ type: "pipeline", id: p.id, value: p.name })}
                    title={isAdmin ? "Double-click to rename" : undefined}
                  >
                    {p.name}
                  </span>
                )}
              </div>
              {!p.is_active && <span className="text-[10px] text-text-tertiary">(inactive)</span>}
            </button>
          ))}
        </div>

        {/* Stages area */}
        <div className="flex-1 min-w-0">
          {!selectedPipeline ? (
            <p className="text-body-sm text-text-tertiary py-8 text-center">Select a pipeline</p>
          ) : (
            <div className="space-y-2">
              {selectedPipeline.stages.map((stage, stageIdx) => {
                const isExpanded = expandedStages.has(stage.id);
                return (
                  <div
                    key={stage.id}
                    draggable={isAdmin}
                    onDragStart={() => { setDragType("stage"); setDragId(stage.id); }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => void handleStageDrop(e, stageIdx)}
                    className="border border-border-default rounded-lg overflow-hidden"
                  >
                    {/* Stage header */}
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-bg-secondary">
                      {isAdmin && <GripVertical size={14} className="text-text-tertiary cursor-grab flex-shrink-0" />}
                      <button onClick={() => {
                        const next = new Set(expandedStages);
                        isExpanded ? next.delete(stage.id) : next.add(stage.id);
                        setExpandedStages(next);
                      }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>

                      {editingName?.type === "stage" && editingName.id === stage.id ? (
                        <input
                          autoFocus
                          value={editingName.value}
                          onChange={(e) => setEditingName({ ...editingName, value: e.target.value })}
                          onBlur={() => void handleNameSave()}
                          onKeyDown={(e) => { if (e.key === "Enter") void handleNameSave(); if (e.key === "Escape") setEditingName(null); }}
                          className="bg-transparent border-b border-nah-blue text-body-sm font-medium outline-none flex-1"
                          disabled={!isAdmin}
                        />
                      ) : (
                        <span
                          className="text-body-sm font-medium text-text-primary flex-1"
                          onDoubleClick={() => isAdmin && setEditingName({ type: "stage", id: stage.id, value: stage.name })}
                          title={isAdmin ? "Double-click to rename" : undefined}
                        >
                          {stage.name}
                        </span>
                      )}

                      <span className="text-[10px] text-text-tertiary">{stage.subTasks.length} tasks</span>

                      {stage.is_terminal && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-text-tertiary/10 text-text-tertiary">Terminal</span>
                      )}

                      {/* Auto-advance toggle */}
                      <button
                        onClick={() => isAdmin && void handleToggleAutoAdvance(stage.id, stage.auto_advance_enabled)}
                        disabled={!isAdmin}
                        className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                          stage.auto_advance_enabled
                            ? "bg-success/10 text-success"
                            : "bg-bg-hover text-text-tertiary"
                        }`}
                        title="Auto-advance when all required sub-tasks complete"
                      >
                        <Zap size={10} />
                        Auto
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => void handleDeleteStage(stage.id)}
                          className="p-1 rounded hover:bg-danger/10 text-text-tertiary hover:text-danger"
                          title="Delete stage"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>

                    {/* Sub-tasks */}
                    {isExpanded && (
                      <div className="px-3 py-2 space-y-1">
                        {stage.subTasks.length === 0 && (
                          <p className="text-caption text-text-tertiary italic py-1">No sub-tasks</p>
                        )}
                        {stage.subTasks.map((task, taskIdx) => (
                          <div
                            key={task.id}
                            draggable={isAdmin}
                            onDragStart={(e) => { e.stopPropagation(); setDragType("subtask"); setDragId(task.id); }}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={(e) => { e.stopPropagation(); void handleSubTaskDrop(e, stage.id, taskIdx); }}
                            className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-bg-hover group"
                          >
                            {isAdmin && <GripVertical size={12} className="text-text-tertiary cursor-grab opacity-0 group-hover:opacity-100" />}
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${task.is_required ? "bg-nah-orange" : "bg-text-tertiary/30"}`} />

                            {editingName?.type === "subtask" && editingName.id === task.id ? (
                              <input
                                autoFocus
                                value={editingName.value}
                                onChange={(e) => setEditingName({ ...editingName, value: e.target.value })}
                                onBlur={() => void handleNameSave()}
                                onKeyDown={(e) => { if (e.key === "Enter") void handleNameSave(); if (e.key === "Escape") setEditingName(null); }}
                                className="bg-transparent border-b border-nah-blue text-caption outline-none flex-1"
                                disabled={!isAdmin}
                              />
                            ) : (
                              <span
                                className="text-caption text-text-primary flex-1"
                                onDoubleClick={() => isAdmin && setEditingName({ type: "subtask", id: task.id, value: task.name })}
                                title={isAdmin ? "Double-click to rename" : undefined}
                              >
                                {task.name}
                              </span>
                            )}

                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              task.state_type === "two_state" ? "bg-info/10 text-info" : "bg-text-tertiary/10 text-text-tertiary"
                            }`}>
                              {task.state_type === "two_state" ? "2-state" : "single"}
                            </span>

                            {task.is_required && (
                              <span className="text-[10px] text-nah-orange">req</span>
                            )}

                            {isAdmin && (
                              <button
                                onClick={() => void handleDeleteSubTask(task.id)}
                                className="p-0.5 rounded hover:bg-danger/10 text-text-tertiary hover:text-danger opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        ))}

                        {isAdmin && (
                          <button
                            onClick={() => void handleAddSubTask(stage.id)}
                            className="flex items-center gap-1 text-caption text-nah-blue hover:underline mt-1"
                          >
                            <Plus size={11} /> Add sub-task
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {isAdmin && (
                <button
                  onClick={() => void handleAddStage()}
                  disabled={saving}
                  className="flex items-center gap-1 text-body-sm text-nah-blue hover:underline mt-2"
                >
                  <Plus size={14} /> Add stage
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {saving && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 px-3 py-2 bg-bg-tertiary border border-border-default rounded-lg shadow-lg text-caption text-text-secondary">
          <Loader2 size={12} className="animate-spin" /> Saving...
        </div>
      )}

      {promptModal && (
        <PromptModal
          title={promptModal.title}
          placeholder={promptModal.placeholder}
          submitLabel="Add"
          onSubmit={promptModal.onSubmit}
          onCancel={() => setPromptModal(null)}
        />
      )}

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          body={confirmModal.body}
          destructive
          confirmLabel="Delete"
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
