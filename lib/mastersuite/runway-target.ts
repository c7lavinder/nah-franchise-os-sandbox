export type RunwayFacts = {
  offerCount: number;
  contractCount: number;
  purchaseCount: number;
  constructionStartCount: number;
  completionCount: number;
};

export type RunwayTarget = {
  stageSlug: "first-purchase" | "inventory-building" | "running";
  subTaskSlug: "first-contract" | "closing" | "construction-start" | "first-completed" | "hundred-offers" | null;
};

export function emptyRunwayFacts(): RunwayFacts {
  return {
    offerCount: 0,
    contractCount: 0,
    purchaseCount: 0,
    constructionStartCount: 0,
    completionCount: 0,
  };
}

export function runwayTargetForFacts(
  facts: RunwayFacts,
  hasTerritoryFirstPurchaseDate: boolean
): RunwayTarget | null {
  if (facts.purchaseCount >= 3) return { stageSlug: "running", subTaskSlug: null };
  if (facts.offerCount >= 100) return { stageSlug: "inventory-building", subTaskSlug: "hundred-offers" };
  if (facts.completionCount >= 1) return { stageSlug: "inventory-building", subTaskSlug: "first-completed" };
  if (facts.constructionStartCount >= 1) return { stageSlug: "first-purchase", subTaskSlug: "construction-start" };
  if (facts.purchaseCount >= 1 || hasTerritoryFirstPurchaseDate) {
    return { stageSlug: "first-purchase", subTaskSlug: "closing" };
  }
  if (facts.contractCount >= 1) return { stageSlug: "first-purchase", subTaskSlug: "first-contract" };
  return null;
}
