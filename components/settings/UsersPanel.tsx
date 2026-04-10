"use client";

import { useState, useEffect } from "react";
import { Users, CheckCircle2, XCircle, Loader2, Shield, UserCog } from "lucide-react";

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

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  leadership: { label: "Admin", color: "bg-nah-orange/10 text-nah-orange" },
  rep: { label: "Rep", color: "bg-nah-blue/10 text-nah-blue" },
  marketing: { label: "Marketing", color: "bg-scout-purple/10 text-scout-purple" },
};

export default function UsersPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
        {/* Header */}
        <div className="grid grid-cols-[1fr_120px_100px_100px_120px] gap-2 px-4 py-2 bg-bg-secondary text-caption font-medium text-text-tertiary">
          <span>Name / Email</span>
          <span>Role</span>
          <span>GHL Linked</span>
          <span>Real User</span>
          <span>Last Login</span>
        </div>

        {/* Active users */}
        {activeUsers.map((u) => {
          const role = ROLE_LABELS[u.role] ?? { label: u.role, color: "bg-bg-tertiary text-text-secondary" };
          return (
            <div key={u.id} className="grid grid-cols-[1fr_120px_100px_100px_120px] gap-2 px-4 py-3 border-t border-border-default items-center">
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
                  <CheckCircle2 size={14} className="text-success" />
                ) : (
                  <XCircle size={14} className="text-text-tertiary" />
                )}
              </div>
              <div>
                {u.is_real_user ? (
                  <CheckCircle2 size={14} className="text-success" />
                ) : (
                  <span className="text-[10px] text-text-tertiary">Placeholder</span>
                )}
              </div>
              <span className="text-caption text-text-tertiary">
                {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "Never"}
              </span>
            </div>
          );
        })}

        {/* Inactive users */}
        {inactiveUsers.length > 0 && (
          <>
            <div className="px-4 py-2 bg-bg-tertiary border-t border-border-default">
              <span className="text-caption font-medium text-text-tertiary">Inactive ({inactiveUsers.length})</span>
            </div>
            {inactiveUsers.map((u) => (
              <div key={u.id} className="grid grid-cols-[1fr_120px_100px_100px_120px] gap-2 px-4 py-2 border-t border-border-default items-center opacity-50">
                <div>
                  <p className="text-body-sm text-text-secondary">{u.full_name}</p>
                  <p className="text-caption text-text-tertiary">{u.email}</p>
                </div>
                <span className="text-caption text-text-tertiary">{u.role}</span>
                <div>{u.ghl_user_id ? <CheckCircle2 size={14} className="text-text-tertiary" /> : <XCircle size={14} className="text-text-tertiary" />}</div>
                <div><span className="text-[10px] text-text-tertiary">{u.is_real_user ? "Yes" : "No"}</span></div>
                <span className="text-caption text-text-tertiary">Deactivated</span>
              </div>
            ))}
          </>
        )}
      </div>

      <p className="text-caption text-text-tertiary mt-3">
        Users are managed via Supabase Auth. Contact admin to add or modify users.
      </p>
    </div>
  );
}
