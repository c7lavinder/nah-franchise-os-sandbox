"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useEffect, useState } from "react";

interface ScoreCardItem {
  value: string | number;
  label: string;
  sub: string;
  goal?: number;
}

interface ScoreCardRowProps {
  page: "daily-hq" | "calls" | "pipeline";
}

export default function ScoreCardRow({ page }: ScoreCardRowProps) {
  const [cards, setCards] = useState<ScoreCardItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/scorecards/${page}`)
      .then((res) => res.json())
      .then((data: Record<string, ScoreCardItem>) => {
        setCards(Object.values(data));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[76px] rounded-xl bg-nah-blue/10 animate-pulse" />
        ))}
      </div>
    );
  }

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl px-5 py-4 bg-gradient-to-br from-nah-blue to-[#0080b8] text-white shadow-md"
        >
          <span className="text-4xl font-extrabold leading-none tracking-tight">
            {card.goal != null
              ? `${card.value}/${card.goal}`
              : card.value}
          </span>
          <p className="text-sm font-medium text-white/80 mt-1.5">{card.label}</p>
          <p className="text-[11px] text-white/50">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}
