export default function TerritoryEosMonthlySpend() {
  return (
    <div>
      <h3 className="text-body-sm font-semibold text-text-primary mb-3">Monthly Spend</h3>
      <div className="rounded-lg bg-bg-secondary px-3 py-2 mb-3">
        <div className="text-caption text-text-tertiary">Actual spend</div>
        <div className="text-body-sm font-semibold text-text-primary">Not connected</div>
      </div>
      <p className="mt-2 text-caption text-text-tertiary">
        Actual monthly spend is not shown until spend data is connected.
      </p>
    </div>
  );
}
