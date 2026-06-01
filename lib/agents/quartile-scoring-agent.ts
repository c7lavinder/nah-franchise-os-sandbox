export type TerritoryQuartile = "Q1" | "Q2" | "Q3" | "Q4";

export type TerritoryCoachingFlag =
  | "Lead Gen Gap"
  | "Not Working Leads"
  | "Offer Gap"
  | "Closing Gap"
  | "Buying Execution Gap"
  | "At Risk"
  | "Momentum";

export interface TerritoryPerformanceInput {
  slug: string;
  name?: string | null;
  leadListInsertedMonth: number;
  stage1Last30d: number;
  stage3Last30d?: number;
  stage4Last30d: number;
  contractsLast30d: number;
  purchasesLast30d: number;
  purchasesT12: number;
  openIssues?: number;
  openTodos?: number;
}

export interface TerritoryScoreFactor {
  key: string;
  label: string;
  points: number;
  reason: string;
}

export interface TerritoryScoreExplanation {
  rawScore: number;
  score: number;
  leadWorkRate: number;
  coachingFlag: TerritoryCoachingFlag;
  coachingReason: string;
  factors: TerritoryScoreFactor[];
}

export interface TerritoryPerformanceLabel {
  quartile: TerritoryQuartile;
  score: number;
  rank: number;
  status: string;
  leadWorkRate: number;
  coachingFlag: TerritoryCoachingFlag;
  coachingReason: string;
  scoreFactors: TerritoryScoreFactor[];
}

export const QUARTILE_SCORING_AGENT_VERSION = "2026-06-01-lead-gen-v2";

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

function addFactor(factors: TerritoryScoreFactor[], key: string, label: string, points: number, reason: string) {
  factors.push({ key, label, points, reason });
}

function coachingDiagnosis(input: TerritoryPerformanceInput, score: number, leadWorkRate: number) {
  if (input.stage1Last30d < 15 || input.leadListInsertedMonth === 0) {
    return {
      coachingFlag: "Lead Gen Gap" as const,
      coachingReason: "Lead flow is below the level needed for consistent buying activity.",
    };
  }

  if (input.stage1Last30d >= 10 && leadWorkRate < 20) {
    return {
      coachingFlag: "Not Working Leads" as const,
      coachingReason: "Seller leads are being created, but too few are reaching offer-ready stages.",
    };
  }

  if (input.stage1Last30d >= 15 && input.stage4Last30d < 5) {
    return {
      coachingFlag: "Offer Gap" as const,
      coachingReason: "Lead volume exists, but offer volume is not keeping up.",
    };
  }

  if (input.stage4Last30d >= 10 && input.contractsLast30d === 0) {
    return {
      coachingFlag: "Closing Gap" as const,
      coachingReason: "Offer volume is present, but offers are not turning into contracts.",
    };
  }

  if ((input.contractsLast30d > 0 && input.purchasesLast30d === 0) || input.purchasesT12 < 3) {
    return {
      coachingFlag: "Buying Execution Gap" as const,
      coachingReason: "Activity is not consistently turning into purchased houses.",
    };
  }

  if (score <= -4) {
    return {
      coachingFlag: "At Risk" as const,
      coachingReason: "Multiple leading and lagging indicators are underperforming.",
    };
  }

  return {
    coachingFlag: "Momentum" as const,
    coachingReason: "Core lead generation and buying indicators are moving in the right direction.",
  };
}

