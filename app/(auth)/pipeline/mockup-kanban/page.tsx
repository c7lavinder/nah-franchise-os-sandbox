"use client";

/**
 * Pipeline Mockup — Kanban Board View (v3)
 *
 * Full-width layout (breaks out of AppShell max-w-content).
 * All stages fit on screen as equal-width columns.
 * Inside each stage, sub-task panels group prospect cards.
 * Shows upcoming call/appointment on each card.
 *
 * This is a MOCKUP for team review — lives at /pipeline/mockup-kanban
 */

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/auth/api-fetch";
import { capitalizeName } from "@/lib/format/contact";
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { ChevronDown, ChevronRight, Clock, Search, ArrowRight, X, Loader2, GripVertical, Calendar } from "lucide-react";
import { useScrollLock } from "@/lib/hooks/useScrollLock";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubTaskAPI {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  stage_id: string;
}

interface StageAPI {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  is_terminal: boolean;
  active_count: number;
}

interface PipelineAPI {
  id: string;
  slug: string;
  name: string;
  stages: StageAPI[];
}

interface PipelineContact {
  stateId: string;
  contactId: string;
  ghlContactId: string | null;
  journeyId?: string;
  journeySlug?: string | null;
  territoryMsSlug?: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  city: string | null;
  state: string | null;
  stageName: string;
  stageSlug: string;
  stageId: string;
  pipelineName: string;
  pipelineSlug: string;
  daysSinceSubTask: number;
  urgency: "fresh" | "at_risk" | "losing" | "won";
  urgencyScore: number;
  enteredStageAt: string | null;
  currentSubTaskId: string | null;
  nextAppointment?: { title: string; startTime: string } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PIPELINE_ORDER = ["sales", "onboarding", "runway", "territories", "followup"];
const PIPELINE_TITLES: Record<string, string> = {
  sales: "Path to Ownership",
  onboarding: "Onboarding",
  runway: "Runway",
  territories: "Territories",
  followup: "Long-Term Follow-Up",
};

const URGENCY_DOT: Record<string, string> = {
  won: "bg-[#1565c0]",
  losing: "bg-[#c62828]",
  at_risk: "bg-[#e65100]",
  fresh: "bg-[#2e7d32]",
};

const URGENCY_LABEL: Record<string, string> = {
  won: "Won",
  losing: "Losing",
  at_risk: "At Risk",
  fresh: "Fresh",
};

const STAGE_HEADER_COLORS: Record<string, string> = {
  engagement: "from-[#e87461] to-[#e8956a]",
  qualification: "from-[#e8956a] to-[#e8b468]",
  discovery: "from-[#e8b468] to-[#d4c456]",
  compliance: "from-[#d4c456] to-[#a8c94a]",
  awarding: "from-[#a8c94a] to-[#6dba5e]",
  closed: "from-[#6dba5e] to-[#4aad6b]",
  setup: "from-[#e87461] to-[#e8956a]",
  training: "from-[#e8a065] to-[#d4b855]",
  "launch-prep": "from-[#c4c44e] to-[#8ec758]",
  onboarded: "from-[#6dba5e] to-[#4aad6b]",
  "first-offer": "from-[#e87461] to-[#e8956a]",
  "first-purchase": "from-[#e8a065] to-[#d4b855]",
  "inventory-building": "from-[#c4c44e] to-[#8ec758]",
  running: "from-[#6dba5e] to-[#4aad6b]",
  inactive: "from-[#e87461] to-[#e8956a]",
  available: "from-[#d4b855] to-[#b8c84e]",
  active: "from-[#6dba5e] to-[#4aad6b]",
  nurture: "from-[#e87461] to-[#e8956a]",
  followup: "from-[#d4b855] to-[#b8c84e]",
  reengaged: "from-[#6dba5e] to-[#4aad6b]",
};

// ---------------------------------------------------------------------------
// Prospect Card (draggable)
// ---------------------------------------------------------------------------

function ProspectCard({ contact }: { contact: PipelineContact }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: contact.stateId,
    data: { contact },
  });

  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;

  const urgDot = URGENCY_DOT[contact.urgency] ?? "bg-gray-400";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        bg-bg-tertiary border border-border-default rounded-md px-2 py-1.5
        cursor-grab active:cursor-grabbing
        hover:border-border-hover hover:shadow-sm
        transition-all duration-150
        ${isDragging ? "opacity-30 scale-95" : "opacity-100"}
      `}
    >
      <div className="flex items-center gap-1.5">
        <GripVertical size={10} className="text-text-tertiary flex-shrink-0 opacity-30" />
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${urgDot}`} />
        <p className="text-[12px] text-text-primary font-medium truncate leading-tight">
          {capitalizeName(contact.name)}
        </p>
      </div>
      <div className="flex items-center gap-2 ml-[22px] text-[10px] text-text-tertiary mt-0.5">
        <span className="flex items-center gap-0.5">
          <Clock size={9} />
          {contact.daysSinceSubTask}d
        </span>
        {contact.source && <span className="truncate max-w-[60px]">{contact.source}</span>}
      </div>
      {contact.nextAppointment && (
        <div className="flex items-center gap-1 ml-[22px] mt-0.5 text-[10px] text-nah-blue">
          <Calendar size={8} />
          <span className="truncate">
            {contact.nextAppointment.title?.replace(/\s*w\/.*$/, "") ?? "Call"} &middot;{" "}
            {new Date(contact.nextAppointment.startTime).toLocaleDateString([], {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag Overlay Card
// ---------------------------------------------------------------------------

function DragOverlayProspect({ contact }: { contact: PipelineContact }) {
  return (
    <div className="w-48 bg-bg-tertiary border-2 border-nah-orange rounded-md px-2 py-1.5 shadow-xl rotate-2 opacity-90">
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${URGENCY_DOT[contact.urgency]}`} />
        <p className="text-[12px] text-text-primary font-medium truncate">{capitalizeName(contact.name)}</p>
      </div>
      <div className="flex items-center gap-1 text-[10px] text-text-tertiary mt-0.5">
        <Clock size={9} />
        {contact.daysSinceSubTask}d
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-Task Panel (droppable)
// ---------------------------------------------------------------------------

function SubTaskPanel({ subTask, contacts }: { subTask: SubTaskAPI; contacts: PipelineContact[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `subtask:${subTask.id}` });
  const [showAll, setShowAll] = useState(false);
  const MAX_INITIAL = 8;
  const visible = showAll ? contacts : contacts.slice(0, MAX_INITIAL);
  const hasMore = contacts.length > MAX_INITIAL;

  return (
    <div
      ref={setNodeRef}
      className={`
        rounded-lg border overflow-hidden transition-all duration-200
        ${isOver ? "border-nah-orange bg-nah-orange/5" : "border-border-default bg-bg-secondary/50"}
      `}
    >
      <div className="px-2.5 py-1.5 bg-bg-secondary/80 border-b border-border-default flex items-center justify-between">
        <span className="text-[11px] font-semibold text-text-secondary truncate">{subTask.name}</span>
        <span className="text-[10px] text-text-tertiary font-medium ml-1">{contacts.length}</span>
      </div>
      <div className="p-1.5 space-y-1 min-h-[32px]">
        {visible.length === 0 && <p className="text-[10px] text-text-tertiary text-center py-2 italic">—</p>}
        {visible.map((c) => (
          <ProspectCard key={c.stateId} contact={c} />
        ))}
        {hasMore && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full py-1 text-[10px] text-text-tertiary hover:text-text-primary flex items-center justify-center gap-0.5"
          >
            <ChevronDown size={10} />+{contacts.length - MAX_INITIAL} more
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unsorted panel
// ---------------------------------------------------------------------------

function UnsortedPanel({ stageId, contacts }: { stageId: string; contacts: PipelineContact[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `unsorted:${stageId}` });
  const [showAll, setShowAll] = useState(false);
  const MAX_INITIAL = 8;
  const visible = showAll ? contacts : contacts.slice(0, MAX_INITIAL);
  const hasMore = contacts.length > MAX_INITIAL;

  if (contacts.length === 0) return null;

  return (
    <div
      ref={setNodeRef}
      className={`
        rounded-lg border overflow-hidden transition-all duration-200
        ${isOver ? "border-nah-orange bg-nah-orange/5" : "border-dashed border-border-default bg-bg-primary/30"}
      `}
    >
      <div className="px-2.5 py-1.5 bg-bg-secondary/40 border-b border-border-default flex items-center justify-between">
        <span className="text-[11px] font-medium text-text-tertiary italic">Unsorted</span>
        <span className="text-[10px] text-text-tertiary">{contacts.length}</span>
      </div>
      <div className="p-1.5 space-y-1 min-h-[32px]">
        {visible.map((c) => (
          <ProspectCard key={c.stateId} contact={c} />
        ))}
        {hasMore && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full py-1 text-[10px] text-text-tertiary hover:text-text-primary flex items-center justify-center gap-0.5"
          >
            <ChevronDown size={10} />+{contacts.length - MAX_INITIAL} more
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage Column
// ---------------------------------------------------------------------------

function StageColumn({
  stage,
  subTasks,
  contacts,
}: {
  stage: StageAPI;
  subTasks: SubTaskAPI[];
  contacts: PipelineContact[];
}) {
  const headerGrad = STAGE_HEADER_COLORS[stage.slug] ?? "from-gray-400 to-gray-500";

  const bySubTask = new Map<string, PipelineContact[]>();
  const unsorted: PipelineContact[] = [];

  for (const c of contacts) {
    if (c.currentSubTaskId && subTasks.some((st) => st.id === c.currentSubTaskId)) {
      const arr = bySubTask.get(c.currentSubTaskId) ?? [];
      arr.push(c);
      bySubTask.set(c.currentSubTaskId, arr);
    } else {
      unsorted.push(c);
    }
  }

  return (
    <div className="flex flex-col min-w-0 flex-1">
      <div className="rounded-t-lg overflow-hidden">
        <div className={`h-1.5 bg-gradient-to-r ${headerGrad}`} />
        <div className="px-3 py-2 bg-bg-secondary border-x border-border-default">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-text-primary truncate">{stage.name}</h3>
            <span className="flex-shrink-0 min-w-[22px] h-[18px] px-1 rounded-full bg-text-primary/10 text-[10px] font-bold text-text-secondary flex items-center justify-center">
              {contacts.length}
            </span>
          </div>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto border-x border-b border-border-default rounded-b-lg p-2 space-y-2 bg-bg-primary/30"
        style={{ maxHeight: "calc(100vh - 260px)" }}
      >
        {subTasks.length === 0 && contacts.length === 0 && (
          <p className="text-[11px] text-text-tertiary text-center py-6 italic">No prospects</p>
        )}

        {subTasks.map((st) => (
          <SubTaskPanel key={st.id} subTask={st} contacts={bySubTask.get(st.id) ?? []} />
        ))}

        <UnsortedPanel stageId={stage.id} contacts={unsorted} />

        {subTasks.length === 0 && contacts.length > 0 && (
          <div className="space-y-1">
            {contacts.map((c) => (
              <ProspectCard key={c.stateId} contact={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Move Confirmation Modal
// ---------------------------------------------------------------------------

function MoveModal({
  contactName,
  fromLabel,
  toLabel,
  onConfirm,
  onCancel,
}: {
  contactName: string;
  fromLabel: string;
  toLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useScrollLock(true);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-bg-tertiary border border-border-default rounded-lg w-full max-w-sm mx-4 p-5">
        <button onClick={onCancel} className="absolute top-3 right-3 text-text-tertiary hover:text-text-primary">
          <X size={18} />
        </button>
        <h2 className="text-h2 text-text-primary mb-3">Move Prospect</h2>
        <p className="text-body-sm text-text-secondary mb-3">
          <span className="font-medium text-text-primary">{contactName}</span>
        </p>
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-bg-secondary rounded-md text-body-sm">
          <span className="text-text-secondary">{fromLabel}</span>
          <ArrowRight size={14} className="text-nah-orange flex-shrink-0" />
          <span className="text-text-primary font-medium">{toLabel}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-ghost px-4 py-2 text-body-sm">
            Cancel
          </button>
          <button onClick={onConfirm} className="btn-primary px-4 py-2 text-body-sm ml-auto">
            Confirm Move
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function KanbanMockupPage() {
  const [pipelines, setPipelines] = useState<PipelineAPI[]>([]);
  const [contacts, setContacts] = useState<PipelineContact[]>([]);
  const [subTasks, setSubTasks] = useState<SubTaskAPI[]>([]);
  const [appointmentMap, setAppointmentMap] = useState<Record<string, { title: string; startTime: string }>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ sales: true });
  const [activeContact, setActiveContact] = useState<PipelineContact | null>(null);
  const [moveModal, setMoveModal] = useState<{
    contact: PipelineContact;
    fromLabel: string;
    toLabel: string;
  } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Build lookups
  const subTaskMap = new Map<string, SubTaskAPI>();
  for (const st of subTasks) subTaskMap.set(st.id, st);

  const stageMap = new Map<string, StageAPI>();
  for (const p of pipelines) {
    for (const s of p.stages) stageMap.set(s.id, s);
  }

  const subTasksByStage = new Map<string, SubTaskAPI[]>();
  for (const st of subTasks) {
    const arr = subTasksByStage.get(st.stage_id) ?? [];
    arr.push(st);
    subTasksByStage.set(st.stage_id, arr);
  }
  for (const [key, arr] of subTasksByStage) {
    subTasksByStage.set(
      key,
      arr.sort((a, b) => a.sort_order - b.sort_order)
    );
  }

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [stagesRes, contactsRes, subTasksRes, aptsRes] = await Promise.all([
        apiFetch("/api/pipeline/stages"),
        apiFetch("/api/pipeline/contacts?limit=5000"),
        apiFetch("/api/pipelines/stages?include_sub_tasks=true"),
        apiFetch("/api/pipeline/appointments"),
      ]);

      if (stagesRes.ok) {
        const d = await stagesRes.json();
        setPipelines(d.pipelines ?? []);
      }
      if (contactsRes.ok) {
        const d = await contactsRes.json();
        setContacts(d.contacts ?? []);
      }
      if (subTasksRes.ok) {
        const d = await subTasksRes.json();
        setSubTasks(d.subTasks ?? []);
      }
      if (aptsRes.ok) {
        const d = await aptsRes.json();
        setAppointmentMap(d.appointments ?? {});
      }
    } catch {
      /* silent */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Fallback: fetch sub-tasks from settings if not returned above
  useEffect(() => {
    if (!loading && subTasks.length === 0 && pipelines.length > 0) {
      apiFetch("/api/settings/pipelines")
        .then(async (res) => {
          if (!res.ok) return;
          const d = await res.json();
          const allSubTasks: SubTaskAPI[] = [];
          for (const p of d.pipelines ?? []) {
            for (const s of p.stages ?? []) {
              for (const st of s.subTasks ?? []) {
                allSubTasks.push({
                  id: st.id,
                  slug: st.slug,
                  name: st.name,
                  sort_order: st.sort_order,
                  stage_id: s.id,
                });
              }
            }
          }
          if (allSubTasks.length > 0) setSubTasks(allSubTasks);
        })
        .catch(() => {});
    }
  }, [loading, subTasks.length, pipelines]);

  // Merge appointments into contacts
  const contactsWithApts = contacts.map((c) => {
    const apt = c.ghlContactId ? appointmentMap[c.ghlContactId] : null;
    return apt ? { ...c, nextAppointment: apt } : c;
  });

  // Filter by search
  const filtered = searchQuery
    ? contactsWithApts.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : contactsWithApts;

  // Group by stageId
  const contactsByStage = new Map<string, PipelineContact[]>();
  for (const c of filtered) {
    const arr = contactsByStage.get(c.stageId) ?? [];
    arr.push(c);
    contactsByStage.set(c.stageId, arr);
  }

  // Sort within each stage
  for (const [key, arr] of contactsByStage) {
    contactsByStage.set(
      key,
      arr.sort((a, b) => b.urgencyScore - a.urgencyScore || b.daysSinceSubTask - a.daysSinceSubTask)
    );
  }

  const ordered = PIPELINE_ORDER.map((slug) => pipelines.find((p) => p.slug === slug)).filter(
    (p): p is PipelineAPI => !!p
  );

  // Drag handlers
  function handleDragStart(event: DragStartEvent) {
    const c = event.active.data.current?.contact as PipelineContact | undefined;
    setActiveContact(c ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveContact(null);
    const { active, over } = event;
    if (!over) return;

    const c = active.data.current?.contact as PipelineContact | undefined;
    if (!c) return;

    const targetId = over.id as string;

    let toLabel = "Unknown";
    if (targetId.startsWith("subtask:")) {
      const stId = targetId.replace("subtask:", "");
      const st = subTaskMap.get(stId);
      if (st) {
        const stage = stageMap.get(st.stage_id);
        toLabel = `${stage?.name ?? ""} > ${st.name}`;
      }
      if (stId === c.currentSubTaskId) return;
    } else if (targetId.startsWith("unsorted:")) {
      const stageId = targetId.replace("unsorted:", "");
      const stage = stageMap.get(stageId);
      toLabel = `${stage?.name ?? "Unknown"} (unsorted)`;
      if (stageId === c.stageId && !c.currentSubTaskId) return;
    }

    let fromLabel = c.stageName;
    if (c.currentSubTaskId) {
      const fromSt = subTaskMap.get(c.currentSubTaskId);
      if (fromSt) fromLabel = `${c.stageName} > ${fromSt.name}`;
    }

    setMoveModal({ contact: c, fromLabel, toLabel });
  }

  function handleConfirmMove() {
    setMoveModal(null);
  }

  function togglePipeline(slug: string) {
    setExpanded((prev) => ({ ...prev, [slug]: !prev[slug] }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
        <span className="ml-2 text-body-sm text-text-tertiary">Loading pipeline board...</span>
      </div>
    );
  }

  return (
    // Break out of the AppShell max-w-content container to go full-width
    <div className="-mx-4 md:-mx-8 px-3">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-h1 text-text-primary">Pipeline Board</h1>
          <p className="text-caption text-text-tertiary mt-0.5">
            Kanban view — stages with sub-task panels, drag prospects to move
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-nah-orange/10 text-nah-orange text-[11px] font-semibold uppercase tracking-wider">
          Mockup v3
        </span>
      </div>

      {/* Search bar */}
      <div className="relative mb-4 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          placeholder="Search prospects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-bg-secondary border border-border-default rounded-lg text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-nah-orange focus:outline-none"
        />
      </div>

      {/* Pipeline rows */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="space-y-4">
          {ordered.map((pipeline) => {
            const title = PIPELINE_TITLES[pipeline.slug] ?? pipeline.name;
            const isExpanded = expanded[pipeline.slug] ?? false;
            const totalInPipeline = pipeline.stages.reduce(
              (sum, s) => sum + (contactsByStage.get(s.id)?.length ?? 0),
              0
            );

            return (
              <div key={pipeline.id}>
                {/* Pipeline header */}
                <button onClick={() => togglePipeline(pipeline.slug)} className="flex items-center gap-2 mb-2">
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-text-tertiary" />
                  ) : (
                    <ChevronRight size={14} className="text-text-tertiary" />
                  )}
                  <span className="text-body font-semibold text-text-primary">{title}</span>
                  <span className="text-caption text-text-tertiary">
                    {totalInPipeline} {totalInPipeline === 1 ? "prospect" : "prospects"}
                  </span>
                  {!isExpanded && (
                    <div className="flex gap-1 ml-2">
                      {pipeline.stages.map((s) => {
                        const count = contactsByStage.get(s.id)?.length ?? 0;
                        const grad = STAGE_HEADER_COLORS[s.slug] ?? "from-gray-400 to-gray-500";
                        return (
                          <span
                            key={s.id}
                            title={`${s.name}: ${count}`}
                            className={`h-5 min-w-[26px] px-1 rounded-full bg-gradient-to-r ${grad} text-white text-[10px] font-bold flex items-center justify-center`}
                          >
                            {count}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </button>

                {/* Stage columns — full width, equal columns */}
                {isExpanded && (
                  <div
                    className="grid gap-2"
                    style={{
                      gridTemplateColumns: `repeat(${pipeline.stages.length}, minmax(0, 1fr))`,
                    }}
                  >
                    {pipeline.stages.map((stage) => (
                      <StageColumn
                        key={stage.id}
                        stage={stage}
                        subTasks={subTasksByStage.get(stage.id) ?? []}
                        contacts={contactsByStage.get(stage.id) ?? []}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DragOverlay>{activeContact ? <DragOverlayProspect contact={activeContact} /> : null}</DragOverlay>
      </DndContext>

      {/* Move modal */}
      {moveModal && (
        <MoveModal
          contactName={capitalizeName(moveModal.contact.name)}
          fromLabel={moveModal.fromLabel}
          toLabel={moveModal.toLabel}
          onConfirm={handleConfirmMove}
          onCancel={() => setMoveModal(null)}
        />
      )}

      {/* Legend */}
      <div className="mt-6 px-4 py-3 bg-bg-secondary border border-border-default rounded-lg">
        <p className="text-caption text-text-tertiary mb-2 font-medium">Urgency Key</p>
        <div className="flex gap-4">
          {(["fresh", "at_risk", "losing", "won"] as const).map((u) => (
            <div key={u} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${URGENCY_DOT[u]}`} />
              <span className="text-caption text-text-secondary">{URGENCY_LABEL[u]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
