/**
 * Workflow Intelligence Engine — public API
 *
 * Re-exports the main service functions for use by API routes and Scout tools.
 */

export {
  enrollContact,
  pauseEnrollment,
  resumeEnrollment,
  exitEnrollment,
  advanceDay,
  getContactEnrollments,
  getWorkflowEnrollments,
  getEnrollment,
  isContactEnrolled,
  expireStaleEnrollments,
} from "./enrollment";

export {
  runScheduler,
} from "./scheduler";

export {
  analyzeWorkflow,
  analyzeAllWorkflows,
} from "./health-scoring";

export {
  generateRewrites,
} from "./rewrite-engine";

export type {
  EnrollmentResult,
} from "./enrollment";

export type {
  SchedulerRunResult,
} from "./scheduler";

export type {
  HealthAnalysis,
} from "./health-scoring";

export type {
  RewriteResult,
  RewriteVariant,
} from "./rewrite-engine";

export {
  createABTest,
  startTest,
  recordResult,
  checkForWinner,
  declareWinner,
  getTestsForWorkflow,
  assignVariant,
} from "./ab-testing";

export {
  submitForApproval,
  approveRequest,
  rejectRequest,
  getPendingApprovals,
  getApprovalsForWorkflow,
  getApproval,
} from "./approvals";
