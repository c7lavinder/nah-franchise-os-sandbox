"use client";

/**
 * TerritoryDataTab — shows full territory data for all territories owned by a contact.
 * Displays overview + profile data points for each territory.
 */

import { useState, useEffect } from "react";
import { Loader2, MapPin, ChevronDown, ChevronRight } from "lucide-react";

interface TerritoryData {
  ms_slug: string;
  territory_name: string;
  status: string;
  region: string | null;
  awarded_date: string | null;
  profile: {
    population: number | null;
    median_home_value: number | null;
    median_household_income: number | null;
    territory_value_est: string | null;
    market_type: string | null;
    flip_activity_score: string | null;
    competitor_presence: string | null;
    local_market_notes: string | null;
  } | null;
  grades: Array<{
    year: number;
    quarter: number;
    houses_purchased: number | null;
    revenue: number | null;
    grade: string | null;
  }>;
}

interface Props {
  ghlContactId: string | null;
}

export default function TerritoryDataTab({ ghlContactId }: Props) {
  const [territories, setTerritories] = useState<TerritoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!ghlContactId) { setLoading(false); return; }
    fetch(`/api/contacts/${ghlContactId}/territory-data`)
      .then((r) => r.ok ? r.json() : { territories: [] })
      .then((d) => {
        setTerritories(d.territories ?? []);
        if (d.territories?.length === 1) setExpanded(d.territories[0].ms_slug);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ghlContactId]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-text-tertiary" /></div>;
  if (territories.length === 0) return <p className="text-caption text-text-tertiary py-4">No territories owned by this contact.</p>;

  return (
    <div className="space-y-3">
      {territories.map((t) => {
        const isExpanded = expanded === t.ms_slug;
        return (
          <div key={t.ms_slug} className="border border-border-default rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(isExpanded ? null : t.ms_slug)}
              className="w-full flex items-center gap-2 px-4 py-3 bg-bg-secondary hover:bg-bg-hover transition-colors"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <MapPin size={14} className="text-info" />
              <a
                href={`/territories/${t.ms_slug}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-body-sm font-medium text-nah-blue hover:underline"
              >
                {t.territory_name}
              </a>
              <span className="text-[10px] text-text-tertiary font-mono ml-1">{t.ms_slug}</span>
              <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium ${
                t.status === "active" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
              }`}>{t.status}</span>
            </button>

            {isExpanded && (
              <div className="p-4 space-y-4">
                {/* Overview */}
                <div>
                  <h4 className="text-[10px] font-semibold text-text-tertiary tracking-wider mb-2">OVERVIEW</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <DataPoint label="Region" value={t.region} />
                    <DataPoint label="Status" value={t.status} />
                    <DataPoint label="Awarded" value={t.awarded_date ? new Date(t.awarded_date).toLocaleDateString() : null} />
                    <DataPoint label="Market Type" value={t.profile?.market_type} />
                  </div>
                </div>

                {/* Market Profile */}
                {t.profile && (
                  <div>
                    <h4 className="text-[10px] font-semibold text-text-tertiary tracking-wider mb-2">MARKET PROFILE</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <DataPoint label="Population" value={t.profile.population?.toLocaleString()} />
                      <DataPoint label="Median Home Value" value={t.profile.median_home_value ? `$${t.profile.median_home_value.toLocaleString()}` : null} />
                      <DataPoint label="Median Income" value={t.profile.median_household_income ? `$${t.profile.median_household_income.toLocaleString()}` : null} />
                      <DataPoint label="Territory Value" value={t.profile.territory_value_est} />
                      <DataPoint label="Flip Activity" value={t.profile.flip_activity_score} />
                      <DataPoint label="Competitor Presence" value={t.profile.competitor_presence} />
                      <DataPoint label="Local Notes" value={t.profile.local_market_notes} span={2} />
                    </div>
                  </div>
                )}

                {/* Performance Grades */}
                {t.grades.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-semibold text-text-tertiary tracking-wider mb-2">PERFORMANCE</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {t.grades.map((g) => (
                        <div key={`${g.year}-${g.quarter}`} className="bg-bg-primary border border-border-default rounded p-2">
                          <span className="text-[10px] text-text-tertiary">Q{g.quarter} {g.year}</span>
                          <div className="flex items-baseline gap-2 mt-0.5">
                            {g.grade && <span className="text-body-sm font-bold text-text-primary">{g.grade}</span>}
                            {g.houses_purchased != null && <span className="text-caption text-text-secondary">{g.houses_purchased} houses</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DataPoint({ label, value, span }: { label: string; value: string | null | undefined; span?: number }) {
  return (
    <div className={span ? `sm:col-span-${span}` : ""}>
      <span className="text-[10px] text-text-tertiary block">{label}</span>
      <p className="text-body-sm text-text-primary">{value || "—"}</p>
    </div>
  );
}
