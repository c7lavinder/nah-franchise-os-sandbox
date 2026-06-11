import type { EosTerritoryGoal } from "@/types/database";

interface Props {
  goals: EosTerritoryGoal[];
}

const GOAL_LABELS: Record<string, string> = {
  houses_purchased: "Rental Goal",
  gross_profit: "Gross Profit Goal",
  quality_of_life: "Quality of Life Goal",
};

const GOAL_ORDER: Record<string, number> = {
  houses_purchased: 1,
  gross_profit: 2,
  quality_of_life: 3,
};

const COL_HEADERS = ["Actual", "Current Year Goal", "Year 5", "Year 25"];
const COL_KEYS: (keyof EosTerritoryGoal)[] = ["actual", "current_year_goal", "year_5_goal", "year_25_goal"];

function formatGoalValue(goalType: string, value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
  if (!raw) return "—";
  if (goalType !== "gross_profit") return raw;

  const numericValue = Number(raw.replace(/[$,]/g, ""));
  if (!Number.isFinite(numericValue)) return raw;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(numericValue);
}

export default function TerritoryEosGoals({ goals }: Props) {
  const orderedGoals = [...goals].sort((a, b) => (GOAL_ORDER[a.goal_type] ?? 99) - (GOAL_ORDER[b.goal_type] ?? 99));

  return (
    <div>
      <h3 className="text-body-sm font-semibold text-text-primary mb-3">Goals</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="border-b border-border-primary">
              <th className="text-left py-2 pr-3 text-caption font-medium text-text-secondary w-40" />
              {COL_HEADERS.map((h) => (
                <th key={h} className="text-left py-2 px-2 text-caption font-medium text-text-secondary">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderedGoals.map((g) => (
              <tr key={g.goal_type} className="border-b border-border-primary/50">
                <td className="py-2 pr-3 font-medium text-text-primary">{GOAL_LABELS[g.goal_type] ?? g.goal_type}</td>
                {COL_KEYS.map((col) => (
                  <td key={col} className="py-2 px-2">
                    <span className="text-text-primary whitespace-pre-line">
                      {formatGoalValue(g.goal_type, g[col])}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
