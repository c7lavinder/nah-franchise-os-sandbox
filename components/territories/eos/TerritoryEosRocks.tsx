"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState } from "react";
import { X } from "lucide-react";
import type { EosTerritoryRock, EosRockStatus } from "@/types/database";

interface Props {
  msSlug: string;
  rocks: EosTerritoryRock[];
  onUpdate: () => void;
}

const STATUS_ORDER: EosRockStatus[] = ["not_done", "on_track", "off_track", "complete"];

const STATUS_STYLES: Record<EosRockStatus, { label: string; bg: string; text: string }> = {
  not_done:  { label: "Not Done",  bg: "bg-gray-200",   text: "text-gray-700" },
  on_track:  { label: "On Track",  bg: "bg-green-200",  text: "text-green-800" },
  off_track: { label: "Off Track", bg: "bg-red-200",    text: "text-red-800" },
  complete:  { label: "Complete",  bg: "bg-blue-200",   text: "text-blue-800" },
};

export default function TerritoryEosRocks({ msSlug, rocks, onUpdate }: Props) {
  const [local, setLocal] = useState<EosTerritoryRock[]>(rocks);
  const [newText, setNewText] = useState("");
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
  const currentYear = now.getFullYear();

  async function addRock() {
    if (!newText.trim()) return;
    setSaving(true);
    const res = await apiFetch(`/api/territories/${msSlug}/eos/rocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rock_text: newText.trim(), quarter: currentQuarter, year: currentYear }),
    });
    if (res.ok) {
      const { rock } = await res.json();
      setLocal((prev) => [...prev, rock]);
      setNewText("");
      onUpdate();
    }
    setSaving(false);
  }

  async function cycleStatus(rock: EosTerritoryRock) {
    const currentIdx = STATUS_ORDER.indexOf(rock.status);
    const nextStatus = STATUS_ORDER[(currentIdx + 1) % STATUS_ORDER.length];
    setLocal((prev) =>
      prev.map((r) => (r.id === rock.id ? { ...r, status: nextStatus } : r))
    );
    await apiFetch(`/api/territories/${msSlug}/eos/rocks/${rock.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    }).catch(() => {});
    onUpdate();
  }

  async function deleteRock(id: string) {
    await apiFetch(`/api/territories/${msSlug}/eos/rocks/${id}`, { method: "DELETE" });
    setLocal((prev) => prev.filter((r) => r.id !== id));
    onUpdate();
  }

  return (
    <div>
      <h3 className="text-body-sm font-semibold text-text-primary mb-3">Rocks</h3>
      <ul className="space-y-1">
        {local.map((rock) => {
          const style = STATUS_STYLES[rock.status];
          return (
            <li key={rock.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-bg-secondary transition-colors">
              <button
                onClick={() => cycleStatus(rock)}
                className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-medium ${style.bg} ${style.text} transition-colors`}
              >
                {style.label}
              </button>
              <span className="flex-1 text-body-sm text-text-primary">{rock.rock_text}</span>
              {rock.quarter && rock.year && (
                <span className="text-[10px] text-text-tertiary shrink-0">
                  Q{rock.quarter} {rock.year}
                </span>
              )}
              <button
                onClick={() => deleteRock(rock.id)}
                className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-500 transition-opacity shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2 mt-2">
        <input
          type="text"
          className="flex-1 rounded-lg border border-border-primary bg-bg-primary px-3 py-1.5 text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-nah-blue/30"
          placeholder="Add a rock..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addRock()}
          disabled={saving}
        />
      </div>
    </div>
  );
}
