"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, CheckCircle2, XCircle, Loader2, Shield, UserCog, Pencil, Save, X, Copy, Check, Eye, EyeOff, Key } from "lucide-react";

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  ghl_user_id: string | null;
  label_color: string | null;
  is_active: boolean;
  is_real_user: boolean;
  last_login_at: string | null;
  created_at: string;
}

interface ReadAIKey {
  user_email: string;
  signing_key_masked: string;
  signing_key_full: string;
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

/** Small inline component — masked key with copy + reveal */
function SigningKeyCell({ keyData, email }: { keyData: ReadAIKey | undefined; email: string }) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  if (!keyData) {
    return <span className="text-[11px] text-text-tertiary italic">No key</span>;
  }

  const displayText = revealed ? keyData.signing_key_full : keyData.signing_key_masked;

  function handleCopy() {
    void navigator.clipboard.writeText(keyData!.signing_key_full).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex items-center gap-1 min-w-0">
      <span className="text-[11px] font-mono text-text-secondary truncate" title={email}>
        {displayText}
      </span>
      <button
        onClick={() => setRevealed(!revealed)}
        className="p-0.5 text-text-tertiary hover:text-text-secondary transition-colors shrink-0"
        title={revealed ? "Hide" : "Reveal"}
      >
        {revealed ? <EyeOff size={11} /> : <Eye size={11} />}
      </button>
      <button
        onClick={handleCopy}
        className="p-0.5 text-text-tertiary hover:text-nah-blue transition-colors shrink-0"
        title="Copy key"
      >
        {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
      </button>
    </div>
  );
}

export default function UsersPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [readAIKeys, setReadAIKeys] = useState<ReadAIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<UserRow>>({});
  const [saving, setSaving] = useState(false);

  const fetchReadAIKeys = useCallback(async () => {
    const res = await fetch("/api/settings/read-ai-keys");
    if (res.ok) {
      const d = await res.json();
      setReadAIKeys(d.keys ?? []);
    }
  }, []);

  async function fetchUsers() {
    const res = await fetch("/api/settings/users");
    if (res.ok) {
      const d = await res.json();
      setUsers(d.users ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { void fetchUsers(); void fetchReadAIKeys(); }, [fetchReadAIKeys]);

  function getKeyForEmail(email: string): ReadAIKey | undefined {
    return readAIKeys.find((k) => k.user_email === email.toLowerCase());
  }

  function startEdit(u: UserRow) {
    setEditingId(u.id);
    setDraft({ full_name: u.full_name, role: u.role, ghl_user_id: u.ghl_user_id ?? "", label_color: u.label_color ?? "#6B7280", is_active: u.is_active });
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
      body: JSON.stringify({ id, ...draft, ghl_user_id: draft.ghl_user_id || null, label_color: draft.label_color || null }),
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
        <div className="grid grid-cols-[1fr_40px_100px_140px_160px_100px_80px] gap-2 px-4 py-2 bg-bg-secondary text-caption font-medium text-text-tertiary">
          <span>Name / Email</span>
          <span>Color</span>
          <span>Role</span>
          <span>GHL User ID</span>
          <span className="flex items-center gap-1"><Key size={10} /> Read.ai Key</span>
          <span>Last Login</span>
          <span></span>
        </div>

        {activeUsers.map((u) => {
          const isEditing = editingId === u.id;
          const role = ROLE_LABELS[u.role] ?? { label: u.role, color: "bg-bg-tertiary text-text-secondary" };

          if (isEditing) {
            return (
              <div key={u.id} className="grid grid-cols-[1fr_40px_100px_140px_160px_100px_80px] gap-2 px-4 py-3 border-t border-border-default items-center bg-nah-blue/5">
                <div>
                  <input
                    value={draft.full_name ?? ""}
                    onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                    className="w-full bg-bg-secondary border border-border-default rounded px-2 py-1 text-body-sm text-text-primary mb-1"
                  />
                  <p className="text-caption text-text-tertiary">{u.email}</p>
                </div>
                <input
                  type="color"
                  value={(draft.label_color as string) ?? "#6B7280"}
                  onChange={(e) => setDraft({ ...draft, label_color: e.target.value })}
                  className="w-7 h-7 rounded border border-border-default cursor-pointer p-0"
                  title="Label color"
                />
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
                <SigningKeyCell keyData={getKeyForEmail(u.email)} email={u.email} />
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
            <div key={u.id} className="grid grid-cols-[1fr_40px_100px_140px_160px_100px_80px] gap-2 px-4 py-3 border-t border-border-default items-center hover:bg-bg-hover/30 transition-colors">
              <div>
                <p className="text-body-sm font-medium text-text-primary">{u.full_name}</p>
                <p className="text-caption text-text-tertiary">{u.email}</p>
              </div>
              <div
                className="w-5 h-5 rounded-full border border-border-default"
                style={{ backgroundColor: u.label_color ?? "#6B7280" }}
                title={u.label_color ?? "No color set"}
              />
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
              <SigningKeyCell keyData={getKeyForEmail(u.email)} email={u.email} />
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
              <div key={u.id} className="grid grid-cols-[1fr_40px_100px_140px_160px_100px_80px] gap-2 px-4 py-2 border-t border-border-default items-center opacity-50">
                <div>
                  <p className="text-body-sm text-text-secondary">{u.full_name}</p>
                  <p className="text-caption text-text-tertiary">{u.email}</p>
                </div>
                <div
                  className="w-5 h-5 rounded-full border border-border-default opacity-50"
                  style={{ backgroundColor: u.label_color ?? "#6B7280" }}
                />
                <span className="text-caption text-text-tertiary">{u.role}</span>
                <div>{u.ghl_user_id ? <CheckCircle2 size={14} className="text-text-tertiary" /> : <XCircle size={14} className="text-text-tertiary" />}</div>
                <span className="text-[11px] text-text-tertiary">—</span>
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
