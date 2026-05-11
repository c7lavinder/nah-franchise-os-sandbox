import type { EosTerritoryRock, EosRockStatus } from "@/types/database";

interface Props {
  rocks: EosTerritoryRock[];
}

const STATUS_STYLES: Record<EosRockStatus, { label: string; bg: string; text: string }> = {
  not_done: { label: "Not Done", bg: "bg-gray-200", text: "text-gray-700" },
  on_track: { label: "On Track", bg: "bg-green-200", text: "text-green-800" },
  off_track: { label: "Off Track", bg: "bg-red-200", text: "text-red-800" },
  complete: { label: "Complete", bg: "bg-blue-200", text: "text-blue-800" },
};

export default function TerritoryEosRocks({ rocks }: Props) {
  return (
    <div>
      <h3 className="text-body-sm font-semibold text-text-primary mb-3">Rocks</h3>
      <ul className="space-y-1">
        {rocks.map((rock) => {
          const style = STATUS_STYLES[rock.status];
          return (
            <li key={rock.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
              <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-medium ${style.bg} ${style.text}`}>
                {style.label}
              </span>
              <span className="flex-1 text-body-sm text-text-primary">{rock.Rock}</span>
              {rock.quarter && rock.year && (
                <span className="text-[10px] text-text-tertiary shrink-0">
                  Q{rock.quarter} {rock.year}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
