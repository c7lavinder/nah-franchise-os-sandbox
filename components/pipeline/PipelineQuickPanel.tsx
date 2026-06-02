"use client";

/**
 * PipelineQuickPanel — inline panel below a pipeline lead row.
 * Three columns: Sub-Tasks | Upcoming Events | Contacts
 * Action bar: Advance, Back Stage, Move to Follow-Up / Nurture
 */

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Mail,
  MessageSquare,
  Phone,
  ClipboardList,
  ArrowRight,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/auth/api-fetch";
import { titleCase, capitalizeName } from "@/lib/format/contact";
import SubTaskCircle from "@/components/contact/SubTaskCircle";
import { computeSubTaskVisualState } from "@/lib/contacts/stage-visual-state";
import type { PipelineSubTask, SubTaskLog } from "@/lib/contacts/pipeline-state";
import { useToast } from "@/components/ui/Toast";
import TerritoryAssignModal from "./TerritoryAssignModal";

interface PipelineQuickPanelProps {
  contactId: string;
  ghlContactId: string | null;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  stageId: string;
  stageName: string;
  pipelineSlug: string;
  journeyId?: string;
  onRefresh: () => void;
}

interface PendingStep {
  logId: string;
  stepType: string;
  content: string | null;
  subject: string | null;
  workflowName: string;
  sendTime: string | null;
  queuedAt: string;
}

interface JourneyMember {
  contactId: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
}

interface StageData {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  subTasks: PipelineSubTask[];
  logsBySubTask: Record<string, SubTaskLog[]>;
}

