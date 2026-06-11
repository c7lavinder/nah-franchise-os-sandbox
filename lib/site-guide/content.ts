import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  GitBranch,
  Phone,
  Search,
  Settings,
  Users,
} from "lucide-react";

export interface SiteGuideModule {
  id: string;
  title: string;
  path: string;
  updatedAt: string;
  owner: string;
  icon: LucideIcon;
  purpose: string;
  dailyWorkflow: string[];
  whatGoodLooksLike: string[];
  commonMistakes: string[];
}

export const siteGuideUpdatedAt = "June 11, 2026";

export const siteGuidePrinciples = [
  "FranDev is the daily operating system for franchise sales, onboarding, calls, and follow-up.",
  "Work from the live app first. The guide explains the workflow, but the source of truth is the current record in FranDev.",
  "When a user-facing workflow changes, update the matching Site Guide module in the same commit.",
];

export const siteGuideQuickStart = [
  "Start in Daily HQ to see what needs attention today.",
  "Use Pipeline to work the newest active people first inside each stage.",
  "Open a person or journey before changing status so you understand the context.",
  "Use Calls to review recordings, confirm participants, and apply action items.",
  "Leave notes, tasks, or stage changes where the next person can understand what happened.",
];

export const siteGuideModules: SiteGuideModule[] = [
  {
    id: "daily-hq",
    title: "Daily HQ",
    path: "/daily-hq",
    updatedAt: "June 11, 2026",
    owner: "All users",
    icon: CalendarCheck,
    purpose:
      "The starting page for the day. It pulls together the highest-priority people, tasks, calls, and follow-ups.",
    dailyWorkflow: [
      "Open Daily HQ at the start of the day.",
      "Review the priority list before jumping into Pipeline or Calls.",
      "Work anything overdue or time-sensitive first.",
      "Use the linked contact, journey, call, or task instead of recreating work elsewhere.",
    ],
    whatGoodLooksLike: [
      "The team can see what needs attention without asking Corey for a separate list.",
      "Follow-ups and call work are handled from the record they belong to.",
      "Completed work leaves enough context for the next person.",
    ],
    commonMistakes: [
      "Treating Daily HQ as a report instead of a work queue.",
      "Starting new tasks without checking whether the person already has an active journey or follow-up.",
    ],
  },
  {
    id: "pipeline",
    title: "Pipeline",
    path: "/pipeline",
    updatedAt: "June 11, 2026",
    owner: "Sales and leadership",
    icon: GitBranch,
    purpose:
      "The live board for moving people through Path to Ownership, Onboarding, Runway, Territories, and Follow-Up.",
    dailyWorkflow: [
      "Pick the pipeline you are working.",
      "Inside each stage, work the newest active people first unless leadership calls out a priority.",
      "Open the card before moving it so the stage, sub-task, team, journey, and territory make sense.",
      "Move the person only when the real-world step is complete or the next action is clear.",
    ],
    whatGoodLooksLike: [
      "Newer activity appears above stale cards inside each stage.",
      "Every movement matches something that actually happened: call, form, approval, training, or owner action.",
      "The next person can tell why the contact is in that stage.",
    ],
    commonMistakes: [
      "Moving a person because they feel stale instead of because the stage criteria changed.",
      "Ignoring the journey or territory context before changing a pipeline card.",
      "Letting old red cards hide newer people who just became active.",
    ],
  },
  {
    id: "calls",
    title: "Calls",
    path: "/calls",
    updatedAt: "June 11, 2026",
    owner: "Sales, coaching, and cleanup users",
    icon: Phone,
    purpose:
      "The place to review Read.ai and manual call records, confirm who was present, and turn call outcomes into action.",
    dailyWorkflow: [
      "Use the Calls page to find new, needs-review, team, and group calls.",
      "Open the call detail before trusting the list chip if a participant looks odd.",
      "Confirm participants, contact mapping, team ownership, journey, and territory.",
      "Review action items and apply only the ones that are correct.",
    ],
    whatGoodLooksLike: [
      "Known people show as real contacts or team members instead of raw emails or usernames.",
      "Group Calls contains cohort or multi-person recordings that belong together.",
      "Action items are either applied, edited, skipped, or left with a clear reason.",
    ],
    commonMistakes: [
      "Assuming a raw participant chip means the contact record is wrong.",
      "Leaving unknown participants unmapped when the person is clearly known.",
      "Treating group recordings as separate cleanup problems when they belong in Group Calls.",
    ],
  },
  {
    id: "contacts-journeys",
    title: "Contacts and Journeys",
    path: "/contacts",
    updatedAt: "June 11, 2026",
    owner: "All users",
    icon: Users,
    purpose:
      "Contact pages hold the person. Journey pages hold the active relationship, pipeline state, team, calls, tasks, and territory context.",
    dailyWorkflow: [
      "Search for the person before creating anything new.",
      "Use the contact page to verify identity, email, phone, related people, and notes.",
      "Use the journey page to understand where that person is in the franchise process.",
      "Add notes or updates where they help the next workflow step.",
    ],
    whatGoodLooksLike: [
      "Duplicate contacts are avoided.",
      "Alternate emails are captured when a known person appears under a different email.",
      "Journey status, team, and territory context line up with the pipeline board.",
    ],
    commonMistakes: [
      "Creating a new contact before searching existing records.",
      "Updating the contact but missing the active journey context.",
      "Leaving alternate emails out, which can make calls look unmapped later.",
    ],
  },
  {
    id: "search",
    title: "Search and Cleanup",
    path: "/knowledge",
    updatedAt: "June 11, 2026",
    owner: "Operators and cleanup users",
    icon: Search,
    purpose:
      "Search helps find contacts, knowledge, and context. Cleanup work keeps app data usable for the whole team.",
    dailyWorkflow: [
      "Search before asking where a person, call, or workflow lives.",
      "When data looks wrong, compare the list view with the detail page before changing records.",
      "Fix the smallest true data problem: missing alternate email, wrong participant mapping, wrong group call, or stale task.",
      "Escalate unclear cleanup instead of guessing.",
    ],
    whatGoodLooksLike: [
      "The same person resolves consistently across Calls, Contacts, Pipeline, and Journeys.",
      "Needs-review items are cleaned up without creating new duplicates.",
      "Ambiguous records are marked or escalated instead of silently changed.",
    ],
    commonMistakes: [
      "Fixing the visual symptom without checking the underlying mapping.",
      "Changing a record that only looks wrong because one list has not refreshed yet.",
    ],
  },
  {
    id: "admin-sync",
    title: "Admin, Settings, and Sync",
    path: "/settings",
    updatedAt: "June 11, 2026",
    owner: "Admins and operators",
    icon: Settings,
    purpose:
      "Settings and sync tools control users, permissions, pipelines, call types, integrations, and MasterSuite sync health.",
    dailyWorkflow: [
      "Use Settings only when you are changing system behavior, user access, integrations, or app configuration.",
      "Check sync health before assuming MasterSuite data is stale.",
      "If an alert appears, confirm whether the last successful run truly failed or completed with warnings.",
      "Document meaningful configuration changes so the team knows what changed.",
    ],
    whatGoodLooksLike: [
      "Only admins change configuration.",
      "Sync alerts are investigated from the underlying run status, not the alert text alone.",
      "Pipeline, call type, and user changes are reflected in the Site Guide when they affect workflows.",
    ],
    commonMistakes: [
      "Changing settings as a workaround for a single bad record.",
      "Assuming a sync warning means a failed sync without checking whether rows still upserted successfully.",
      "Forgetting to update training when a visible workflow changes.",
    ],
  },
];

export const siteGuideMeetingAgenda = [
  "10 minutes: what FranDev replaces and why the team should use it daily.",
  "20 minutes: live walkthrough of Daily HQ, Pipeline, Calls, and one contact journey.",
  "15 minutes: each person completes one real task in the app.",
  "10 minutes: collect confusion, missing guide sections, and product fixes.",
];

export const siteGuideUpdateChecklist = [
  {
    icon: BookOpen,
    title: "Update the guide content",
    description: "Edit lib/site-guide/content.ts when a user-facing workflow, label, page, or button changes.",
  },
  {
    icon: CheckCircle2,
    title: "Keep the date honest",
    description: "Bump the module updated date so the team can see the guide is current.",
  },
  {
    icon: AlertTriangle,
    title: "Call out behavior changes",
    description:
      "If a page works differently after a commit, add the new workflow and common mistake in the same commit.",
  },
];
