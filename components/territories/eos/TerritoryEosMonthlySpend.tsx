import type { EosTerritoryBudget } from "@/types/database";

interface Props {
  budgets: EosTerritoryBudget[];
}

export default function TerritoryEosMonthlySpend({ budgets }: Props) {
  const total = budgets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  return (
    <div>
      <h3 className="text-body-sm font-semibold text-text-primary mb-3">Monthly Spend</h3>
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
      <div className="mt-3 pt-2 border-t border-border-primary flex items-center justify-between">
        <span className="text-body-sm font-medium text-text-secondary">Total</span>
        <span className="text-body-sm font-semibold text-text-primary">
          ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}
