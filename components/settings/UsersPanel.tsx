"use client";

import { useState, useEffect } from "react";
import { Users, CheckCircle2, XCircle, Loader2, Shield, UserCog, Pencil, Save, X } from "lucide-react";

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  ghl_user_id: string | null;
  is_active: boolean;
  is_real_user: boolean;
  last_login_at: string | null;
  created_at: string;
}

const ROLE_OPTIONS = [
  { value: "leadership", label: "Admin" },
  { value: "rep", label: "Rep" },
  { value: "marketing", label: "Marketing" },
];

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  leadership: { label: "Admin", color: "bg-nah-orange/10 text-nah-orange" },
  rep: { label: "Rep", color: "bg-nah-blue/10 text-nah-blue" },
  marketing: { label: "Marketing", color: "bg-scout-purple/10 text-scout-purple" },
};

export default function UsersPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<UserRow>>({});
  const [saving, setSaving] = useState(false);

  async function fetchUsers() {
    const res = await fetch("/api/settings/users");
    if (res.ok) {
      const d = await res.json();
      setUsers(d.users ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { void fetchUsers(); }, []);

  function startEdit(u: UserRow) {
    setEditingId(u.id);
    setDraft({ full_name: u.full_name, role: u.role, ghl_user_id: u.ghl_user_id ?? "", is_active: u.is_active });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({});
  }

  async function saveEdit(id: string) {
    setSaving(true);
    const res = await fetch("/api/settings/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...draft, ghl_user_id: draft.ghl_user_id || null }),
    });
    if (res.ok) {
      setEditingId(null);
      setDraft({});
      await fetchUsers();
    }
    setSaving(false);
  }

  async function toggleActive(u: UserRow) {
    await fetch("/api/settings/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, is_active: !u.is_active }),
    });
    await fetchUsers();
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin text-text-tertiary" /></div>;
  }

  const activeUsers = users.filter((u) => u.is_active);
  const inactiveUsers = users.filter((u) => !u.is_active);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Users size={16} className="text-text-secondary" />
        <h2 className="text-h3 text-text-primary">Team Members</h2>
        <span className="text-caption text-text-tertiary ml-2">{activeUsers.length} active</span>
      </div>

      <div className="border border-border-default rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_100px_140px_100px_80px] gap-2 px-4 py-2 bg-bg-secondary text-caption font-medium text-text-tertiary">
          <span>Name / Email</span>
          <span>Role</span>
          <span>GHL User ID</span>
          <span>Last Login</span>
          <span></span>
        </div>

        {activeUsers.map((u) => {
          const isEditing = editingId === u.id;
          const role = ROLE_LABELS[u.role] ?? { label: u.role, color: "bg-bg-tertiary text-text-secondary" };

          if (isEditing) {
            return (
              <div key={u.id} className="grid grid-cols-[1fr_100px_140px_100px_80px] gap-2 px-4 py-3 border-t border-border-default items-center bg-nah-blue/5">
                <div>
                  <input
                    value={draft.full_name ?? ""}
                    onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                    className="w-full bg-bg-secondary border border-border-default rounded px-2 py-1 text-body-sm text-text-primary mb-1"
                  />
                  <p className="text-caption text-text-tertiary">{u.email}</p>
                </div>
                <select
                  value={draft.role ?? ""}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                  className="bg-bg-secondary border border-border-default rounded px-2 py-1 text-body-sm text-text-primary"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <input
                  value={(draft.ghl_user_id as string) ?? ""}
                  onChange={(e) => setDraft({ ...draft, ghl_user_id: e.target.value })}
                  placeholder="GHL ID..."
                  className="bg-bg-secondary border border-border-default rounded px-2 py-1 text-body-sm text-text-primary font-mono text-[11px]"
                />
                <span className="text-caption text-text-tertiary">
                  {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "Never"}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => void saveEdit(u.id)} disabled={saving} className="p-1.5 text-success hover:bg-success/10 rounded transition-colors">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  </button>
                  <button onClick={cancelEdit} className="p-1.5 text-text-tertiary hover:bg-bg-hover rounded transition-colors">
                    <X size={13} />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={u.id} className="grid grid-cols-[1fr_100px_140px_100px_80px] gap-2 px-4 py-3 border-t border-border-default items-center hover:bg-bg-hover/30 transition-colors">
              <div>
                <p className="text-body-sm font-medium text-text-primary">{u.full_name}</p>
                <p className="text-caption text-text-tertiary">{u.email}</p>
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium w-fit ${role.color}`}>
                {u.role === "leadership" ? <Shield size={10} /> : <UserCog size={10} />}
                {role.label}
              </span>
              <div>
                {u.ghl_user_id ? (
                  <span className="text-[11px] font-mono text-text-secondary truncate block max-w-[130px]">{u.ghl_user_id}</span>
                ) : (
                  <XCircle size={14} className="text-text-tertiary" />
                )}
              </div>
              <span className="text-caption text-text-tertiary">
                {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "Never"}
              </span>
              <div className="flex gap-1">
                <button onClick={() => startEdit(u)} className="p-1.5 text-text-tertiary hover:text-nah-blue hover:bg-nah-blue/10 rounded transition-colors" title="Edit">
                  <Pencil size={13} />
                </button>
                <button onClick={() => void toggleActive(u)} className="p-1.5 text-text-tertiary hover:text-danger hover:bg-danger/10 rounded transition-colors" title="Deactivate">
                  <XCircle size={13} />
                </button>
              </div>
            </div>
          );
        })}

        {inactiveUsers.length > 0 && (
          <>
            <div className="px-4 py-2 bg-bg-tertiary border-t border-border-default">
              <span className="text-caption font-medium text-text-tertiary">Inactive ({inactiveUsers.length})</span>
            </div>
            {inactiveUsers.map((u) => (
              <div key={u.id} className="grid grid-cols-[1fr_100px_140px_100px_80px] gap-2 px-4 py-2 border-t border-border-default items-center opacity-50">
                <div>
                  <p className="text-body-sm text-text-secondary">{u.full_name}</p>
                  <p className="text-caption text-text-tertiary">{u.email}</p>
                </div>
                <span className="text-caption text-text-tertiary">{u.role}</span>
                <div>{u.ghl_user_id ? <CheckCircle2 size={14} className="text-text-tertiary" /> : <XCircle size={14} className="text-text-tertiary" />}</div>
                <span className="text-caption text-text-tertiary">Deactivated</span>
                <button onClick={() => void toggleActive(u)} className="p-1.5 text-text-tertiary hover:text-success hover:bg-success/10 rounded transition-colors w-fit" title="Reactivate">
                  <CheckCircle2 size={13} />
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
