"use client";

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
    fetch(`/api/scorecards/${page}`)
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
          <div key={i} className="card animate-pulse h-[72px]" />
        ))}
      </div>
    );
  }

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      {cards.map((card) => (
        <div key={card.label} className="card !py-3 !px-4">
          <div className="flex items-baseline gap-2">
            <span className="text-h1 text-text-primary leading-none">
              {card.goal != null
                ? `${card.value}/${card.goal}`
                : card.value}
            </span>
          </div>
          <p className="text-body-sm font-medium text-text-secondary mt-0.5">{card.label}</p>
          <p className="text-caption text-text-tertiary">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}
