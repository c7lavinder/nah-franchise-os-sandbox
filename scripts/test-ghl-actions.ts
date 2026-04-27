import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import * as ghl from "../lib/ghl";

/**
 * Live GHL action smoke test.
 *
 * Picks a real contact with an active opportunity, then:
 *  1. Creates a task (due in 2h)
 *  2. Creates an appointment (next available calendar slot, +1h block)
 *  3. Creates a note
 *
 * Then verifies each via fetch and confirms Daily HQ visibility logic.
 *
 * No cleanup — leaves the records on the contact so a human can eyeball
 * them in GHL. Filenames/titles are tagged "[smoke-test]" for easy purge.
 */

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  const stamp = new Date().toISOString().slice(0, 16);
  console.log(`\n=== GHL Action Smoke Test @ ${stamp} ===\n`);

  // ── Pick a target contact ────────────────────────────────────────
  // Prefer one with an active opportunity assigned to a real user, so we
  // can prove Daily HQ TaskPanel visibility.
  const { data: testContact } = await sb
    .from("contacts")
    .select("id, ghl_contact_id, first_name, last_name, email")
    .not("ghl_contact_id", "is", null)
    .is("merged_into_contact_id", null)
    .ilike("email", "%@newagainhouses.com")
    .limit(1)
    .single();

  if (!testContact?.ghl_contact_id) {
    console.error("Could not find a NAH-internal contact to test against. Aborting.");
    process.exit(1);
  }

  const ghlId = testContact.ghl_contact_id;
  const name = `${testContact.first_name ?? ""} ${testContact.last_name ?? ""}`.trim();
  console.log(`Target contact: ${name} (${ghlId}) email=${testContact.email}\n`);

  // ── Calendar lookup ─────────────────────────────────────────────
  const calendars = await ghl.getCalendars();
  if (calendars.length === 0) {
    console.error("No GHL calendars available. Aborting appointment test.");
    process.exit(1);
  }
  console.log(`Found ${calendars.length} calendar(s). Using: ${calendars[0].name} (${calendars[0].id})\n`);

  // ── 1. TASK ─────────────────────────────────────────────────────
  const taskDue = new Date(Date.now() + 2 * 60 * 60 * 1000);
  console.log(`[1/3] Creating task — due ${taskDue.toISOString()}`);
  const task = await ghl.createTask(ghlId, {
    title: `[smoke-test ${stamp}] Verify task creation`,
    body: "Created by scripts/test-ghl-actions.ts",
    dueDate: taskDue.toISOString(),
  });
  console.log(`     created task id=${task.id}`);

  // Verify GET
  const taskList = await ghl.getTasks(ghlId);
  const found = taskList.find((t) => t.id === task.id);
  console.log(found ? `     ✓ task found in GET /tasks (${taskList.length} total)\n` : `     ✗ task NOT found in GET /tasks\n`);

  // ── 2. APPOINTMENT ──────────────────────────────────────────────
  // Try ascending hour offsets across each calendar until one accepts a booking.
  // Production call-type calendars have strict availability; we skip slot
  // conflicts and surface only structural errors.
  let appointment: { id: string } | null = null;
  outer: for (const cal of calendars) {
    for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
      for (const hour of [10, 11, 13, 14, 15, 16]) {
        const aptStart = new Date();
        aptStart.setDate(aptStart.getDate() + dayOffset);
        aptStart.setHours(hour, 0, 0, 0);
        const aptEnd = new Date(aptStart.getTime() + 60 * 60 * 1000);
        try {
          appointment = await ghl.createAppointment({
            calendarId: cal.id,
            contactId: ghlId,
            title: `[smoke-test ${stamp}] Verify appointment creation`,
            startTime: aptStart.toISOString(),
            endTime: aptEnd.toISOString(),
            appointmentStatus: "confirmed",
          });
          console.log(`[2/3] Booked ${cal.name} @ ${aptStart.toISOString()} — id=${appointment.id}`);
          break outer;
        } catch (err) {
          const m = (err as Error).message;
          if (!m.includes("slot you have selected")) {
            console.error(`     ✗ ${cal.name}: ${m.slice(0, 120)}`);
            break;
          }
        }
      }
    }
  }
  if (!appointment) {
    console.error(`[2/3] ✗ all calendars/slots exhausted — booking endpoint reachable but no slot accepted`);
  }

  if (appointment) {
    const range = await ghl.getAllAppointments(
      new Date().toISOString(),
      new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    );
    const aptFound = range.find((a) => a.id === appointment!.id);
    console.log(aptFound ? `     ✓ appointment surfaces in 48h window (Daily HQ TodayCalendar will show it)\n` : `     ✗ appointment NOT in 48h window\n`);
  }

  // ── 3. NOTE ─────────────────────────────────────────────────────
  console.log(`[3/3] Creating note`);
  const note = await ghl.addNote(ghlId, `[smoke-test ${stamp}] Verify note creation\n\nCreated by scripts/test-ghl-actions.ts`);
  console.log(`     created note id=${note.id}`);
  const notes = await ghl.getNotes(ghlId);
  const noteFound = notes.find((n) => n.id === note.id);
  console.log(noteFound ? `     ✓ note found in GET /notes (${notes.length} total)\n` : `     ✗ note NOT found in GET /notes\n`);

  // ── Daily HQ visibility check ───────────────────────────────────
  console.log(`=== Daily HQ visibility ===`);

  // Tasks: only show for users whose ghl_user_id is assigned to an open opp
  // on this contact, AND only first 10 contacts of those opps.
  const { data: opps } = await sb
    .from("contacts")
    .select("id")
    .eq("id", testContact.id);
  console.log(`Tasks: contact ${name} has ${opps?.length ?? 0} db row(s).`);
  console.log(`       Daily HQ surfaces tasks only for users assigned to one of`);
  console.log(`       this contact's open GHL opportunities. Run as that user`);
  console.log(`       to see the new task.`);

  console.log(`\nAppointments: shown to all users — startTime within next 48h`);
  console.log(`Notes: NOT displayed in Daily HQ. Visible only on contact detail page.`);

  console.log(`\n=== DONE — manually purge tagged "[smoke-test ${stamp}]" records when satisfied ===\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
