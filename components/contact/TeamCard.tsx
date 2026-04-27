"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * TeamCard — internal NAH team members on a contact. Auto-derived + manual add/remove.
 */

import { useState, useEffect, useCallback } from "react";
import { Users, Loader2, Plus, Trash2 } from "lucide-react";
import { capitalizeName } from "@/lib/format/contact";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  isManual: boolean;
}

interface AvailableUser {
  id: string;
  name: string;
  role: string;
}

interface TeamCardProps {
  contactId: string;
}

export default function TeamCard({ contactId }: TeamCardProps) {
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<AvailableUser[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/contacts/${contactId}/team`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.team ?? []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [contactId]);

  useEffect(() => { void fetchTeam(); }, [fetchTeam]);

  useEffect(() => {
    apiFetch("/api/pipeline/users")
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) => setAllUsers(d.users ?? []))
      .catch(() => {});
  }, []);

  async function handleAdd(userId: string) {
    setShowAdd(false);
    const res = await apiFetch(`/api/contacts/${contactId}/team`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) { toast("Team member added"); await fetchTeam(); }
  }

  async function handleRemove(userId: string) {
    setRemoveId(null);
    const res = await apiFetch(`/api/contacts/${contactId}/team`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) { toast("Team member removed"); await fetchTeam(); }
  }

  const memberIds = new Set(members.map((m) => m.id));
  const addableUsers = allUsers.filter((u) => !memberIds.has(u.id));

  if (loading) return <div className="flex items-center justify-center py-3"><Loader2 size={14} className="animate-spin text-text-tertiary" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Users size={14} className="text-text-tertiary" />
          <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider">TEAM ({members.length})</h3>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="text-caption text-nah-blue hover:underline flex items-center gap-0.5">
          <Plus size={11} /> Add
        </button>
      </div>

      {showAdd && (
        <div className="mb-2 bg-bg-secondary border border-border-default rounded-lg p-2 max-h-[150px] overflow-y-auto">
          {addableUsers.length === 0 ? (
            <p className="text-caption text-text-tertiary py-1">All users already on team</p>
          ) : (
            addableUsers.map((u) => (
              <button key={u.id} onClick={() => void handleAdd(u.id)}
                className="w-full text-left px-2 py-1.5 text-caption text-text-primary hover:bg-bg-hover rounded transition-colors">
                {capitalizeName(u.name)}
              </button>
            ))
          )}
        </div>
      )}

      {members.length === 0 ? (
        <p className="text-caption text-text-tertiary">No team members assigned</p>
      ) : (
        <div className="space-y-1.5">
          {members.map((m) => {
            const name = capitalizeName(m.name);
            const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
            return (
              <div key={m.id} className="flex items-center gap-2.5 py-1 group">
                <div className="w-7 h-7 rounded-full bg-scout-purple/10 text-scout-purple flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-caption font-medium text-text-primary truncate block">{name}</span>
                </div>
                <span className="text-[9px] px-1 py-0.5 rounded bg-text-tertiary/10 text-text-tertiary uppercase">
                  {m.role === "leadership" ? "Admin" : m.role}
                </span>
                <button onClick={() => setRemoveId(m.id)}
                  className="p-0.5 rounded hover:bg-danger/10 text-text-tertiary hover:text-danger opacity-0 group-hover:opacity-100">
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {removeId && (
        <ConfirmModal title="Remove team member" body="Remove this team member from this contact?" destructive confirmLabel="Remove"
          onConfirm={() => void handleRemove(removeId)} onCancel={() => setRemoveId(null)} />
      )}
    </div>
  );
}
