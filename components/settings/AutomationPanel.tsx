"use client";

import CronCalendar from "./CronCalendar";
import AgentsPanel from "./AgentsPanel";

export default function AutomationPanel() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Cron Calendar */}
      <div>
        <h2 className="text-overline text-text-tertiary tracking-wider mb-4">CRON SCHEDULE</h2>
        <CronCalendar />
      </div>

      {/* Right: AI Agents */}
      <div>
        <h2 className="text-overline text-text-tertiary tracking-wider mb-4">AI AGENTS</h2>
        <AgentsPanel />
      </div>
    </div>
  );
}
