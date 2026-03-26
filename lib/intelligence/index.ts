/**
 * Candidate Intelligence Engine — public API
 */

export {
  calculateScore,
  updateCandidateScore,
} from "./scoring";

export type {
  ScoreResult,
} from "./scoring";

export {
  generateFlags,
  updateCandidateFlags,
} from "./flags";

export type {
  IntelligenceFlag,
} from "./flags";
