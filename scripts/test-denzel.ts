/**
 * Test script: create a task + appointment for Denzel Lavinder, assigned to Chad.
 * Usage: npx tsx scripts/test-denzel.ts
 */

import { createTask } from "../lib/ghl/client";
import { createAppointment, getCalendars } from "../lib/ghl/client";

const DENZEL_GHL_ID = "BWy45fmPABvoBiDWmaxx";
const CHAD_GHL_ID = "LmwQtpaD5SSIIHe6r4Pk";

async function main() {
  // 1. Create a task
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  console.log("Creating task...");
  const task = await createTask(DENZEL_GHL_ID, {
    title: "Follow up call with Denzel Lavinder",
    body: "Discuss franchise territory options and next steps.",
    dueDate: tomorrow.toISOString(),
    assignedTo: CHAD_GHL_ID,
  });
  console.log("Task created:", task.id, "- due:", tomorrow.toISOString().slice(0, 10));

  // 2. Create an appointment
  const calendars = await getCalendars();
  if (calendars.length === 0) {
    console.log("No calendars found — skipping appointment.");
    return;
  }

  const calendar = calendars[0];
  console.log(`Using calendar: "${calendar.name}" (${calendar.id})`);

  const aptStart = new Date();
  aptStart.setDate(aptStart.getDate() + 1);
  aptStart.setHours(14, 0, 0, 0);
  const aptEnd = new Date(aptStart.getTime() + 30 * 60 * 1000);

  console.log("Creating appointment...");
  const appointment = await createAppointment({
    calendarId: calendar.id,
    contactId: DENZEL_GHL_ID,
    startTime: aptStart.toISOString(),
    endTime: aptEnd.toISOString(),
    title: "Intro Call - Denzel Lavinder",
    assignedUserId: CHAD_GHL_ID,
  });
  console.log("Appointment created:", appointment.id, "- at:", aptStart.toISOString().slice(0, 16));

  console.log("\nDone. Check Chad's Daily HQ — should show both.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
