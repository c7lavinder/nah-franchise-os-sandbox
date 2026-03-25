"use client";

import { Megaphone } from "lucide-react";

interface SourceData {
  name: string;
  count: number;
  color: string;
}

interface LeadSourceTableProps {
  sources: SourceData[];
  totalContacts: number;
}

export default function LeadSourceTable({ sources, totalContacts }: LeadSourceTableProps) {
  const sorted = [...sources].sort((a, b) => b.count - a.count);

  return (
    <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Megaphone size={16} className="text-scout-purple" />
        <h3 className="text-h2 text-text-primary">Lead Sources</h3>
      </div>

      <div className="space-y-3">
        {sorted.map((source) => {
          const pct = totalContacts > 0 ? Math.round((source.count / totalContacts) * 100) : 0;

          return (
            <div key={source.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-body-sm text-text-primary">{source.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-semibold text-text-primary">
                    {source.count.toLocaleString()}
                  </span>
                  <span className="text-caption text-text-tertiary w-[36px] text-right">
                    {pct}%
                  </span>
                </div>
              </div>
              <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: source.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
