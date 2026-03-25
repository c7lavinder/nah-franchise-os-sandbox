"use client";

import { useState } from "react";
import {
  FileText, ClipboardList, ArrowRight, MessageSquare, Mail, Zap,
  Check, X, Loader2, Send, User, Pencil,
} from "lucide-react";

interface SuggestedAction {
  type: "note" | "task" | "stage_move" | "sms" | "email" | "workflow";
  label: string;
  description: string;
  content: string;
  targetStage?: string;
}

interface ProfileUpdate {
  fieldName: string;
  suggestedValue: string;
  reason: string;
}

interface ActionsTabProps {
  actions: SuggestedAction[];
  profileUpdates: ProfileUpdate[];
  contactId: string;
  callId: string;
}

function actionIcon(type: string) {
  switch (type) {
    case "note": return <FileText size={14} className="text-warning" />;
    case "task": return <ClipboardList size={14} className="text-info" />;
    case "stage_move": return <ArrowRight size={14} className="text-nah-orange" />;
    case "sms": return <MessageSquare size={14} className="text-success" />;
    case "email": return <Mail size={14} className="text-scout-purple" />;
    case "workflow": return <Zap size={14} className="text-warning" />;
    default: return <FileText size={14} className="text-text-tertiary" />;
  }
}

export default function ActionsTab({ actions, profileUpdates, contactId, callId }: ActionsTabProps) {
  const [editedActions, setEditedActions] = useState<Map<number, string>>(new Map());
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<{ action: string; status: string; error?: string }[] | null>(null);

  // Profile update state
  const [editedProfile, setEditedProfile] = useState<Map<number, string>>(new Map());
  const [dismissedProfile, setDismissedProfile] = useState<Set<number>>(new Set());
  const [pushingProfile, setPushingProfile] = useState(false);
  const [profileResults, setProfileResults] = useState<{ field: string; status: string }[] | null>(null);

  function updateContent(index: number, content: string) {
    setEditedActions((prev) => new Map(prev).set(index, content));
  }

  function dismissAction(index: number) {
    setDismissed((prev) => new Set(prev).add(index));
  }

  async function pushToGHL() {
    const activeActions = actions
      .map((action, i) => ({ ...action, index: i }))
      .filter((_, i) => !dismissed.has(i))
      .map((action) => ({
        type: action.type,
        label: action.label,
        content: editedActions.get(action.index) ?? action.content,
        contactId,
        targetStage: action.targetStage,
      }));

    if (activeActions.length === 0) return;

    setExecuting(true);
    try {
      const res = await fetch(`/api/calls/${callId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions: activeActions }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results);
      }
    } catch {
      setResults([{ action: "All", status: "failed", error: "Request failed" }]);
    } finally {
      setExecuting(false);
    }
  }

  async function pushProfileUpdates() {
    const activeUpdates: Record<string, string> = {};
    profileUpdates.forEach((update, i) => {
      if (!dismissedProfile.has(i)) {
        activeUpdates[update.fieldName] = editedProfile.get(i) ?? update.suggestedValue;
      }
    });

    if (Object.keys(activeUpdates).length === 0) return;

    setPushingProfile(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: activeUpdates }),
      });
      if (res.ok) {
        setProfileResults(
          Object.keys(activeUpdates).map((f) => ({ field: f, status: "success" }))
        );
      } else {
        setProfileResults(
          Object.keys(activeUpdates).map((f) => ({ field: f, status: "failed" }))
        );
      }
    } catch {
      setProfileResults([{ field: "All", status: "failed" }]);
    } finally {
      setPushingProfile(false);
    }
  }

  const hasNoContent = actions.length === 0 && profileUpdates.length === 0;

  if (hasNoContent) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-body-sm text-text-tertiary">
          No actions suggested — grade a call to see AI-generated next steps
        </p>
      </div>
    );
  }

  const activeActionCount = actions.length - dismissed.size;
  const activeProfileCount = profileUpdates.length - dismissedProfile.size;

  return (
    <div className="px-4 py-4 space-y-6">
      {/* === SUGGESTED ACTIONS === */}
      {actions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-h2 text-text-primary">Suggested Actions</h3>
            <span className="text-caption text-text-tertiary">{activeActionCount} actions</span>
          </div>

          {results ? (
            <div className="space-y-2">
              {results.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                  r.status === "success" ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5"
                }`}>
                  {r.status === "success" ? <Check size={14} className="text-success" /> : <X size={14} className="text-danger" />}
                  <span className="text-body-sm text-text-primary">{r.action}</span>
                  {r.error && <span className="text-caption text-danger ml-auto">{r.error}</span>}
                </div>
              ))}
            </div>
          ) : (
            <>
              {actions.map((action, i) => {
                if (dismissed.has(i)) return null;
                const content = editedActions.get(i) ?? action.content;

                return (
                  <div key={i} className="border border-border-default rounded-lg bg-bg-secondary">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border-default">
                      {actionIcon(action.type)}
                      <span className="text-body-sm font-medium text-text-primary flex-1">{action.label}</span>
                      <span className="px-1.5 py-0.5 rounded text-[11px] text-text-tertiary bg-bg-tertiary">
                        {action.type}
                      </span>
                      <button onClick={() => dismissAction(i)} className="p-1 text-text-tertiary hover:text-danger">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="px-3 py-2">
                      <p className="text-caption text-text-tertiary mb-1">{action.description}</p>
                      <textarea
                        value={content}
                        onChange={(e) => updateContent(i, e.target.value)}
                        className="w-full bg-bg-primary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary focus:border-nah-orange focus:outline-none resize-none"
                        rows={2}
                      />
                      {action.targetStage && (
                        <p className="text-caption text-nah-orange mt-1">Move to: {action.targetStage}</p>
                      )}
                    </div>
                  </div>
                );
              })}

              {activeActionCount > 0 && (
                <button
                  onClick={pushToGHL}
                  disabled={executing}
                  className="w-full btn-primary px-4 py-3 text-body-sm font-medium flex items-center justify-center gap-2 rounded-lg"
                >
                  {executing ? (
                    <><Loader2 size={16} className="animate-spin" /> Pushing to GHL...</>
                  ) : (
                    <><Send size={16} /> Push {activeActionCount} Actions to GHL</>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* === PROFILE UPDATES === */}
      {profileUpdates.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <User size={16} className="text-scout-purple" />
            <h3 className="text-h2 text-text-primary">Profile Updates</h3>
            <span className="text-caption text-text-tertiary ml-auto">{activeProfileCount} fields</span>
          </div>
          <p className="text-caption text-text-tertiary">
            Scout detected these profile fields from the call. Review and push to update the candidate profile.
          </p>

          {profileResults ? (
            <div className="space-y-2">
              {profileResults.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                  r.status === "success" ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5"
                }`}>
                  {r.status === "success" ? <Check size={14} className="text-success" /> : <X size={14} className="text-danger" />}
                  <span className="text-body-sm text-text-primary">{r.field}</span>
                </div>
              ))}
            </div>
          ) : (
            <>
              {profileUpdates.map((update, i) => {
                if (dismissedProfile.has(i)) return null;
                const value = editedProfile.get(i) ?? update.suggestedValue;

                return (
                  <div key={i} className="flex items-start gap-3 px-3 py-2.5 border border-border-default rounded-lg bg-bg-secondary">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-body-sm font-medium text-text-primary">{update.fieldName}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-scout-purple/10 text-scout-purple">
                          Scout AI
                        </span>
                      </div>
                      <p className="text-caption text-text-tertiary mt-0.5">{update.reason}</p>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => setEditedProfile((prev) => new Map(prev).set(i, e.target.value))}
                        className="mt-1.5 w-full bg-bg-primary border border-border-default rounded-md px-2.5 py-1.5 text-body-sm text-text-primary focus:border-scout-purple focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={() => setDismissedProfile((prev) => new Set(prev).add(i))}
                      className="p-1 text-text-tertiary hover:text-danger flex-shrink-0 mt-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}

              {activeProfileCount > 0 && (
                <button
                  onClick={pushProfileUpdates}
                  disabled={pushingProfile}
                  className="w-full px-4 py-3 text-body-sm font-medium flex items-center justify-center gap-2 rounded-lg bg-scout-purple/10 border border-scout-purple/30 text-scout-purple hover:bg-scout-purple/20 transition-colors"
                >
                  {pushingProfile ? (
                    <><Loader2 size={16} className="animate-spin" /> Updating Profile...</>
                  ) : (
                    <><Pencil size={16} /> Update {activeProfileCount} Profile Fields</>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
