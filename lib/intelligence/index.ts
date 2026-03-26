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

export {
  getScoreRecommendations,
} from "./recommendations";

export type {
  ScoreRecommendation,
} from "./recommendations";

export {
  createOnboardingEnrollment,
  advanceOnboardingStage,
  getOnboardingEnrollments,
  ONBOARDING_STAGES,
  COACHING_STAGES,
} from "./onboarding";

export type {
  OnboardingEnrollment,
} from "./onboarding";
