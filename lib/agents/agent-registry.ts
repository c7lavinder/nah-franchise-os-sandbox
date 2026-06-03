export type AgentCategoryKey =
  | "marketing"
  | "lead-management"
  | "franchisee-management"
  | "site-development"
  | "operations"
  | "planned";

export type AgentStatus = "active" | "paused" | "planned" | "needs-review";
export type AgentTrustLevel = "read-only" | "drafts-only" | "approval-required" | "manual-only";

export interface AgentCategory {
  key: AgentCategoryKey;
  label: string;
  summary: string;
}

export interface AgentManualRunEndpoint {
  url: string;
  method: "GET" | "POST";
  body?: Record<string, unknown>;
}

export interface AgentPortrait {
  initials: string;
  accent: string;
  background: string;
  jacket: string;
  expression: string;
}

export interface AgentRegistryEntry {
  name: string;
  label: string;
  roleTitle: string;
  category: AgentCategoryKey;
  status: AgentStatus;
  trigger: string;
  description: string;
  mission: string;
  uses: string[];
  howItWorks: string[];
  dataSources: string[];
  guardrails: string[];
  canDo: string[];
  cannotDo: string[];
  costPerRunEstimate: string;
  trustLevel: AgentTrustLevel;
  supportsManualRun: boolean;
  supportsConversation: boolean;
  portrait: AgentPortrait;
  manualRun?: AgentManualRunEndpoint;
}

export interface AgentRuntimeStats {
  enabled: boolean;
  runsMTD: number;
  suggestionsMTD: number;
  costEstMTD: string;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
}

export type AgentTeamCard = AgentRegistryEntry & AgentRuntimeStats;

export const AGENT_CATEGORIES: AgentCategory[] = [
  {
    key: "marketing",
    label: "Marketing",
    summary: "Find demand, spot channel gaps, and make lead generation visible.",
  },
  {
    key: "lead-management",
    label: "Lead Management",
    summary: "Help reps understand prospects, prep calls, and keep follow-up moving.",
  },
  {
    key: "franchisee-management",
    label: "Franchisee Management",
    summary: "Protect onboarding, runway, coaching, and performance habits after award.",
  },
  {
    key: "site-development",
    label: "Site Development",
    summary: "Support territory, market, property, and local execution intelligence.",
  },
  {
    key: "operations",
    label: "Operations",
    summary: "Watch data quality, workflows, automations, and system reliability.",
  },
  {
    key: "planned",
    label: "Planned",
    summary: "Future teammates we want to add when the operating model is ready.",
  },
];

