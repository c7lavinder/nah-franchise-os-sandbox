"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { EosTerritoryBudget } from "@/types/database";

interface Props {
  msSlug: string;
  budgets: EosTerritoryBudget[];
  onUpdate: () => void;
}

export default function TerritoryEosMonthlySpend({ msSlug, budgets, onUpdate }: Props) {
  const [local, setLocal] = useState<EosTerritoryBudget[]>(budgets);
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const total = local.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  async function addBudget() {
    if (!newDesc.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/territories/${msSlug}/eos/budgets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: newDesc.trim(), amount: 0 }),
    });
    if (res.ok) {
      const { budget } = await res.json();
      setLocal((prev) => [...prev, budget]);
      setNewDesc("");
      onUpdate();
    }
    setSaving(false);
  }

  async function updateAmount(id: string, amount: number) {
    setLocal((prev) => prev.map((b) => (b.id === id ? { ...b, amount } : b)));
    await fetch(`/api/territories/${msSlug}/eos/budgets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    }).catch(() => {});
    onUpdate();
  }

  async function deleteBudget(id: string) {
    await fetch(`/api/territories/${msSlug}/eos/budgets/${id}`, { method: "DELETE" });
    setLocal((prev) => prev.filter((b) => b.id !== id));
    onUpdate();
  }

  return (
    <div>
      <h3 className="text-body-sm font-semibold text-text-primary mb-3">Monthly Spend</h3>
      <div className="space-y-1">
        {local.map((b) => (
          <div key={b.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-bg-secondary transition-colors">
            <span className="flex-1 text-body-sm text-text-primary">{b.description}</span>
            <span className="text-text-tertiary text-body-sm">$</span>
            <input
              type="number"
              className="w-24 rounded border border-border-primary bg-bg-primary px-2 py-1 text-body-sm text-right text-text-primary focus:outline-none focus:ring-1 focus:ring-nah-blue/30"
              value={b.amount}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                setLocal((prev) => prev.map((x) => (x.id === b.id ? { ...x, amount: val } : x)));
              }}
              onBlur={(e) => updateAmount(b.id, parseFloat(e.target.value) || 0)}
            />
            <button
              onClick={() => deleteBudget(b.id)}
              className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-500 transition-opacity"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <input
          type="text"
          className="flex-1 rounded-lg border border-border-primary bg-bg-primary px-3 py-1.5 text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-nah-blue/30"
          placeholder="Add expense..."
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addBudget()}
          disabled={saving}
        />
      </div>
      <div className="mt-3 pt-2 border-t border-border-primary flex items-center justify-between">
        <span className="text-body-sm font-medium text-text-secondary">Total</span>
        <span className="text-body-sm font-semibold text-text-primary">
          ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}
