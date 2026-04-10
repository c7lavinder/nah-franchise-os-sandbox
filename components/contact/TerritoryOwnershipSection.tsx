"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ExternalLink, Plus, ArrowRightLeft } from "lucide-react";

interface TerritoryOwnership {
  ms_slug: string;
  role: string;
  start_date: string;
  end_date: string | null;
  territories: { ms_slug: string; territory_name: string; status: string } | null;
}

interface TerritoryOption {
  ms_slug: string;
  territory_name: string;
}

interface Props {
  contactId: string;
  ghlContactId?: string;
}

export default function TerritoryOwnershipSection({ contactId, ghlContactId }: Props) {
  const router = useRouter();
  const [current, setCurrent] = useState<TerritoryOwnership[]>([]);
  const [former, setFormer] = useState<TerritoryOwnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  // Assign modal state
  const [showAssign, setShowAssign] = useState(false);
  const [territories, setTerritories] = useState<TerritoryOption[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [assignRole, setAssignRole] = useState<"owner" | "co-owner">("owner");
  const [assigning, setAssigning] = useState(false);

  // Transfer modal state
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferSlug, setTransferSlug] = useState("");
  const [transferContactSearch, setTransferContactSearch] = useState("");
  const [transferContactId, setTransferContactId] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [transferring, setTransferring] = useState(false);

  const fetchOwnership = useCallback(() => {
    setLoading(true);
    fetch(`/api/contacts/${contactId}/territories`)
      .then((r) => r.json())
      .then((d) => {
        setCurrent(d.current ?? []);
        setFormer(d.former ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [contactId]);

  useEffect(() => {
    fetchOwnership();
  }, [fetchOwnership]);

  function handleAssignOpen() {
    setShowAssign(true);
    // Fetch available territories
    fetch("/api/territories?status=active")
      .then((r) => r.json())
      .then((d) => setTerritories(d.territories ?? []))
      .catch(() => {});
  }

  async function handleAssign() {
    if (!selectedSlug || !ghlContactId) return;
    setAssigning(true);
    const res = await fetch("/api/territory-owners/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ms_slug: selectedSlug, ghl_contact_id: ghlContactId, role: assignRole }),
    });
    setAssigning(false);
    if (res.ok) {
      setShowAssign(false);
      setSelectedSlug("");
      fetchOwnership();
    }
  }

  async function handleTransfer() {
    if (!transferSlug || !transferContactId) return;
    setTransferring(true);
    const res = await fetch("/api/territory-owners/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ms_slug: transferSlug,
        new_ghl_contact_id: transferContactId,
        transfer_notes: transferNotes || undefined,
      }),
    });
    setTransferring(false);
    if (res.ok) {
      setShowTransfer(false);
      setTransferSlug("");
      setTransferContactId("");
      setTransferContactSearch("");
      setTransferNotes("");
      fetchOwnership();
    }
  }

  if (loading) return null;

  const allTabs = [
    ...current.map((t) => ({ ...t, isCurrent: true })),
    ...former.map((t) => ({ ...t, isCurrent: false })),
  ];

  const active = allTabs[activeTab];

  return (
    <div className="border border-border-default rounded-lg overflow-hidden mt-4">
      <div className="flex items-center gap-2 px-4 py-3 bg-bg-secondary">
        <MapPin size={16} className="text-info" />
        <span className="text-body-sm font-medium text-text-primary">Territory Ownership</span>
        <div className="ml-auto flex items-center gap-1.5">
          {ghlContactId && (
            <button onClick={handleAssignOpen} className="btn-ghost p-1.5" title="Assign Territory">
              <Plus size={14} />
            </button>
          )}
          {current.length > 0 && (
            <button
              onClick={() => {
                setTransferSlug(current[0].ms_slug);
                setShowTransfer(true);
              }}
              className="btn-ghost p-1.5"
              title="Transfer Territory"
            >
              <ArrowRightLeft size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Tab switcher (only if 2+ territories) */}
      {allTabs.length > 1 && (
        <div className="flex gap-1 px-4 pt-2 border-b border-border-default">
          {allTabs.map((t, i) => (
            <button
              key={t.ms_slug + (t.end_date ?? "")}
              onClick={() => setActiveTab(i)}
              className={`px-3 py-1.5 text-caption rounded-t-md transition-colors ${
                i === activeTab
                  ? "bg-bg-primary text-text-primary border border-b-0 border-border-default"
                  : "text-text-tertiary hover:text-text-primary"
              }`}
            >
              {t.territories?.territory_name ?? t.ms_slug}
              {!t.isCurrent && <span className="ml-1 text-text-tertiary">(Former)</span>}
            </button>
          ))}
        </div>
      )}

      {/* Active territory details */}
      {active && (
        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-body-sm font-medium">
                {active.territories?.territory_name ?? active.ms_slug}
              </div>
              <div className="text-caption text-text-tertiary">
                {active.isCurrent ? "Current" : "Former"} {active.role} since {new Date(active.start_date).toLocaleDateString()}
                {active.end_date && ` — ended ${new Date(active.end_date).toLocaleDateString()}`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                active.territories?.status === "active"
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-600"
              }`}>
                {active.territories?.status ?? "unknown"}
              </span>
              <button
                onClick={() => router.push(`/territories/${active.ms_slug}`)}
                className="text-info hover:underline text-caption flex items-center gap-1"
              >
                View territory <ExternalLink size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {allTabs.length === 0 && ghlContactId && (
        <div className="p-4 text-center">
          <p className="text-caption text-text-tertiary">No territory assigned</p>
          <button onClick={handleAssignOpen} className="mt-2 text-caption text-info hover:underline">
            Assign a territory
          </button>
        </div>
      )}

      {/* Assign Modal */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowAssign(false)}>
          <div className="bg-bg-primary border border-border-default rounded-lg p-6 w-[400px] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-h3 text-text-primary mb-4">Assign Territory</h3>
            <div className="space-y-3">
              <div>
                <label className="text-caption text-text-tertiary block mb-1">Territory</label>
                <select
                  value={selectedSlug}
                  onChange={(e) => setSelectedSlug(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border-default bg-bg-secondary text-body-sm"
                >
                  <option value="">Select territory...</option>
                  {territories.map((t) => (
                    <option key={t.ms_slug} value={t.ms_slug}>{t.territory_name} ({t.ms_slug})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-caption text-text-tertiary block mb-1">Role</label>
                <select
                  value={assignRole}
                  onChange={(e) => setAssignRole(e.target.value as "owner" | "co-owner")}
                  className="w-full px-3 py-2 rounded-md border border-border-default bg-bg-secondary text-body-sm"
                >
                  <option value="owner">Owner</option>
                  <option value="co-owner">Co-Owner</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAssign(false)} className="btn-secondary text-body-sm">Cancel</button>
              <button onClick={handleAssign} disabled={!selectedSlug || assigning} className="btn-primary text-body-sm">
                {assigning ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransfer && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowTransfer(false)}>
          <div className="bg-bg-primary border border-border-default rounded-lg p-6 w-[400px] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-h3 text-text-primary mb-4">Transfer Territory</h3>
            <p className="text-caption text-text-tertiary mb-3">
              Transferring <strong>{transferSlug}</strong> to a new owner.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-caption text-text-tertiary block mb-1">New Owner (GHL Contact ID)</label>
                <input
                  type="text"
                  value={transferContactId}
                  onChange={(e) => setTransferContactId(e.target.value)}
                  placeholder="Paste GHL contact ID..."
                  className="w-full px-3 py-2 rounded-md border border-border-default bg-bg-secondary text-body-sm"
                />
              </div>
              <div>
                <label className="text-caption text-text-tertiary block mb-1">Transfer Notes (optional)</label>
                <textarea
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-md border border-border-default bg-bg-secondary text-body-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowTransfer(false)} className="btn-secondary text-body-sm">Cancel</button>
              <button onClick={handleTransfer} disabled={!transferContactId || transferring} className="btn-primary text-body-sm">
                {transferring ? "Transferring..." : "Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