export const AGENT_REGISTRY: AgentRegistryEntry[] = [
  {
    name: "post-call",
    label: "Call Captain",
    roleTitle: "Post-Call Intelligence Agent",
    category: "lead-management",
    status: "active",
    trigger: "Read.ai webhook after calls, plus manual Generate button",
    description: "Turns call recordings into structured takeaways, profile data, next steps, and coaching signals.",
    mission: "Make every call compound into better follow-up, better profiles, and better franchise decisions.",
    uses: ["Extracts prospect facts from calls", "Creates next-step suggestions", "Improves profile completeness"],
    howItWorks: [
      "Receives or processes the call transcript.",
      "Extracts key facts, objections, commitments, and next actions.",
      "Auto-saves high-confidence facts and queues lower-confidence items for review.",
      "Logs what it found so the team can inspect and improve it.",
    ],
    dataSources: ["Read.ai transcripts", "Calls", "Contacts", "Journeys", "Call data extractions"],
    guardrails: ["Does not send messages", "Lower-confidence findings go to review", "Human can override call data"],
    canDo: ["Summarize calls", "Find missing follow-up", "Improve contact profiles"],
    cannotDo: ["Close a candidate", "Send customer messages", "Override human judgment"],
    costPerRunEstimate: "$0.002/run est.",
    trustLevel: "drafts-only",
    supportsManualRun: false,
    supportsConversation: true,
    portrait: {
      initials: "CC",
      accent: "from-sky-500 to-cyan-400",
      background: "from-sky-50 via-white to-cyan-50",
      jacket: "bg-sky-700",
      expression: "Focused",
    },
  },
  {
    name: "contact-research",
    label: "Prospect Profiler",
    roleTitle: "Contact Research Agent",
    category: "lead-management",
    status: "active",
    trigger: "New contact, Research button, and weekly research cron",
    description: "Builds richer prospect context so reps understand the person behind the lead.",
    mission: "Help the team know who they are talking to before the first serious conversation.",
    uses: ["Researches candidate background", "Suggests profile enrichment", "Flags likely strengths and gaps"],
    howItWorks: [
      "Reads the contact record and available context.",
      "Researches or infers useful profile fields.",
      "Auto-writes high-confidence basics when allowed.",
      "Queues uncertain findings as suggestions for a human to approve.",
    ],
    dataSources: ["Contacts", "Contact profile data", "Suggestion queue", "Public/contextual research"],
    guardrails: ["Does not invent facts", "Medium/low confidence goes to review", "Writes only allowed high-confidence fields"],
    canDo: ["Enrich prospect context", "Create reviewable suggestions", "Improve lead scoring inputs"],
    cannotDo: ["Guarantee personal facts", "Make qualification decisions alone", "Message prospects"],
    costPerRunEstimate: "$0.002/run est.",
    trustLevel: "drafts-only",
    supportsManualRun: false,
    supportsConversation: true,
    portrait: {
      initials: "PP",
      accent: "from-indigo-500 to-violet-400",
      background: "from-indigo-50 via-white to-violet-50",
      jacket: "bg-indigo-700",
      expression: "Curious",
    },
  },
  {
    name: "pre-call-brief",
    label: "Brief Builder",
    roleTitle: "Pre-Call Brief Agent",
    category: "lead-management",
    status: "active",
    trigger: "Daily 7am cron for scheduled calls",
    description: "Prepares reps before calls with context, likely objections, and recommended angles.",
    mission: "Make every rep walk into the next call prepared instead of cold.",
    uses: ["Builds call prep briefs", "Surfaces recent activity", "Frames questions and risks"],
    howItWorks: [
      "Looks at scheduled calls for the day.",
      "Pulls contact, journey, call, and profile context.",
      "Generates a concise briefing for the rep.",
      "Stores the brief for review before the call.",
    ],
    dataSources: ["Calendar calls", "Contacts", "Journeys", "Profiles", "Prior calls"],
    guardrails: ["Advisory only", "Does not contact prospects", "Uses known app data"],
    canDo: ["Prepare a rep", "Explain what matters", "Highlight missing context"],
    cannotDo: ["Run the call", "Promise accuracy if source data is stale", "Send outreach"],
    costPerRunEstimate: "$0.002/run est.",
    trustLevel: "read-only",
    supportsManualRun: false,
    supportsConversation: true,
    portrait: {
      initials: "BB",
      accent: "from-amber-500 to-orange-400",
      background: "from-amber-50 via-white to-orange-50",
      jacket: "bg-amber-700",
      expression: "Ready",
    },
  },
  {
    name: "reengagement-signal",
    label: "Revival Scout",
    roleTitle: "Re-Engagement Signal Agent",
    category: "marketing",
    status: "active",
    trigger: "Monthly scan on the 1st of each month",
    description: "Finds older contacts who may be worth waking back up with the right message.",
    mission: "Turn dormant lead lists into timely second chances without spamming everyone.",
    uses: ["Scans stale leads", "Identifies reactivation opportunities", "Suggests next campaigns"],
    howItWorks: [
      "Looks for contacts that have gone quiet.",
      "Checks context, fit, and recent signals.",
      "Creates a re-engagement recommendation.",
      "Leaves outreach to approved workflow/message paths.",
    ],
    dataSources: ["Contacts", "Journeys", "Activity history", "Pipeline state"],
    guardrails: ["No auto-sending", "Human approval required for outreach", "Prioritizes fit and timing"],
    canDo: ["Find old opportunities", "Recommend campaign angles", "Explain why a lead is worth revisiting"],
    cannotDo: ["Send campaigns by itself", "Override opt-out/suppression rules", "Guarantee intent"],
    costPerRunEstimate: "$0.002/run est.",
    trustLevel: "approval-required",
    supportsManualRun: false,
    supportsConversation: true,
    portrait: {
      initials: "RS",
      accent: "from-emerald-500 to-teal-400",
      background: "from-emerald-50 via-white to-teal-50",
      jacket: "bg-emerald-700",
      expression: "Alert",
    },
  },
  {
    name: "journey-brief",
    label: "Journey Coach",
    roleTitle: "Journey Brief Agent",
    category: "franchisee-management",
    status: "active",
    trigger: "Stage change, call graded, property sync, and nightly cron",
    description: "Creates an operating brief around where a candidate or franchisee is in the journey.",
    mission: "Keep the team aligned on what each journey needs next.",
    uses: ["Summarizes journey state", "Highlights risks and next actions", "Connects sales, onboarding, and runway context"],
    howItWorks: [
      "Reads the active journey and pipeline state.",
      "Pulls recent calls, notes, and performance signals.",
      "Summarizes where the journey stands.",
      "Flags what should happen next.",
    ],
    dataSources: ["Journeys", "Pipeline state", "Calls", "Contacts", "Territories"],
    guardrails: ["Advisory only", "Does not move stages by itself", "Uses app data as source of truth"],
    canDo: ["Create journey summaries", "Explain current risk", "Suggest next operating moves"],
    cannotDo: ["Award a territory", "Move stages without approval", "Replace rep judgment"],
    costPerRunEstimate: "$0.002/run est.",
    trustLevel: "read-only",
    supportsManualRun: false,
    supportsConversation: true,
    portrait: {
      initials: "JC",
      accent: "from-blue-600 to-indigo-400",
      background: "from-blue-50 via-white to-indigo-50",
      jacket: "bg-blue-800",
      expression: "Steady",
    },
  },
  {
    name: "territory-market",
    label: "Market Mapper",
    roleTitle: "Territory Market Research Agent",
    category: "site-development",
    status: "active",
    trigger: "Territory presented, Research button, and 30-day cron",
    description: "Researches territories and market conditions so site decisions have context.",
    mission: "Help franchisees and leadership understand the local market before decisions get expensive.",
    uses: ["Researches territory conditions", "Creates market-data suggestions", "Supports site and territory planning"],
    howItWorks: [
      "Reads the territory and owner context.",
      "Researches market signals and competitive context.",
      "Creates suggested market data updates.",
      "Routes findings into reviewable records.",
    ],
    dataSources: ["Territories", "Market data", "MasterSuite mirrors", "Suggestion queue"],
    guardrails: ["Research is reviewed", "Does not change territory ownership", "Does not make investment decisions"],
    canDo: ["Map market signals", "Find missing territory context", "Support planning conversations"],
    cannotDo: ["Approve a site", "Guarantee market outcomes", "Replace field validation"],
    costPerRunEstimate: "$0.002/run est.",
    trustLevel: "drafts-only",
    supportsManualRun: false,
    supportsConversation: true,
    portrait: {
      initials: "MM",
      accent: "from-lime-500 to-green-400",
      background: "from-lime-50 via-white to-green-50",
      jacket: "bg-lime-700",
      expression: "Searching",
    },
  },
  {
    name: "data-intelligence",
    label: "Data Steward",
    roleTitle: "Data Intelligence Agent",
    category: "operations",
    status: "active",
    trigger: "Manual data coverage audit, future weekly cron",
    description: "Maps what data exists, where it lives, and what Scout can safely retrieve.",
    mission: "Make the system trustworthy by keeping source-of-truth and retrieval gaps visible.",
    uses: ["Audits data coverage", "Explains source-of-truth issues", "Finds retrieval gaps"],
    howItWorks: [
      "Inspects app data coverage and known sources.",
      "Compares what exists against what operators expect.",
      "Reports gaps, stale sources, and missing routes.",
      "Helps prioritize data cleanup work.",
    ],
    dataSources: ["Supabase", "MasterSuite mirrors", "Integration logs", "Scout tool definitions"],
    guardrails: ["Read/audit focused", "Does not rewrite business data", "Escalates uncertain gaps"],
    canDo: ["Audit data trust", "Explain where fields come from", "Recommend cleanup priorities"],
    cannotDo: ["Fix every source automatically", "Bypass source-of-truth rules", "Use GHL as reporting truth"],
    costPerRunEstimate: "$0.002/run est.",
    trustLevel: "read-only",
    supportsManualRun: true,
    supportsConversation: true,
    manualRun: { url: "/api/agents/data-intelligence/run", method: "POST" },
    portrait: {
      initials: "DS",
      accent: "from-slate-600 to-cyan-500",
      background: "from-slate-50 via-white to-cyan-50",
      jacket: "bg-slate-800",
      expression: "Precise",
    },
  },
  {
    name: "runway-pipeline-guardian",
    label: "Runway Guardian",
    roleTitle: "Runway Pipeline Guardian",
    category: "franchisee-management",
    status: "active",
    trigger: "After MasterSuite territory sync, every 30-minute cron, and Run button",
    description: "Audits runway eligibility and stage placement against MasterSuite property evidence.",
    mission: "Keep franchisees in the right runway stage so coaching attention goes where it belongs.",
    uses: ["Checks runway eligibility", "Finds stage placement mistakes", "Protects coaching visibility"],
    howItWorks: [
      "Reads active territories and current runway rows.",
      "Compares them to purchase, completion, offer, and running evidence.",
      "Flags missing, unexpected, duplicate, or mismatched rows.",
      "Can repair only through explicit guarded paths.",
    ],
    dataSources: ["Territories", "Journey pipeline state", "MasterSuite properties", "Runway stages"],
    guardrails: ["Audit first", "Repair is explicit", "Logs every guardian run"],
    canDo: ["Detect runway drift", "Explain stage mismatches", "Support reliable coaching boards"],
    cannotDo: ["Change property facts", "Invent runway evidence", "Hide critical issues"],
    costPerRunEstimate: "$0.002/run est.",
    trustLevel: "manual-only",
    supportsManualRun: true,
    supportsConversation: true,
    manualRun: { url: "/api/agents/runway-pipeline-guardian/run", method: "POST", body: { repair: false } },
    portrait: {
      initials: "RG",
      accent: "from-rose-500 to-red-400",
      background: "from-rose-50 via-white to-red-50",
      jacket: "bg-rose-800",
      expression: "Guarding",
    },
  },
  {
    name: "marketing-intelligence",
    label: "Demand Builder",
    roleTitle: "Marketing Intelligence Agent",
    category: "marketing",
    status: "planned",
    trigger: "Planned: ad-platform sync, lead source changes, and weekly growth review",
    description: "Will summarize Google, Facebook, nurture, spend, source quality, and missed channel opportunities.",
    mission: "Show what is producing leads, what is missing, and where to push next.",
    uses: ["Explain channel performance", "Find lead-gen gaps", "Recommend next tests"],
    howItWorks: [
      "Reads source performance and ad data when access is connected.",
      "Compares lead quality across channels.",
      "Finds territories or channels missing activity.",
      "Recommends next marketing tests.",
    ],
    dataSources: ["Marketing V1", "Contacts attribution", "Google Ads pending", "Meta Ads pending", "EOS channels"],
    guardrails: ["No fake spend data", "Google/Facebook access required", "Recommendations need human approval"],
    canDo: ["Explain marketing performance", "Find opportunity gaps", "Help plan tests"],
    cannotDo: ["Use unavailable ad data", "Spend money automatically", "Launch campaigns without approval"],
    costPerRunEstimate: "$0.002/run est.",
    trustLevel: "read-only",
    supportsManualRun: false,
    supportsConversation: true,
    portrait: {
      initials: "DB",
      accent: "from-fuchsia-500 to-pink-400",
      background: "from-fuchsia-50 via-white to-pink-50",
      jacket: "bg-fuchsia-800",
      expression: "Creative",
    },
  },
  {
    name: "workflow-qa",
    label: "Automation Watch",
    roleTitle: "Workflow QA Agent",
    category: "operations",
    status: "planned",
    trigger: "Planned: workflow scheduler, approval queue, delivery sync, and stuck enrollment checks",
    description: "Will watch workflow runs, approvals, delivery, and stuck enrollments so automations stay trustworthy.",
    mission: "Make workflow automation safe enough that the team actually trusts it.",
    uses: ["Find stuck workflow steps", "Watch approval queues", "Surface delivery problems"],
    howItWorks: [
      "Reads workflow logs and enrollment state.",
      "Detects stuck, stale, or risky automation behavior.",
      "Explains what is blocked and why.",
      "Routes fixes through human approval.",
    ],
    dataSources: ["Workflow enrollments", "Step logs", "Approval queues", "Delivery sync"],
    guardrails: ["No auto-sending", "Human approval required", "SMS approval dependency respected"],
    canDo: ["Find automation risk", "Explain stuck steps", "Protect workflow trust"],
    cannotDo: ["Send customer SMS while blocked", "Bypass carrier approval", "Force live delivery proof"],
    costPerRunEstimate: "$0.002/run est.",
    trustLevel: "approval-required",
    supportsManualRun: false,
    supportsConversation: true,
    portrait: {
      initials: "AW",
      accent: "from-cyan-500 to-blue-400",
      background: "from-cyan-50 via-white to-blue-50",
      jacket: "bg-cyan-800",
      expression: "Watching",
    },
  },
  {
    name: "eos-sync",
    label: "EOS Operator",
    roleTitle: "EOS Sync Agent",
    category: "franchisee-management",
    status: "planned",
    trigger: "Planned: after EOS sync and before L10 review",
    description: "Will audit rocks, scorecards, todos, issues, habits, goals, and L10 mismatches.",
    mission: "Help operating meetings reflect the real business instead of stale records.",
    uses: ["Find missing EOS data", "Explain L10 mismatches", "Surface accountability gaps"],
    howItWorks: [
      "Reads EOS mirrors and L10-facing views.",
      "Compares expected records against current records.",
      "Flags missing or stale items.",
      "Summarizes what needs cleanup before meetings.",
    ],
    dataSources: ["MasterSuite EOS", "Supabase EOS mirrors", "L10 views"],
    guardrails: ["Audits first", "Does not rewrite meeting records automatically", "Keeps source-of-truth visible"],
    canDo: ["Find EOS gaps", "Prepare L10 cleanup", "Explain missing records"],
    cannotDo: ["Run the meeting", "Assign accountability without approval", "Patch source systems blindly"],
    costPerRunEstimate: "$0.002/run est.",
    trustLevel: "read-only",
    supportsManualRun: false,
    supportsConversation: true,
    portrait: {
      initials: "EO",
      accent: "from-yellow-500 to-amber-400",
      background: "from-yellow-50 via-white to-amber-50",
      jacket: "bg-yellow-700",
      expression: "Organized",
    },
  },
];

export function getAgentByName(name: string): AgentRegistryEntry | undefined {
  return AGENT_REGISTRY.find((agent) => agent.name === name);
}

