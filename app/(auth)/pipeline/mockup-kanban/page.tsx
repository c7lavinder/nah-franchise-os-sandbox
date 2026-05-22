"use client";

/**
 * Pipeline Mockup — Kanban Board View
 *
 * Each pipeline is a horizontal row of stage columns.
 * Prospects appear as draggable cards inside each stage column.
 * Drag a card from one stage to another to move them.
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
import { ChevronDown, ChevronRight, Clock, Search, ArrowRight, X, Loader2, Calendar, GripVertical } from "lucide-react";
import { useScrollLock } from "@/lib/hooks/useScrollLock";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

/** Stage column header gradient — warm coral to green wave */
const STAGE_HEADER_COLORS: Record<string, string> = {
  // Sales
  engagement: "from-[#e87461] to-[#e8956a]",
  qualification: "from-[#e8956a] to-[#e8b468]",
  discovery: "from-[#e8b468] to-[#d4c456]",
  compliance: "from-[#d4c456] to-[#a8c94a]",
  awarding: "from-[#a8c94a] to-[#6dba5e]",
  closed: "from-[#6dba5e] to-[#4aad6b]",
  // Onboarding
  setup: "from-[#e87461] to-[#e8956a]",
  training: "from-[#e8a065] to-[#d4b855]",
  "launch-prep": "from-[#c4c44e] to-[#8ec758]",
  onboarded: "from-[#6dba5e] to-[#4aad6b]",
  // Runway
  "first-offer": "from-[#e87461] to-[#e8956a]",
  "first-purchase": "from-[#e8a065] to-[#d4b855]",
  "inventory-building": "from-[#c4c44e] to-[#8ec758]",
  running: "from-[#6dba5e] to-[#4aad6b]",
  // Territories
  inactive: "from-[#e87461] to-[#e8956a]",
  available: "from-[#d4b855] to-[#b8c84e]",
  active: "from-[#6dba5e] to-[#4aad6b]",
  // Follow-up
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
        bg-bg-tertiary border border-border-default rounded-lg px-3 py-2.5
        cursor-grab active:cursor-grabbing
        hover:border-border-hover hover:shadow-sm
        transition-all duration-150
        ${isDragging ? "opacity-30 scale-95" : "opacity-100"}
      `}
    >
      {/* Name row */}
      <div className="flex items-center gap-2 mb-1.5">
        <GripVertical size={12} className="text-text-tertiary flex-shrink-0 opacity-40" />
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${urgDot}`} />
        <p className="text-body-sm text-text-primary font-medium truncate leading-tight">
          {capitalizeName(contact.name)}
        </p>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 ml-[28px] text-[11px] text-text-tertiary">
        <span className="flex items-center gap-1">
          <Clock size={10} />
          {contact.daysSinceSubTask}d
        </span>
        {contact.source && <span className="truncate max-w-[80px]">{contact.source}</span>}
        {contact.territoryMsSlug && (
          <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-info/10 text-info">
            {contact.territoryMsSlug}
          </span>
        )}
      </div>

      {/* Appointment badge */}
      {contact.nextAppointment && (
        <div className="flex items-center gap-1 ml-[28px] mt-1 text-[10px] text-nah-blue">
          <Calendar size={9} />
          <span>
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
// Drag Overlay Card (follows cursor)
// ---------------------------------------------------------------------------

function DragOverlayProspect({ contact }: { contact: PipelineContact }) {
  return (
    <div className="w-56 bg-bg-tertiary border-2 border-nah-orange rounded-lg px-3 py-2.5 shadow-xl rotate-2 opacity-90">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${URGENCY_DOT[contact.urgency]}`} />
        <p className="text-body-sm text-text-primary font-medium truncate">{capitalizeName(contact.name)}</p>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-text-tertiary">
        <Clock size={10} />
        {contact.daysSinceSubTask}d in stage
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage Column (droppable)
// ---------------------------------------------------------------------------

function KanbanColumn({ stage, contacts }: { stage: StageAPI; contacts: PipelineContact[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const [showAll, setShowAll] = useState(false);

  const INITIAL_SHOW = 15;
  const visible = showAll ? contacts : contacts.slice(0, INITIAL_SHOW);
  const hasMore = contacts.length > INITIAL_SHOW;

  const headerGrad = STAGE_HEADER_COLORS[stage.slug] ?? "from-gray-400 to-gray-500";

  return (
    <div
      ref={setNodeRef}
      className={`
        flex-shrink-0 w-64 flex flex-col rounded-xl overflow-hidden
        border transition-all duration-200
        ${isOver ? "border-nah-orange shadow-lg shadow-nah-orange/10 scale-[1.01]" : "border-border-default"}
      `}
      style={{ maxHeight: "calc(100vh - 220px)" }}
    >
      {/* Column header with gradient stripe */}
      <div className="relative">
        <div className={`h-1.5 bg-gradient-to-r ${headerGrad}`} />
        <div className="px-3 py-2.5 bg-bg-secondary">
          <div className="flex items-center justify-between">
            <h3 className="text-body-sm font-semibold text-text-primary truncate">{stage.name}</h3>
            <span className="flex-shrink-0 min-w-[24px] h-5 px-1.5 rounded-full bg-text-primary/10 text-[11px] font-bold text-text-secondary flex items-center justify-center">
              {contacts.length}
            </span>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-bg-primary/50">
        {visible.length === 0 && (
          <p className="text-caption text-text-tertiary text-center py-8 italic">No prospects</p>
        )}
        {visible.map((c) => (
          <ProspectCard key={c.stateId} contact={c} />
        ))}
        {hasMore && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full py-1.5 text-caption text-text-tertiary hover:text-text-primary flex items-center justify-center gap-1"
          >
            <ChevronDown size={12} />
            Show {contacts.length - INITIAL_SHOW} more
          </button>
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
  fromStage,
  toStage,
  onConfirm,
  onCancel,
}: {
  contactName: string;
  fromStage: string;
  toStage: string;
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
          <span className="text-text-secondary">{fromStage}</span>
          <ArrowRight size={14} className="text-nah-orange flex-shrink-0" />
          <span className="text-text-primary font-medium">{toStage}</span>
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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ sales: true });
  const [activeContact, setActiveContact] = useState<PipelineContact | null>(null);
  const [moveModal, setMoveModal] = useState<{
    contact: PipelineContact;
    fromStage: string;
    toStageId: string;
    toStageName: string;
  } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Build stage lookup
  const stageMap = new Map<string, StageAPI>();
  for (const p of pipelines) {
    for (const s of p.stages) {
      stageMap.set(s.id, s);
    }
  }

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [stagesRes, contactsRes] = await Promise.all([
        apiFetch("/api/pipeline/stages"),
        apiFetch("/api/pipeline/contacts?limit=5000"),
      ]);

      if (stagesRes.ok) {
        const d = await stagesRes.json();
        setPipelines(d.pipelines ?? []);
      }
      if (contactsRes.ok) {
        const d = await contactsRes.json();
        setContacts(d.contacts ?? []);
      }
    } catch {
      /* silent */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Filter contacts by search
  const filtered = searchQuery
    ? contacts.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : contacts;

  // Group contacts by stageId
  const contactsByStage = new Map<string, PipelineContact[]>();
  for (const c of filtered) {
    const arr = contactsByStage.get(c.stageId) ?? [];
    arr.push(c);
    contactsByStage.set(c.stageId, arr);
  }

  // Sort within each stage by urgency (most urgent first)
  for (const [key, arr] of contactsByStage) {
    contactsByStage.set(
      key,
      arr.sort((a, b) => b.urgencyScore - a.urgencyScore || b.daysSinceSubTask - a.daysSinceSubTask)
    );
  }

  // Order pipelines
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

    const targetStageId = over.id as string;
    if (targetStageId === c.stageId) return;

    const fromStage = stageMap.get(c.stageId);
    const toStage = stageMap.get(targetStageId);

    setMoveModal({
      contact: c,
      fromStage: fromStage?.name ?? "Unknown",
      toStageId: targetStageId,
      toStageName: toStage?.name ?? "Unknown",
    });
  }

  function handleConfirmMove() {
    if (!moveModal) return;
    // In a real implementation this would call the API
    // For the mockup, just move the card client-side
    setContacts((prev) =>
      prev.map((c) =>
        c.stateId === moveModal.contact.stateId
          ? { ...c, stageId: moveModal.toStageId, stageName: moveModal.toStageName, stageSlug: "" }
          : c
      )
    );
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
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-h1 text-text-primary">Pipeline Board</h1>
          <p className="text-caption text-text-tertiary mt-0.5">Kanban view — drag prospects between stages</p>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-nah-orange/10 text-nah-orange text-[11px] font-semibold uppercase tracking-wider">
          Mockup
        </span>
      </div>

      {/* Search bar */}
      <div className="relative mb-5 max-w-sm">
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
        <div className="space-y-3">
          {ordered.map((pipeline) => {
            const title = PIPELINE_TITLES[pipeline.slug] ?? pipeline.name;
            const isExpanded = expanded[pipeline.slug] ?? false;
            const totalInPipeline = pipeline.stages.reduce(
              (sum, s) => sum + (contactsByStage.get(s.id)?.length ?? 0),
              0
            );

            return (
              <div key={pipeline.id} className="border border-border-default rounded-xl overflow-hidden">
                {/* Pipeline header */}
                <button
                  onClick={() => togglePipeline(pipeline.slug)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-bg-secondary hover:bg-bg-hover transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-text-tertiary" />
                  ) : (
                    <ChevronRight size={14} className="text-text-tertiary" />
                  )}
                  <span className="text-body-sm font-semibold text-text-primary">{title}</span>
                  <span className="text-caption text-text-tertiary">
                    {totalInPipeline} {totalInPipeline === 1 ? "prospect" : "prospects"}
                  </span>
                  {/* Mini stage count pills */}
                  {!isExpanded && (
                    <div className="flex gap-1 ml-auto">
                      {pipeline.stages.map((s) => {
                        const count = contactsByStage.get(s.id)?.length ?? 0;
                        const grad = STAGE_HEADER_COLORS[s.slug] ?? "from-gray-400 to-gray-500";
                        return (
                          <span
                            key={s.id}
                            title={`${s.name}: ${count}`}
                            className={`h-5 min-w-[28px] px-1.5 rounded-full bg-gradient-to-r ${grad} text-white text-[10px] font-bold flex items-center justify-center`}
                          >
                            {count}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </button>

                {/* Kanban columns */}
                {isExpanded && (
                  <div className="px-3 py-4 overflow-x-auto bg-bg-primary">
                    <div className="flex gap-3" style={{ minWidth: `${pipeline.stages.length * 272}px` }}>
                      {pipeline.stages.map((stage) => (
                        <KanbanColumn key={stage.id} stage={stage} contacts={contactsByStage.get(stage.id) ?? []} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Drag overlay */}
        <DragOverlay>{activeContact ? <DragOverlayProspect contact={activeContact} /> : null}</DragOverlay>
      </DndContext>

      {/* Move confirmation modal */}
      {moveModal && (
        <MoveModal
          contactName={capitalizeName(moveModal.contact.name)}
          fromStage={moveModal.fromStage}
          toStage={moveModal.toStageName}
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
