import type { EosTerritoryBudget } from "@/types/database";

interface Props {
  budgets: EosTerritoryBudget[];
}

function formatCurrency(amount: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
}

export default function TerritoryEosMonthlySpend({ budgets }: Props) {
  const total = budgets.reduce((sum, budget) => sum + (budget.amount ?? 0), 0);

  return (
    <div>
      <h3 className="text-body-sm font-semibold text-text-primary mb-3">Monthly Spend</h3>
      <div className="space-y-3">
        {budgets.map((budget) => (
          <div key={budget.id} className="flex items-center justify-between gap-4 text-body-sm">
            <span className="text-text-primary">{budget.description}</span>
            <span className="font-semibold text-text-primary">{formatCurrency(budget.amount)}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border-secondary pt-3 text-body-sm font-semibold">
        <span className="text-text-tertiary">Total</span>
        <span className="text-text-primary">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}
