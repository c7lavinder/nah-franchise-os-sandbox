"use client";

import { useState, useEffect } from "react";
import { Brain, ExternalLink, AlertTriangle, Zap, CheckCircle2 } from "lucide-react";
import { VALUES_DESCRIPTIONS, WORK_STYLE_DESCRIPTIONS } from "@/lib/zorakle";

interface ZorakleData {
  eclipse_overall: number | null;
  values_type: string | null;
  work_style: string | null;
  culture: string | null;
  fit_score: number | null;
  risk_flag: "green" | "yellow" | "red" | null;
  eclipse_drive_id: string | null;
  spoton_drive_id: string | null;
}

interface Props {
  contactId: string;
}

function RiskBadge({ flag }: { flag: string | null }) {
  if (!flag) return null;
  const styles: Record<string, string> = {
    green: "bg-green-100 text-green-800",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-800",
  };
  const icons: Record<string, React.ReactNode> = {
    green: <CheckCircle2 size={12} />,
    yellow: <AlertTriangle size={12} />,
    red: <AlertTriangle size={12} />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${styles[flag]}`}>
      {icons[flag]} {flag}
    </span>
  );
}

export default function ZorakleCard({ contactId }: Props) {
  const [data, setData] = useState<ZorakleData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/zorakle/prospect/${contactId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d?.profile ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [contactId]);

  if (loading) return null;

  // No data — show placeholder
  if (!data) {
    return (
      <div className="border border-border-default rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Brain size={16} className="text-scout-purple" />
          <span className="text-body-sm font-medium">Personality Profile</span>
        </div>
        <div className="text-caption text-text-tertiary">
          No Zorakle data available. Assessment not yet completed.
        </div>
      </div>
    );
  }

  const driveBaseUrl = "https://drive.google.com/file/d/";
  const isBelonger = data.values_type?.toLowerCase() === "belonger";

  return (
    <div className="border border-border-default rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Brain size={16} className="text-scout-purple" />
        <span className="text-body-sm font-medium">Personality Profile</span>
        <RiskBadge flag={data.risk_flag} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-body-sm">
        <div>
          <div className="text-caption text-text-tertiary">Eclipse %</div>
          <div className="font-medium">{data.eclipse_overall ?? "—"}%</div>
        </div>
        <div>
          <div className="text-caption text-text-tertiary">Fit Score</div>
          <div className="font-medium">{data.fit_score ?? "—"}</div>
        </div>
        <div>
          <div className="text-caption text-text-tertiary">Values Type</div>
          <div className="font-medium">
            {data.values_type ?? "—"}
            {isBelonger && <Zap size={12} className="inline ml-1 text-yellow-500" />}
          </div>
          {data.values_type && (
            <div className="text-[10px] text-text-tertiary mt-0.5">
              {VALUES_DESCRIPTIONS[data.values_type.toLowerCase()] ?? ""}
            </div>
          )}
        </div>
        <div>
          <div className="text-caption text-text-tertiary">Work Style</div>
          <div className="font-medium">{data.work_style ?? "—"}</div>
          {data.work_style && (
            <div className="text-[10px] text-text-tertiary mt-0.5">
              {WORK_STYLE_DESCRIPTIONS[data.work_style.toLowerCase()] ?? ""}
            </div>
          )}
        </div>
      </div>

      {/* PDF links */}
      {(data.eclipse_drive_id || data.spoton_drive_id) && (
        <div className="flex gap-3 mt-3 pt-3 border-t border-border-default">
          {data.eclipse_drive_id && (
            <a
              href={`${driveBaseUrl}${data.eclipse_drive_id}/view`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-caption text-info hover:underline flex items-center gap-1"
            >
              Eclipse PDF <ExternalLink size={10} />
            </a>
          )}
          {data.spoton_drive_id && (
            <a
              href={`${driveBaseUrl}${data.spoton_drive_id}/view`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-caption text-info hover:underline flex items-center gap-1"
            >
              SpotOn PDF <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
