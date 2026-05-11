"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * EcosystemPanel — org-chart style visualization of territory stakeholders.
 * Owner at center, stakeholders in orbital rings by role category.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Loader2,
  Briefcase,
  Home,
  Scale,
  Users,
  Wrench,
  Heart,
  HandshakeIcon,
  ChevronDown,
  X,
  Badge,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface Stakeholder {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string;
  notes: string | null;
  contact_id: string | null;
}

interface Owner {
  ownerName: string | null;
  contactId: string | null;
  ghlContactId: string | null;
  role?: string;
  start_date?: string | null;
}

const ROLES = [
  { value: "employee", label: "Employee", icon: Badge, color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { value: "contractor", label: "Contractor", icon: Wrench, color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "agent", label: "Agent", icon: Briefcase, color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "lender", label: "Lender", icon: Home, color: "bg-teal-100 text-teal-700 border-teal-200" },
  { value: "partner", label: "Partner", icon: HandshakeIcon, color: "bg-green-100 text-green-700 border-green-200" },
  { value: "lawyer", label: "Lawyer", icon: Scale, color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "family", label: "Family", icon: Heart, color: "bg-pink-100 text-pink-700 border-pink-200" },
  { value: "other", label: "Other", icon: Users, color: "bg-gray-100 text-gray-600 border-gray-200" },
];

const ROLE_MAP = new Map(ROLES.map((r) => [r.value, r]));

interface Props {
  TerritorySlug: string;
  owner: Owner | null;
  /** All core owners (primary + co_primary). Falls back to [owner] for
   *  backward-compat when callers haven't migrated yet. */
  owners?: Owner[] | null;
}

export default function EcosystemPanel({ TerritorySlug, owner, owners }: Props) {
  const ownerList: Owner[] = owners && owners.length > 0 ? owners : owner ? [owner] : [];
  const { toast } = useToast();
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company: "",
    role: "agent",
    notes: "",
  });

  const fetchStakeholders = useCallback(async () => {
    const res = await apiFetch(`/api/territories/${TerritorySlug}/stakeholders`);
    if (res.ok) {
      const d = await res.json();
      setStakeholders(d.stakeholders ?? []);
    }
    setLoading(false);
  }, [TerritorySlug]);

  useEffect(() => {
    void fetchStakeholders();
  }, [fetchStakeholders]);

  async function handleAdd() {
    if (!form.first_name.trim() && !form.last_name.trim()) return;
    setSaving(true);
    const res = await apiFetch(`/api/territories/${TerritorySlug}/stakeholders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      toast("Stakeholder added");
      setShowForm(false);
      setForm({ first_name: "", last_name: "", email: "", phone: "", company: "", role: "agent", notes: "" });
      await fetchStakeholders();
    }
    setSaving(false);
  }

  async function handleRemove(id: string) {
    const res = await apiFetch(`/api/territories/${TerritorySlug}/stakeholders`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      toast("Removed");
      await fetchStakeholders();
    }
  }

  // Group stakeholders by role
  const grouped = new Map<string, Stakeholder[]>();
  for (const s of stakeholders) {
    const arr = grouped.get(s.role) ?? [];
    arr.push(s);
    grouped.set(s.role, arr);
  }

  return (
    <div className="space-y-6">
      {/* Ecosystem Circle — Owner(s) at center, roles in orbit */}
      <div className="relative bg-bg-primary border border-border-default rounded-xl p-6">
        <div className="flex flex-col items-center">
          {/* Owner(s) — center node(s), side-by-side for co-owners */}
          {ownerList.length === 0 ? (
            <div className="relative z-10 flex flex-col items-center mb-6">
              <div className="w-20 h-20 rounded-full bg-bg-secondary border-2 border-border-default flex items-center justify-center">
                <span className="text-xl font-bold text-text-tertiary">—</span>
              </div>
              <p className="text-body-sm font-semibold text-text-tertiary mt-2">No Owner</p>
            </div>
          ) : (
            <div className="relative z-10 flex flex-wrap justify-center gap-4 mb-6">
              {ownerList.map((o, i) => {
                const name = o.ownerName ?? "—";
                const initials = name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                const isCoPrimary = o.role === "co_primary";
                return (
                  <div key={`${o.ghlContactId ?? i}-${o.role ?? "owner"}`} className="flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full bg-nah-orange/10 border-2 border-nah-orange flex items-center justify-center shadow-lg">
                      <span className="text-xl font-bold text-nah-orange">{initials}</span>
                    </div>
                    <p className="text-body-sm font-semibold text-text-primary mt-2">{name}</p>
                    <span className="text-[10px] font-medium text-nah-orange tracking-wider">
                      {isCoPrimary ? "CO-OWNER" : "OWNER"}
                    </span>
                    {o.start_date && (
                      <span className="text-[10px] text-text-tertiary mt-0.5">
                        Since{" "}
                        {new Date(o.start_date + "T00:00:00").toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    )}
                    {(o.contactId || o.ghlContactId) && (
                      <Link
                        href={`/contacts/${o.contactId ?? o.ghlContactId}`}
                        className="text-[10px] text-nah-blue hover:underline mt-0.5"
                      >
                        View profile
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Connector line */}
          {stakeholders.length > 0 && <div className="w-0.5 h-6 bg-border-default -mt-2 mb-2" />}

          {/* Stakeholder orbital rings — grouped by role */}
          {stakeholders.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
              {ROLES.map((roleDef) => {
                const members = grouped.get(roleDef.value);
                if (!members || members.length === 0) return null;
                const Icon = roleDef.icon;
                return (
                  <div key={roleDef.value} className="flex flex-col items-center">
                    {/* Role label */}
                    <div
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border mb-2 ${roleDef.color}`}
                    >
                      <Icon size={10} />
                      {roleDef.label}
                    </div>
                    {/* Members */}
                    <div className="flex flex-wrap justify-center gap-2">
                      {members.map((s) => {
                        const name = [s.first_name, s.last_name].filter(Boolean).join(" ") || "—";
                        const initials = name
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase();
                        const avatar = (
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold border transition-transform ${roleDef.color} ${s.contact_id ? "hover:scale-105 cursor-pointer" : ""}`}
                          >
                            {initials}
                          </div>
                        );
                        return (
                          <div key={s.id} className="group relative flex flex-col items-center">
                            {s.contact_id ? <Link href={`/contacts/${s.contact_id}`}>{avatar}</Link> : avatar}
                            <p className="text-[10px] text-text-primary font-medium mt-1 max-w-[80px] truncate text-center">
                              {name}
                            </p>
                            {s.company && (
                              <p className="text-[9px] text-text-tertiary max-w-[80px] truncate text-center">
                                {s.company}
                              </p>
                            )}
                            {/* Delete on hover */}
                            <button
                              onClick={() => void handleRemove(s.id)}
                              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-danger text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={8} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {stakeholders.length === 0 && !loading && (
            <p className="text-caption text-text-tertiary py-4">
              No ecosystem stakeholders yet. Add agents, contractors, partners, and more.
            </p>
          )}

          {loading && <Loader2 size={18} className="animate-spin text-text-tertiary my-4" />}
        </div>
      </div>

      {/* Stakeholder List — detailed view */}
      {stakeholders.length > 0 && (
        <div className="border border-border-default rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-bg-secondary text-caption font-medium text-text-tertiary grid grid-cols-[1fr_100px_120px_120px_32px] gap-2">
            <span>Name / Company</span>
            <span>Role</span>
            <span>Phone</span>
            <span>Email</span>
            <span></span>
          </div>
          {stakeholders.map((s) => {
            const name = [s.first_name, s.last_name].filter(Boolean).join(" ") || "—";
            const roleDef = ROLE_MAP.get(s.role);
            return (
              <div
                key={s.id}
                className="grid grid-cols-[1fr_100px_120px_120px_32px] gap-2 px-4 py-2.5 border-t border-border-default items-center hover:bg-bg-hover/30 transition-colors"
              >
                <div>
                  {s.contact_id ? (
                    <Link
                      href={`/contacts/${s.contact_id}`}
                      className="text-body-sm font-medium text-text-primary hover:text-nah-blue hover:underline"
                    >
                      {name}
                    </Link>
                  ) : (
                    <p className="text-body-sm font-medium text-text-primary">{name}</p>
                  )}
                  {s.company && <p className="text-[10px] text-text-tertiary">{s.company}</p>}
                  {s.notes && <p className="text-[10px] text-text-tertiary italic">{s.notes}</p>}
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium w-fit border ${roleDef?.color ?? "bg-gray-100 text-gray-600 border-gray-200"}`}
                >
                  {roleDef?.label ?? s.role}
                </span>
                <span className="text-caption text-text-secondary truncate">{s.phone ?? "—"}</span>
                <span className="text-caption text-text-secondary truncate">{s.email ?? "—"}</span>
                <button
                  onClick={() => void handleRemove(s.id)}
                  className="p-1 text-text-tertiary hover:text-danger transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add form */}
      {showForm ? (
        <div className="border border-border-default rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-body-sm font-medium text-text-primary">Add Stakeholder</h4>
            <button onClick={() => setShowForm(false)} className="text-text-tertiary hover:text-text-primary">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              placeholder="First name"
              className="bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm"
            />
            <input
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              placeholder="Last name"
              className="bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm"
            />
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              className="bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm"
            />
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Phone"
              className="bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm"
            />
            <input
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              placeholder="Company"
              className="bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm"
            />
            <div className="relative">
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm appearance-none pr-8"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
              />
            </div>
          </div>
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notes (optional)"
            className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-body-sm"
          />
          <button
            onClick={() => void handleAdd()}
            disabled={saving || (!form.first_name.trim() && !form.last_name.trim())}
            className="btn-primary text-body-sm px-4 py-2 flex items-center gap-1 disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add to Ecosystem
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-caption text-nah-blue hover:text-blue-700 transition-colors"
        >
          <Plus size={14} /> Add stakeholder
        </button>
      )}
    </div>
  );
}