export default function PipelineQuickPanel({
  contactId,
  ghlContactId,
  contactName,
  contactEmail,
  contactPhone,
  stageId,
  stageName,
  pipelineSlug,
  onRefresh,
}: PipelineQuickPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [currentStage, setCurrentStage] = useState<StageData | null>(null);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [pendingSteps, setPendingSteps] = useState<PendingStep[]>([]);
  const [journeyMembers, setJourneyMembers] = useState<JourneyMember[]>([]);
  const [appointments, setAppointments] = useState<{ title: string; startTime: string }[]>([]);
  const [acting, setActing] = useState(false);
  const [showTerritoryModal, setShowTerritoryModal] = useState(false);
  const [allStages, setAllStages] = useState<StageData[]>([]);

  const identifier = ghlContactId ?? contactId;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // All fetches in parallel
      const [stateRes, pendingRes, membersRes, aptRes] = await Promise.all([
        apiFetch(`/api/contacts/${identifier}/pipeline-state`),
        ghlContactId ? apiFetch(`/api/workflows/pending-steps?ghl_contact_id=${ghlContactId}`) : Promise.resolve(null),
        apiFetch(`/api/contacts/${identifier}/journey-members`),
        ghlContactId ? apiFetch(`/api/contacts/${identifier}/appointments`) : Promise.resolve(null),
      ]);

      // Pipeline state → sub-tasks
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        const states = stateData.pipelineStates ?? [];
        const matchingState = states.find(
          (s: { pipeline_slug?: string; pipelines?: { slug: string } }) =>
            s.pipeline_slug === pipelineSlug || (s.pipelines as { slug: string } | undefined)?.slug === pipelineSlug
        );
        if (matchingState) {
          setPipelineId(matchingState.pipeline_id);
          const stages = matchingState.stages ?? [];
          setAllStages(stages);
          const stage = stages.find((s: StageData) => s.id === stageId);
          if (stage) setCurrentStage(stage);
        }
      }

      // Pending workflow steps
      if (pendingRes?.ok) {
        const d = await pendingRes.json();
        setPendingSteps((d.pendingSteps ?? []).slice(0, 5));
      }

      // Journey members
      if (membersRes.ok) {
        const d = await membersRes.json();
        setJourneyMembers(d.members ?? []);
      }

      // Appointments
      if (aptRes?.ok) {
        const d = await aptRes.json();
        setAppointments((d.appointments ?? []).slice(0, 5));
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [identifier, ghlContactId, pipelineSlug, stageId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Check if advancing would move into a terminal stage (e.g. Closed → triggers onboarding)
  function isNextStageTerminal(): boolean {
    if (!currentStage || allStages.length === 0) return false;
    const sorted = [...allStages].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((s) => s.id === currentStage.id);
    const next = sorted[idx + 1];
    return next?.slug === "closed" || next?.slug === "onboarded" || next?.slug === "running";
  }

  async function handleAdvance() {
    if (!pipelineId) return;

    // If next stage is terminal and this is sales, offer territory creation first
    if (pipelineSlug === "sales" && isNextStageTerminal() && ghlContactId) {
      setShowTerritoryModal(true);
      return;
    }

    await doAdvance();
  }

  async function doAdvance() {
    if (!pipelineId) return;
    setActing(true);
    try {
      const res = await apiFetch(`/api/contacts/${identifier}/pipelines/${pipelineId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      if (res.ok) {
        toast("Stage advanced");
        await fetchData();
        onRefresh();
      } else {
        const data = await res.json().catch(() => ({ error: "Advance failed" }));
        toast(data.error ?? "Advance failed");
      }
    } catch {
      toast("Advance failed");
    }
    setActing(false);
  }

  async function handleRevert() {
    if (!pipelineId) return;
    const reason = prompt("Reason for reverting to previous stage:");
    if (!reason?.trim()) return;
    setActing(true);
    try {
      const res = await apiFetch(`/api/contacts/${identifier}/pipelines/${pipelineId}/revert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        toast("Reverted to previous stage");
        await fetchData();
        onRefresh();
      } else {
        const data = await res.json().catch(() => ({ error: "Revert failed" }));
        toast(data.error ?? "Revert failed");
      }
    } catch {
      toast("Revert failed");
    }
    setActing(false);
  }

  async function handleDrop(destination: "followup" | "nurture") {
    if (!pipelineId) return;
    const label = destination === "followup" ? "Follow-Up" : "Nurture";
    let reason = "";
    if (destination === "followup") {
      const input = prompt(`Reason for moving to ${label}:`);
      if (!input?.trim()) return;
      reason = input;
    }
    setActing(true);
    try {
      const res = await apiFetch(`/api/contacts/${identifier}/pipelines/${pipelineId}/drop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination, reason }),
      });
      if (res.ok) {
        toast(`Moved to ${label}`);
        onRefresh();
      } else {
        const data = await res.json().catch(() => ({ error: `Move to ${label} failed` }));
        toast(data.error ?? `Move to ${label} failed`);
      }
    } catch {
      toast(`Move to ${label} failed`);
    }
    setActing(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 bg-bg-secondary border border-border-default border-t-0 rounded-b-lg">
        <Loader2 size={16} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  // Merge appointments + pending steps into chronological timeline
  const upcoming: { type: string; title: string; time: string; meta?: string }[] = [];
  for (const apt of appointments) {
    upcoming.push({ type: "appointment", title: apt.title, time: apt.startTime });
  }
  for (const step of pendingSteps) {
    upcoming.push({
      type: step.stepType,
      title: step.subject ?? step.content?.slice(0, 60) ?? titleCase(step.stepType),
      time: step.sendTime ?? step.queuedAt,
      meta: step.workflowName,
    });
  }
  upcoming.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const visibleUpcoming = upcoming.slice(0, 5);

  const subTasks = currentStage?.subTasks ?? [];
  const logsBySubTask = currentStage?.logsBySubTask ?? {};

  const isSales = pipelineSlug === "sales";
  const isFollowup = pipelineSlug === "followup";

  function getEventIcon(type: string) {
    switch (type) {
      case "appointment":
        return Calendar;
      case "sms":
        return MessageSquare;
      case "email":
        return Mail;
      case "task":
        return ClipboardList;
      default:
        return ArrowRight;
    }
  }

  return (
    <div className="bg-bg-secondary border border-border-default border-t-0 rounded-b-lg overflow-hidden">
      {/* Three-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-border-default">
        {/* Column 1: Sub-Tasks */}
        <div className="p-3">
          <h4 className="text-[10px] font-semibold text-text-tertiary tracking-wider mb-2 uppercase">
            {titleCase(currentStage?.name ?? stageName)} Tasks
          </h4>
          {subTasks.length === 0 ? (
            <p className="text-caption text-text-tertiary italic">No tasks for this stage</p>
          ) : (
            <div className="space-y-0.5">
              {subTasks.map((task) => {
                const logs = logsBySubTask[task.id] ?? [];
                const state = computeSubTaskVisualState(task, logs);
                return (
                  <SubTaskCircle
                    key={task.id}
                    name={task.name}
                    state={state}
                    stateType={task.state_type}
                    firstStateLabel={task.first_state_label}
                    secondStateLabel={task.second_state_label}
                    logCount={logs.length}
                    isExpanded={false}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Column 2: Upcoming Events */}
        <div className="p-3">
          <h4 className="text-[10px] font-semibold text-text-tertiary tracking-wider mb-2 uppercase">Upcoming</h4>
          {visibleUpcoming.length === 0 ? (
            <p className="text-caption text-text-tertiary italic">No upcoming events</p>
          ) : (
            <div className="space-y-2">
              {visibleUpcoming.map((event, i) => {
                const Icon = getEventIcon(event.type);
                const d = new Date(event.time);
                const dateStr = d.toLocaleDateString([], { month: "short", day: "numeric" });
                const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                return (
                  <div key={i} className="flex items-start gap-2">
                    <Icon size={13} className="text-text-tertiary mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm text-text-primary truncate">{event.title}</p>
                      <p className="text-[10px] text-text-tertiary">
                        {dateStr} {timeStr}
                        {event.meta && <span className="ml-1">· {event.meta}</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Column 3: Contacts */}
        <div className="p-3">
          <h4 className="text-[10px] font-semibold text-text-tertiary tracking-wider mb-2 uppercase">Contacts</h4>
          <div className="space-y-2.5">
            {journeyMembers.length > 0 ? (
              journeyMembers.map((m) => (
                <EditableContactCard
                  key={m.contactId}
                  contactId={m.contactId}
                  name={m.name}
                  phone={m.phone}
                  email={m.email}
                  onSaved={() => void fetchData()}
                />
              ))
            ) : (
              <EditableContactCard
                contactId={contactId}
                name={contactName}
                phone={contactPhone}
                email={contactEmail}
                onSaved={() => void fetchData()}
              />
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border-default bg-bg-tertiary flex-wrap">
        {/* Back stage */}
        <button
          onClick={() => void handleRevert()}
          disabled={acting || !pipelineId}
          className="btn-ghost px-3 py-1.5 text-caption flex items-center gap-1 text-text-secondary"
        >
          <ChevronLeft size={12} /> Back Stage
        </button>

        {/* Advance stage */}
        <button
          onClick={() => void handleAdvance()}
          disabled={acting || !pipelineId}
          className="btn-primary px-3 py-1.5 text-caption flex items-center gap-1"
        >
          {acting ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />}
          Advance Stage
        </button>

        {/* Spacer */}
        <span className="flex-1" />

        {/* Move to Follow-Up / Nurture — only for sales pipeline */}
        {(isSales || (!isFollowup && pipelineSlug !== "followup")) && (
          <>
            <button
              onClick={() => void handleDrop("followup")}
              disabled={acting || !pipelineId}
              className="btn-ghost px-3 py-1.5 text-caption flex items-center gap-1 text-warning border border-warning/30 hover:bg-warning/10"
            >
              Move to Follow-Up
            </button>
            <button
              onClick={() => void handleDrop("nurture")}
              disabled={acting || !pipelineId}
              className="btn-ghost px-3 py-1.5 text-caption flex items-center gap-1 text-text-tertiary border border-border-default hover:bg-bg-hover"
            >
              Move to Nurture
            </button>
          </>
        )}
      </div>

      {/* Territory creation modal — shown before closing a sales deal */}
      {showTerritoryModal && ghlContactId && (
        <TerritoryAssignModal
          ghlContactId={ghlContactId}
          contactName={contactName}
          onClose={() => setShowTerritoryModal(false)}
          onCreated={() => {
            setShowTerritoryModal(false);
            void doAdvance();
          }}
        />
      )}
    </div>
  );
}

// ── Inline editable contact card ──────────────────

function EditableContactCard({
  contactId,
  name,
  phone,
  email,
  onSaved,
}: {
  contactId: string;
  name: string;
  phone: string | null;
  email: string | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editPhone, setEditPhone] = useState(phone ?? "");
  const [editEmail, setEditEmail] = useState(email ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, string | null> = {};
      if (editPhone !== (phone ?? "")) body.phone = editPhone || null;
      if (editEmail !== (email ?? "")) body.email = editEmail || null;

      if (Object.keys(body).length > 0) {
        const res = await apiFetch(`/api/contacts/${contactId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          toast("Contact updated");
          onSaved();
        } else {
          const d = await res.json().catch(() => ({ error: "Update failed" }));
          toast(d.error ?? "Update failed");
        }
      }
    } catch {
      toast("Update failed");
    }
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="border-b border-border-default last:border-0 pb-2 last:pb-0 space-y-1.5">
        <p className="text-body-sm text-text-primary font-medium">{capitalizeName(name)}</p>
        <div className="flex items-center gap-1">
          <Phone size={10} className="text-text-tertiary flex-shrink-0" />
          <input
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            placeholder="Phone"
            className="flex-1 min-w-0 text-[11px] bg-bg-secondary border border-border-default rounded px-1.5 py-0.5 text-text-primary"
          />
        </div>
        <div className="flex items-center gap-1">
          <Mail size={10} className="text-text-tertiary flex-shrink-0" />
          <input
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            placeholder="Email"
            className="flex-1 min-w-0 text-[11px] bg-bg-secondary border border-border-default rounded px-1.5 py-0.5 text-text-primary"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="p-0.5 rounded text-success hover:bg-success/10"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setEditPhone(phone ?? "");
              setEditEmail(email ?? "");
            }}
            className="p-0.5 rounded text-text-tertiary hover:bg-bg-hover"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border-default last:border-0 pb-2 last:pb-0">
      <div className="flex items-center gap-1">
        <p className="text-body-sm text-text-primary font-medium flex-1">{capitalizeName(name)}</p>
        <button
          onClick={() => setEditing(true)}
          className="p-0.5 rounded text-text-tertiary hover:text-nah-blue hover:bg-nah-blue/10 transition-colors"
          title="Edit contact"
        >
          <Pencil size={10} />
        </button>
      </div>
      {phone && (
        <a href={`tel:${phone}`} className="flex items-center gap-1 text-[11px] text-nah-blue hover:underline">
          <Phone size={10} /> {phone}
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          className="flex items-center gap-1 text-[11px] text-nah-blue hover:underline truncate"
        >
          <Mail size={10} /> {email}
        </a>
      )}
    </div>
  );
}
