import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";
import * as ghl from "../lib/ghl";

/**
 * One-time backfill of ghl_appointments from the GHL calendar API.
 *
 * Webhooks (AppointmentCreate/Update/Delete) keep the table fresh going
 * forward; this seeds existing bookings so the native calendar cards
 * aren't empty on day one.
 *
 * Window: 90 days back → 365 days forward.
 * Run: npx tsx scripts/backfill-ghl-appointments.ts [--dry-run]
 */

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  });

  const start = new Date(Date.now() - 90 * 24 * 3600 * 1000);
  const end = new Date(Date.now() + 365 * 24 * 3600 * 1000);
  console.log(
    `=== GHL appointments backfill (${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)})${dryRun ? " [dry-run]" : ""} ===\n`
  );

  const appointments = await ghl.getAllAppointments(start.toISOString(), end.toISOString());
  console.log(`Fetched ${appointments.length} appointments from GHL.`);
  if (dryRun) {
    for (const a of appointments.slice(0, 20)) {
      console.log(
        `  ${a.startTime}  ${a.title ?? "(untitled)"}  [${a.appointmentStatus ?? a.status}]  contact=${a.contactId}`
      );
    }
    return;
  }

  let upserted = 0;
  let failed = 0;
  for (const a of appointments) {
    const { error } = await sb.from("ghl_appointments").upsert(
      {
        ghl_appointment_id: a.id,
        calendar_id: a.calendarId ?? null,
        ghl_contact_id: a.contactId ?? null,
        title: a.title ?? null,
        assigned_user_id: a.assignedUserId ?? null,
        appointment_status: a.appointmentStatus ?? a.status ?? null,
        address: a.address ?? null,
        source: a.source ?? null,
        notes: a.notes ?? null,
        location_id: a.locationId ?? null,
        start_time: a.startTime ?? null,
        end_time: a.endTime ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "ghl_appointment_id" }
    );
    if (error) {
      failed++;
      console.log(`  FAILED ${a.id}: ${error.message}`);
    } else {
      upserted++;
    }
  }

  console.log(`\n=== Done: ${upserted} upserted, ${failed} failed ===`);
}

main().catch((err) => {
  console.error("Script error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
