"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ExternalLink, Loader2 } from "lucide-react";

interface TerritoryCard {
  ms_slug: string;
  territory_name: string;
  status: string;
  owner_name: string | null;
  owner_ghl_contact_id: string | null;
  awarded_date: string | null;
}

interface Props {
  status?: string;
  statusFilter?: string | null;
}

export default function TerritoryCardList({ status, statusFilter }: Props) {
  const effectiveStatus = statusFilter ?? status;
  const router = useRouter();
  const [cards, setCards] = useState<TerritoryCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = effectiveStatus
      ? `/api/pipeline/territory-cards?status=${effectiveStatus}`
      : "/api/pipeline/territory-cards";
    fetch(url)
      .then((r) => r.json())
      .then((d) => setCards(d.cards ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [effectiveStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-6 text-caption text-text-tertiary">
        No territories in this stage.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {cards.map((card) => (
        <button
          key={card.ms_slug}
          onClick={() => router.push(`/territories/${card.ms_slug}`)}
          className="text-left bg-bg-primary border border-border-default rounded-lg p-4 hover:border-nah-blue/50 hover:shadow-sm transition-all"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-info flex-shrink-0" />
              <span className="text-body-sm font-medium text-text-primary">
                {card.territory_name}
              </span>
            </div>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
              card.status === "active"
                ? "bg-green-100 text-green-800"
                : card.status === "available"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-600"
            }`}>
              {card.status}
            </span>
          </div>

          <div className="mt-2 text-caption text-text-secondary">
            {card.owner_name ? (
              <span className="flex items-center gap-1">
                Owner: {card.owner_name}
                {card.owner_ghl_contact_id && (
                  <ExternalLink size={10} className="text-info" />
                )}
              </span>
            ) : (
              <span className="text-text-tertiary italic">No current owner</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
