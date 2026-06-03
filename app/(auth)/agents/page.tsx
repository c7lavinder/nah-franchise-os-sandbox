"use client";

import { Bot, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import AgentsPanel from "@/components/settings/AgentsPanel";

export default function AgentsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bot size={22} className="text-nah-blue" />
            <h1 className="font-headline text-page-title text-text-primary">FranDev Agents</h1>
          </div>
          <p className="mt-2 max-w-3xl text-body text-text-secondary">
            The AI operating team inside FranDev: what each agent owns, what it can touch, what still needs approval,
            and where it is already producing work.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-nah-blue/20 bg-nah-blue-light px-4 py-3 text-nah-blue">
            <div className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wide">
              <ShieldCheck size={14} />
              Guarded
            </div>
            <div className="text-body-sm">Customer-facing sends stay behind human approval.</div>
          </div>
          <div className="rounded-lg border border-nah-orange/25 bg-[#fff7ed] px-4 py-3 text-[#b45309]">
            <div className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wide">
              <Workflow size={14} />
              Workflow-ready
            </div>
            <div className="text-body-sm">Automation agents are visible before they are trusted to act.</div>
          </div>
        </div>
      </div>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Sparkles size={16} className="text-nah-orange" />
          <h2 className="text-overline text-text-tertiary tracking-wider">AI TEAM ROOM</h2>
        </div>
        <AgentsPanel />
      </section>
    </div>
  );
}
