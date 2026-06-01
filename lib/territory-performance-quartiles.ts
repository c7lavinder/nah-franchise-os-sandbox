export {
  QUARTILE_SCORING_AGENT_VERSION,
  TERRITORY_QUARTILE_META,
  assignTerritoryPerformanceLabels,
  explainTerritoryScore,
  getQuartileSizes,
  quartileScoringAgent,
  scoreTerritoryPerformance,
} from "./agents/quartile-scoring-agent";

export type {
  TerritoryCoachingFlag,
  TerritoryPerformanceInput,
  TerritoryPerformanceLabel,
  TerritoryQuartile,
  TerritoryScoreExplanation,
  TerritoryScoreFactor,
} from "./agents/quartile-scoring-agent";
