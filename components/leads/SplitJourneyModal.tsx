"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * SplitJourneyModal — two-way journey split dialog.
 *
 * Opens from the Profile tab header of a journey with 2+ active members.
 * The rep names each child journey, picks which members go to each side,
 * picks which territories each side inherits, then submits. The backend
 * closes the original and spawns two new journeys with parent_journey_id
 * pointing back. On success the rep is routed to the new Side A journey.
 *
 * Intentional v1 scope: exactly two child journeys. Three-way splits can
 * come later — the backend already supports N > 2.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { capitalizeName } from "@/lib/format/contact";
import { useScrollLock } from "@/lib/hooks/useScrollLock";

export interface SplitMember {
  contact_id: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

export interface SplitTerritory {
  TerritorySlug: string;
  Nickname: string;
}

interface SplitJourneyModalProps {
  journeyId: string;
  originalName: string;
  members: SplitMember[];
  territories: SplitTerritory[];
  onClose: () => void;
  onSuccess?: (primaryContactId: string) => void;
}

type Side = "A" | "B";

export default function SplitJourneyModal({
  journeyId,
  originalName,
  members,
  territories,
  onClose,
  onSuccess,
}: SplitJourneyModalProps) {
  useScrollLock(true);
  const router = useRouter();
  const { toast } = useToast();

  const [nameA, setNameA] = useState("");
  const [nameB, setNameB] = useState("");
  const [memberSide, setMemberSide] = useState<Record<string, Side>>(() => {
    // Default split: first half to A, second half to B.
    const out: Record<string, Side> = {};
    members.forEach((m, i) => {
      out[m.contact_id] = i < Math.ceil(members.length / 2) ? "A" : "B";
    });
    return out;
  });
  const [territorySide, setTerritorySide] = useState<Record<string, Side>>(() => {
    const out: Record<string, Side> = {};
    territories.forEach((t, i) => {
      out[t.TerritorySlug] = i < Math.ceil(territories.length / 2) ? "A" : "B";
    });
    return out;
  });
  const [primaryA, setPrimaryA] = useState<string>("");
  const [primaryB, setPrimaryB] = useState<string>("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const membersA = useMemo(() => members.filter((m) => memberSide[m.contact_id] === "A"), [members, memberSide]);
  const membersB = useMemo(() => members.filter((m) => memberSide[m.contact_id] === "B"), [members, memberSide]);

  // Auto-preselect the primary when a side ends up with exactly one member.
  useEffect(() => {
    if (!primaryA && membersA.length >= 1) setPrimaryA(membersA[0].contact_id);
    if (!primaryB && membersB.length >= 1) setPrimaryB(membersB[0].contact_id);
  }, [membersA, membersB, primaryA, primaryB]);

  const canSubmit =
    nameA.trim().length > 0 &&
    nameB.trim().length > 0 &&
    membersA.length >= 1 &&
    membersB.length >= 1 &&
    primaryA &&
    membersA.some((m) => m.contact_id === primaryA) &&
    primaryB &&
    membersB.some((m) => m.contact_id === primaryB);

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/journeys/${journeyId}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason || undefined,
          new_journeys: [
            {
              name: nameA.trim(),
              primary_contact_id: primaryA,
              member_contact_ids: membersA.map((m) => m.contact_id),
              TerritorySlugs: territories
                .filter((t) => territorySide[t.TerritorySlug] === "A")
                .map((t) => t.TerritorySlug),
            },
            {
              name: nameB.trim(),
              primary_contact_id: primaryB,
              member_contact_ids: membersB.map((m) => m.contact_id),
              TerritorySlugs: territories
                .filter((t) => territorySide[t.TerritorySlug] === "B")
                .map((t) => t.TerritorySlug),
            },
          ],
        }),
      });
      const payload = (await res.json()) as {
        success?: boolean;
        error?: string;
        new_journeys?: { id: string; primary_contact_id: string }[];
      };
      if (!res.ok || !payload.success) {
        setError(payload.error ?? "Failed to split journey");
        return;
      }
      toast("Journey split");
      const firstNew = payload.new_journeys?.[0];
      if (firstNew) {
        if (onSuccess) onSuccess(firstNew.primary_contact_id);
        else router.push(`/journeys/${firstNew.id}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to split");
    } finally {
      setSubmitting(false);
    }
  }

  const renderSide = (
    label: Side,
    name: string,
    setName: (s: string) => void,
    sideMembers: SplitMember[],
    primary: string,
    setPrimary: (s: string) => void
  ) => (
    <div className="flex-1 bg-bg-tertiary border border-border-default rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold text-text-tertiary tracking-wider">JOURNEY {label}</span>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={`Journey ${label} name`}
        className="w-full bg-surface-solid border border-border-default rounded px-2 py-1 text-body-sm text-text-primary mb-3"
      />
      <div className="space-y-1.5">
        <span className="text-[10px] font-semibold text-text-tertiary tracking-wider">PRIMARY CONTACT</span>
        {sideMembers.length === 0 ? (
          <p className="text-caption text-text-tertiary italic">Assign a member to this side first</p>
        ) : (
          <div className="space-y-1">
            {sideMembers.map((m) => (
              <label key={m.contact_id} className="flex items-center gap-2 text-body-sm cursor-pointer">
                <input
                  type="radio"
                  name={`primary-${label}`}
                  checked={primary === m.contact_id}
                  onChange={() => setPrimary(m.contact_id)}
                />
                <span className="text-text-primary">
                  {capitalizeName(`${m.first_name ?? ""} ${m.last_name ?? ""}`.trim()) || "Unknown"}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface-solid border border-border-default rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
          <div>
            <h2 className="text-h3 text-text-primary font-medium">Split Journey</h2>
            <p className="text-caption text-text-tertiary">
              {originalName} will close. Two new journeys will be created.
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-stretch gap-3">
            {renderSide("A", nameA, setNameA, membersA, primaryA, setPrimaryA)}
            {renderSide("B", nameB, setNameB, membersB, primaryB, setPrimaryB)}
          </div>

          <div>
            <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider mb-2">MEMBERS</h3>
            <div className="space-y-1">
              {members.map((m) => {
                const side = memberSide[m.contact_id];
                const name = capitalizeName(`${m.first_name ?? ""} ${m.last_name ?? ""}`.trim()) || "Unknown";
                return (
                  <div key={m.contact_id} className="flex items-center gap-3 py-1.5 px-2 bg-bg-tertiary rounded">
                    <span className="text-body-sm text-text-primary flex-1">{name}</span>
                    <span className="text-[10px] text-text-tertiary">{m.role.replace(/_/g, " ")}</span>
                    <div className="flex gap-1">
                      {(["A", "B"] as Side[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => {
                            setMemberSide((prev) => ({ ...prev, [m.contact_id]: s }));
                            if (s === "A" && primaryA === m.contact_id) setPrimaryA("");
                            if (s === "B" && primaryB === m.contact_id) setPrimaryB("");
                          }}
                          className={`px-2.5 py-0.5 rounded text-caption font-medium transition-colors ${
                            side === s
                              ? s === "A"
                                ? "bg-nah-blue text-white"
                                : "bg-nah-orange text-white"
                              : "bg-bg-hover text-text-tertiary hover:text-text-primary"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {territories.length > 0 && (
            <div>
              <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider mb-2">TERRITORIES</h3>
              <div className="space-y-1">
                {territories.map((t) => {
                  const side = territorySide[t.TerritorySlug];
                  return (
                    <div key={t.TerritorySlug} className="flex items-center gap-3 py-1.5 px-2 bg-bg-tertiary rounded">
                      <span className="text-body-sm text-text-primary flex-1">{t.Nickname}</span>
                      <span className="text-[10px] text-text-tertiary">{t.TerritorySlug}</span>
                      <div className="flex gap-1">
                        {(["A", "B"] as Side[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => setTerritorySide((prev) => ({ ...prev, [t.TerritorySlug]: s }))}
                            className={`px-2.5 py-0.5 rounded text-caption font-medium transition-colors ${
                              side === s
                                ? s === "A"
                                  ? "bg-nah-blue text-white"
                                  : "bg-nah-orange text-white"
                                : "bg-bg-hover text-text-tertiary hover:text-text-primary"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-semibold text-text-tertiary tracking-wider mb-1 block">
              REASON (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Context for the split (shown in the parent journey record)"
              rows={2}
              className="w-full bg-bg-tertiary border border-border-default rounded px-2 py-1.5 text-body-sm text-text-primary resize-none"
            />
          </div>

          {error && <p className="text-caption text-danger">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-default">
          <button onClick={onClose} className="btn-ghost px-3 py-1.5 text-caption">
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || submitting}
            className={`px-4 py-1.5 rounded-md text-caption font-medium flex items-center gap-1 ${
              canSubmit && !submitting
                ? "bg-danger text-white hover:bg-danger/90"
                : "bg-bg-tertiary text-text-tertiary border border-border-default cursor-not-allowed"
            }`}
          >
            {submitting && <Loader2 size={12} className="animate-spin" />}
            Split Journey
          </button>
        </div>
      </div>
    </div>
  );
}
