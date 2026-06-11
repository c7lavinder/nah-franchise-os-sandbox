import type { EosTerritoryBudget } from "@/types/database";

interface Props {
  budgets: EosTerritoryBudget[];
}

export default function TerritoryEosMonthlySpend({ budgets }: Props) {
  return (
    <div>
      <h3 className="text-body-sm font-semibold text-text-primary mb-3">Monthly Spend</h3>
      <div className="rounded-lg bg-bg-secondary px-3 py-2 mb-3">
        <div className="text-caption text-text-tertiary">Actual spend</div>
        <div className="text-body-sm font-semibold text-text-primary">Not connected</div>
      </div>
      <h4 className="text-caption font-medium text-text-tertiary mb-1">Budget Reference</h4>
      <div className="space-y-1">
        {budgets.map((b) => (
          <div key={b.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            <span className="flex-1 text-body-sm text-text-primary">{b.description}</span>
            <span className="text-body-sm text-text-primary font-medium">
              ${Number(b.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-caption text-text-tertiary">
        Budget values are reference targets only and are not counted as spend.
      </p>
    </div>
  );
}
