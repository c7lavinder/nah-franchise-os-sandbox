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
} from "lucide-react";
import { apiFetch } from "@/lib/auth/api-fetch";
import { titleCase, capitalizeName } from "@/lib/format/contact";
import SubTaskCircle from "@/components/contact/SubTaskCircle";
import SubTaskLogModal from "@/components/contact/SubTaskLogModal";
import { computeSubTaskVisualState } from "@/lib/contacts/stage-visual-state";
import type { PipelineSubTask, SubTaskLog } from "@/lib/contacts/pipeline-state";
import { useToast } from "@/components/ui/Toast";

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
  const [logModalTask, setLogModalTask] = useState<PipelineSubTask | null>(null);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  const identifier = ghlContactId ?? contactId;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // All fetches in parallel
      const [stateRes, pendingRes, usersRes, membersRes, aptRes] = await Promise.all([
        apiFetch(`/api/contacts/${identifier}/pipeline-state`),
        ghlContactId ? apiFetch(`/api/workflows/pending-steps?ghl_contact_id=${ghlContactId}`) : Promise.resolve(null),
        apiFetch("/api/pipeline/users"),
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
          const stage = (matchingState.stages ?? []).find((s: StageData) => s.id === stageId);
          if (stage) setCurrentStage(stage);
        }
      }

      // Pending workflow steps
      if (pendingRes?.ok) {
        const d = await pendingRes.json();
        setPendingSteps((d.pendingSteps ?? []).slice(0, 5));
      }

      // Users
      if (usersRes.ok) {
        const d = await usersRes.json();
        setUsers(d.users ?? []);
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

  async function handleAdvance() {
    if (!pipelineId) return;
    setActing(true);
    try {
      const res = await apiFetch(`/api/contacts/${identifier}/pipelines/${pipelineId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
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

  function handleLogSuccess() {
    setLogModalTask(null);
    void fetchData();
    onRefresh();
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
                    onClick={() => setLogModalTask(task)}
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
                <div key={m.contactId} className="border-b border-border-default last:border-0 pb-2 last:pb-0">
                  <p className="text-body-sm text-text-primary font-medium">{capitalizeName(m.name)}</p>
                  {m.phone && (
                    <a
                      href={`tel:${m.phone}`}
                      className="flex items-center gap-1 text-[11px] text-nah-blue hover:underline"
                    >
                      <Phone size={10} /> {m.phone}
                    </a>
                  )}
                  {m.email && (
                    <a
                      href={`mailto:${m.email}`}
                      className="flex items-center gap-1 text-[11px] text-nah-blue hover:underline truncate"
                    >
                      <Mail size={10} /> {m.email}
                    </a>
                  )}
                </div>
              ))
            ) : (
              /* Fallback to row data when no journey members returned */
              <div>
                <p className="text-body-sm text-text-primary font-medium">{capitalizeName(contactName)}</p>
                {contactPhone && (
                  <a
                    href={`tel:${contactPhone}`}
                    className="flex items-center gap-1 text-[11px] text-nah-blue hover:underline"
                  >
                    <Phone size={10} /> {contactPhone}
                  </a>
                )}
                {contactEmail && (
                  <a
                    href={`mailto:${contactEmail}`}
                    className="flex items-center gap-1 text-[11px] text-nah-blue hover:underline truncate"
                  >
                    <Mail size={10} /> {contactEmail}
                  </a>
                )}
              </div>
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

      {/* Sub-task log modal */}
      {logModalTask && (
        <SubTaskLogModal
          contactId={contactId}
          subTaskId={logModalTask.id}
          subTaskName={logModalTask.name}
          stateType={logModalTask.state_type}
          firstStateLabel={logModalTask.first_state_label}
          secondStateLabel={logModalTask.second_state_label}
          defaultLoggerUserId={logModalTask.default_logger_user_id ?? null}
          defaultLoggerName={users.find((u) => u.id === logModalTask.default_logger_user_id)?.name ?? null}
          users={users}
          existingLogs={logsBySubTask[logModalTask.id] ?? []}
          onClose={() => setLogModalTask(null)}
          onSuccess={handleLogSuccess}
          onLogDeleted={() => {
            void fetchData();
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