export function explainTerritoryScore(input: TerritoryPerformanceInput): TerritoryScoreExplanation {
  const factors: TerritoryScoreFactor[] = [];
  const workedLeads = Math.max(input.stage3Last30d ?? 0, input.stage4Last30d);
  const leadWorkRate = pct(workedLeads, input.stage1Last30d);

  if (input.leadListInsertedMonth >= 200) {
    addFactor(factors, "lead-list", "Lead List Inserted", 1, "Strong current-month lead-list activity.");
  } else if (input.leadListInsertedMonth === 0) {
    addFactor(factors, "lead-list", "Lead List Inserted", -1, "No current-month lead-list activity.");
  } else {
    addFactor(factors, "lead-list", "Lead List Inserted", 0, "Some current-month lead-list activity.");
  }

  if (input.stage1Last30d >= 30) {
    addFactor(factors, "stage-1", "Stage 1 Leads", 3, "At or above the 30-lead monthly pace.");
  } else if (input.stage1Last30d >= 15) {
    addFactor(factors, "stage-1", "Stage 1 Leads", 1, "Some seller lead flow, but below target pace.");
  } else if (input.stage1Last30d === 0) {
    addFactor(factors, "stage-1", "Stage 1 Leads", -3, "No Stage 1 seller leads in the last 30 days.");
  } else {
    addFactor(factors, "stage-1", "Stage 1 Leads", -1, "Low Stage 1 seller lead volume.");
  }

  if (leadWorkRate >= 35) {
    addFactor(factors, "lead-work-rate", "Lead Work Rate", 2, "A healthy share of leads are being worked forward.");
  } else if (input.stage1Last30d >= 10 && leadWorkRate < 15) {
    addFactor(factors, "lead-work-rate", "Lead Work Rate", -3, "Leads are not moving forward fast enough.");
  } else if (input.stage1Last30d >= 10) {
    addFactor(factors, "lead-work-rate", "Lead Work Rate", -1, "Lead work rate is below the healthy range.");
  } else {
    addFactor(factors, "lead-work-rate", "Lead Work Rate", 0, "Not enough lead volume to judge work rate.");
  }

  if (input.stage4Last30d >= 10) {
    addFactor(factors, "stage-4", "Stage 4 Offers", 2, "At or above the 10-offer monthly pace.");
  } else if (input.stage4Last30d >= 5) {
    addFactor(factors, "stage-4", "Stage 4 Offers", 1, "Some offer activity, but below target pace.");
  } else if (input.stage4Last30d === 0) {
    addFactor(factors, "stage-4", "Stage 4 Offers", -2, "No offer activity in the last 30 days.");
  } else {
    addFactor(factors, "stage-4", "Stage 4 Offers", -1, "Low offer activity.");
  }

  if (input.contractsLast30d >= 1) {
    addFactor(factors, "contracts", "Contracts", 1, "At least one contract in the last 30 days.");
  } else if (input.stage4Last30d >= 10) {
    addFactor(factors, "contracts", "Contracts", -2, "Offer volume is not converting to contracts.");
  } else if (input.stage4Last30d >= 5) {
    addFactor(factors, "contracts", "Contracts", -1, "Some offers, but no contracts yet.");
  } else {
    addFactor(factors, "contracts", "Contracts", 0, "No contract penalty without enough offer volume.");
  }

  if (input.purchasesLast30d >= 1) {
    addFactor(factors, "purchases-30d", "30-Day Purchases", 1, "At least one purchase in the last 30 days.");
  } else if (input.contractsLast30d >= 1) {
    addFactor(factors, "purchases-30d", "30-Day Purchases", 0, "Contract activity exists, but no purchase yet.");
  } else {
    addFactor(factors, "purchases-30d", "30-Day Purchases", -1, "No purchase in the last 30 days.");
  }

  if (input.purchasesT12 >= 10) {
    addFactor(factors, "purchases-t12", "T12 Purchases", 2, "High-performer buying history.");
  } else if (input.purchasesT12 >= 5) {
    addFactor(factors, "purchases-t12", "T12 Purchases", 1, "Moderate trailing-12 buying history.");
  } else if (input.purchasesT12 < 3) {
    addFactor(factors, "purchases-t12", "T12 Purchases", -1, "Low trailing-12 buying history.");
  } else {
    addFactor(factors, "purchases-t12", "T12 Purchases", 0, "Some trailing-12 buying history.");
  }

  if ((input.openIssues ?? 0) >= 5) {
    addFactor(factors, "open-issues", "Open Issues", -1, "Five or more open operational issues.");
  }
  if ((input.openTodos ?? 0) >= 8) {
    addFactor(factors, "open-todos", "Open Todos", -1, "Eight or more open todos.");
  }

  const rawScore = factors.reduce((sum, factor) => sum + factor.points, 0);
  const score = clamp(rawScore, -8, 8);
  const diagnosis = coachingDiagnosis(input, score, leadWorkRate);

  return {
    rawScore,
    score,
    leadWorkRate,
    ...diagnosis,
    factors,
  };
}

export function scoreTerritoryPerformance(input: TerritoryPerformanceInput): number {
  return explainTerritoryScore(input).score;
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
    .map((territory) => {
      const explanation = explainTerritoryScore(territory);
      return { ...territory, ...explanation, scoreFactors: explanation.factors };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.stage1Last30d !== a.stage1Last30d) return b.stage1Last30d - a.stage1Last30d;
      if (b.leadWorkRate !== a.leadWorkRate) return b.leadWorkRate - a.leadWorkRate;
      if (b.stage4Last30d !== a.stage4Last30d) return b.stage4Last30d - a.stage4Last30d;
      if (b.contractsLast30d !== a.contractsLast30d) return b.contractsLast30d - a.contractsLast30d;
      if (b.purchasesT12 !== a.purchasesT12) return b.purchasesT12 - a.purchasesT12;
      if (b.purchasesLast30d !== a.purchasesLast30d) return b.purchasesLast30d - a.purchasesLast30d;
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

export const quartileScoringAgent = {
  name: "Territory Quartile Scoring Agent",
  version: QUARTILE_SCORING_AGENT_VERSION,
  description:
    "Ranks active territories into balanced Q1-Q4 performance quartiles and explains the coaching reason behind each score.",
  scoreTerritory: scoreTerritoryPerformance,
  explainScore: explainTerritoryScore,
  getQuartileSizes,
  assignQuartiles: assignTerritoryPerformanceLabels,
};
