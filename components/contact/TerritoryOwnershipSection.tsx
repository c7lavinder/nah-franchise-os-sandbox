"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ExternalLink } from "lucide-react";

interface TerritoryOwnership {
  ms_slug: string;
  role: string;
  start_date: string;
  end_date: string | null;
  territories: { ms_slug: string; territory_name: string; status: string } | null;
}

interface Props {
  contactId: string;
}

export default function TerritoryOwnershipSection({ contactId }: Props) {
  const router = useRouter();
  const [current, setCurrent] = useState<TerritoryOwnership[]>([]);
  const [former, setFormer] = useState<TerritoryOwnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    fetch(`/api/contacts/${contactId}/territories`)
      .then((r) => r.json())
      .then((d) => {
        setCurrent(d.current ?? []);
        setFormer(d.former ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [contactId]);

  // Hide section if no territory ownership
  if (loading) return null;
  if (current.length === 0 && former.length === 0) return null;

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
    </div>
  );
}
