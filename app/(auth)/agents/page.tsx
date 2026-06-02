"use client";

import {
  Bot,
  Brain,
  CalendarCheck,
  CircleDashed,
  DatabaseZap,
  LineChart,
  Map,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import AgentsPanel from "@/components/settings/AgentsPanel";

const FUTURE_AGENTS = [
  {
    name: "Workflow QA Agent",
    status: "Planned",
    icon: MessageSquareText,
    description:
      "Watches workflow runs, SMS delivery, approvals, and stuck enrollments so broken automations surface fast.",
  },
  {
    name: "Marketing Intelligence Agent",
    status: "Placeholder",
    icon: LineChart,
    description:
      "Summarizes Google Ads, Facebook Ads, nurturing campaigns, spend, lead quality, and missed lead-gen opportunities.",
  },
  {
    name: "Territory Status Agent",
    status: "Planned",
    icon: Map,
    description:
      "Keeps active/inactive status, onboarding stage, runway stage, owner context, and territory gaps up to date.",
  },
  {
    name: "EOS Sync Agent",
    status: "Planned",
    icon: DatabaseZap,
    description:
      "Audits MasterSuite EOS mirrors and flags missing rocks, scorecards, todos, issues, and L10 mismatches.",
  },
  {
    name: "Call Data Completion Agent",
    status: "Placeholder",
    icon: Brain,
    description:
      "Checks whether post-call data populated contact profiles, territory records, journey notes, and next actions.",
  },
  {
    name: "Runway Coach Agent",
    status: "Placeholder",
    icon: CalendarCheck,
    description:
      "Tracks runway/onboarding sub-stage health and highlights franchisees or prospects that need follow-up.",
  },
];

export default function AgentsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bot size={22} className="text-nah-blue" />
            <h1 className="font-headline text-page-title text-text-primary">Agents</h1>
          </div>
          <p className="mt-2 max-w-3xl text-body text-text-secondary">
            Live agents, planned agents, and placeholders for the ideas that should become operating support across
            FranDev.
          </p>
        </div>
        <div className="rounded-lg border border-nah-blue/20 bg-nah-blue-light px-4 py-3 text-nah-blue">
          <div className="text-caption font-semibold uppercase tracking-wide">Planning Board</div>
          <div className="text-body-sm">Add future agent ideas here first, then promote them when ready.</div>
        </div>
      </div>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Sparkles size={16} className="text-nah-orange" />
          <h2 className="text-overline text-text-tertiary tracking-wider">LIVE AGENTS</h2>
        </div>
        <AgentsPanel />
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <CircleDashed size={16} className="text-text-tertiary" />
          <h2 className="text-overline text-text-tertiary tracking-wider">FUTURE AGENTS</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {FUTURE_AGENTS.map((agent) => {
            const Icon = agent.icon;
            return (
              <div key={agent.name} className="rounded-lg border border-border-default bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-nah-blue-light text-nah-blue">
                      <Icon size={18} />
                    </div>
                    <div>
                      <h3 className="text-card-title text-text-primary">{agent.name}</h3>
                      <p className="text-caption text-text-tertiary">Future operating support</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-bg-secondary px-2 py-1 text-[11px] font-semibold text-text-secondary">
                    {agent.status}
                  </span>
                </div>
                <p className="text-body-sm text-text-secondary">{agent.description}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
