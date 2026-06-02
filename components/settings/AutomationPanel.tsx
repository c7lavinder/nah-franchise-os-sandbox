"use client";

import CronCalendar from "./CronCalendar";

export default function AutomationPanel() {
  return (
    <div>
      <h2 className="text-overline text-text-tertiary tracking-wider mb-4">CRON SCHEDULE</h2>
      <CronCalendar />
    </div>
  );
}
