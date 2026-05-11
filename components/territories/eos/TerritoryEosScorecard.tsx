import type { EosTerritoryScorecard } from "@/types/database";

interface Props {
  scorecard: EosTerritoryScorecard[];
  actuals?: Record<string, string>;
}

export default function TerritoryEosScorecard({ scorecard, actuals }: Props) {
  return (
    <div>
      <h3 className="text-body-sm font-semibold text-text-primary mb-3">Scorecard</h3>
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-border-primary">
            <th className="text-left py-2 pr-3 text-caption font-medium text-text-secondary">Metric</th>
            <th className="text-left py-2 px-2 text-caption font-medium text-text-secondary w-32">Goal</th>
            <th className="text-left py-2 px-2 text-caption font-medium text-text-secondary w-32">Actual</th>
          </tr>
        </thead>
        <tbody>
          {scorecard.map((s) => (
            <tr key={s.metric_key} className="border-b border-border-primary/50">
              <td className="py-2 pr-3 text-text-primary">{s.metric_label}</td>
              <td className="py-2 px-2">
                <span className="text-text-primary">{s.goal_value || "—"}</span>
              </td>
              <td className="py-2 px-2 font-medium">
                {actuals?.[s.metric_key] ? (
                  <span className="text-text-primary">{actuals[s.metric_key]}</span>
                ) : (
                  <span className="text-text-tertiary">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
