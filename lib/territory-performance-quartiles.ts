export type TerritoryQuartile = "Q1" | "Q2" | "Q3" | "Q4";

export interface TerritoryPerformanceInput {
  slug: string;
  name?: string | null;
  leadListInsertedMonth: number;
  stage1Last30d: number;
  stage4Last30d: number;
  contractsLast30d: number;
  purchasesLast30d: number;
  purchasesT12: number;
  openIssues?: number;
  openTodos?: number;
}

export interface TerritoryPerformanceLabel {
  quartile: TerritoryQuartile;
  score: number;
  rank: number;
  status: string;
}

export const TERRITORY_QUARTILE_META: Record<
  TerritoryQuartile,
  { label: string; shortLabel: string; tone: "green" | "yellow" | "orange" | "red" }
> = {
  Q1: { label: "Elite / Top Tier", shortLabel: "Elite", tone: "green" },
  Q2: { label: "Above Average / Solid", shortLabel: "Solid", tone: "yellow" },
  Q3: { label: "Below Average / Needs Monitoring", shortLabel: "Monitor", tone: "orange" },
  Q4: { label: "Critical / Immediate Action", shortLabel: "Critical", tone: "red" },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pct(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export function scoreTerritoryPerformance(input: TerritoryPerformanceInput): number {
  let score = 0;
  const leadWorkRate = pct(input.stage4Last30d, input.stage1Last30d);

  if (input.leadListInsertedMonth >= 200) score += 1;
  else if (input.leadListInsertedMonth === 0) score -= 1;

  if (input.stage1Last30d >= 30) score += 2;
  else if (input.stage1Last30d >= 15) score += 1;
  else if (input.stage1Last30d === 0) score -= 2;
  else score -= 1;

  if (input.stage4Last30d >= 10) score += 2;
  else if (input.stage4Last30d >= 5) score += 1;
  else if (input.stage4Last30d === 0) score -= 2;
  else score -= 1;

  if (leadWorkRate >= 35) score += 1;
  else if (input.stage1Last30d >= 10 && leadWorkRate < 15) score -= 1;

  if (input.contractsLast30d >= 1) score += 1;
  else if (input.stage4Last30d >= 10) score -= 1;

  if (input.purchasesLast30d >= 1) score += 2;
  else score -= 2;

  if (input.purchasesT12 >= 10) score += 2;
  else if (input.purchasesT12 >= 5) score += 1;
  else if (input.purchasesT12 < 3) score -= 1;

  if ((input.openIssues ?? 0) >= 3) score -= 1;
  if ((input.openTodos ?? 0) >= 5) score -= 1;

  return clamp(score, -8, 8);
}

export function getQuartileSizes(count: number): [number, number, number, number] {
  const base = Math.floor(count / 4);
  const sizes: [number, number, number, number] = [base, base, base, base];
  const remainderOrder = [0, 2, 1, 3];
  for (let i = 0; i < count % 4; i++) {
    sizes[remainderOrder[i]] += 1;
  }
  return sizes;
}

export function assignTerritoryPerformanceLabels<T extends TerritoryPerformanceInput>(
  territories: T[]
): (T & TerritoryPerformanceLabel)[] {
  const sorted = territories
    .map((territory) => ({ ...territory, score: scoreTerritoryPerformance(territory) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.purchasesT12 !== a.purchasesT12) return b.purchasesT12 - a.purchasesT12;
      if (b.purchasesLast30d !== a.purchasesLast30d) return b.purchasesLast30d - a.purchasesLast30d;
      if (b.stage4Last30d !== a.stage4Last30d) return b.stage4Last30d - a.stage4Last30d;
      if (b.stage1Last30d !== a.stage1Last30d) return b.stage1Last30d - a.stage1Last30d;
      if (b.leadListInsertedMonth !== a.leadListInsertedMonth) return b.leadListInsertedMonth - a.leadListInsertedMonth;
      return (a.name ?? a.slug).localeCompare(b.name ?? b.slug);
    });

  const [q1, q2, q3] = getQuartileSizes(sorted.length);

  return sorted.map((territory, index) => {
    const quartile: TerritoryQuartile = index < q1 ? "Q1" : index < q1 + q2 ? "Q2" : index < q1 + q2 + q3 ? "Q3" : "Q4";
    return {
      ...territory,
      rank: index + 1,
      quartile,
      status: TERRITORY_QUARTILE_META[quartile].label,
    };
  });
}
