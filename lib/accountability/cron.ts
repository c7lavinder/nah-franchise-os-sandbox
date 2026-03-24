/**
 * Accountability Engine — Cron Scheduler
 *
 * Starts background cron jobs that run accountability checks on a schedule.
 * Call startAccountabilityCron() once on server startup.
 *
 * Schedule:
 * - Every 15 minutes: speed-to-lead + stale lead checks
 * - Every 2 hours: full sweep (validation, closing, FDD)
 */

import cron from "node-cron";
import {
  checkSpeedToLead,
  checkStaleLeads,
  checkValidationStaleness,
  checkClosingStall,
  checkFDDWindow,
} from "./engine";

let isRunning = false;

/** Starts the accountability cron jobs — safe to call multiple times */
export function startAccountabilityCron() {
  if (isRunning) return;
  isRunning = true;

  // Every 15 minutes — fast checks
  cron.schedule("*/15 * * * *", async () => {
    console.log("[cron] Running speed-to-lead + stale lead checks...");
    try {
      const speed = await checkSpeedToLead();
      const stale = await checkStaleLeads();
      console.log(`[cron] Fast checks complete — ${speed} speed alerts, ${stale} stale alerts`);
    } catch (err) {
      console.error("[cron] Fast checks failed:", err);
    }
  });

  // Every 2 hours — full sweep
  cron.schedule("0 */2 * * *", async () => {
    console.log("[cron] Running full accountability sweep...");
    try {
      const validation = await checkValidationStaleness();
      const closing = await checkClosingStall();
      const fdd = await checkFDDWindow();
      console.log(`[cron] Full sweep complete — ${validation} validation, ${closing} closing, ${fdd} FDD alerts`);
    } catch (err) {
      console.error("[cron] Full sweep failed:", err);
    }
  });

  console.log("[cron] Accountability engine started — fast checks every 15m, full sweep every 2h");
}
