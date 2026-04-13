/**
 * Backfill call_participants for existing calls.
 *
 * For each call:
 * 1. If call has read_ai_session_id → resolve from participant_emails
 * 2. Otherwise → use hosted_by_user_id + contact_id from the call record
 *
 * Run: npx tsx scripts/backfill-call-participants.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const NAH_DOMAIN = "newagainhouses.com";

async function main() {
  console.log("Fetching calls...");
  const { data: calls, error } = await supabase
    .from("calls")
    .select("id, hosted_by_user_id, contact_id, read_ai_session_id")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) { console.error("Error fetching calls:", error.message); process.exit(1); }
  if (!calls?.length) { console.log("No calls found."); return; }

  // Check which calls already have participants
  const { data: existingRows } = await supabase
    .from("call_participants")
    .select("call_id")
    .in("call_id", calls.map((c) => c.id));

  const alreadyDone = new Set((existingRows ?? []).map((r) => r.call_id));

  // Preload all users for email matching
  const { data: allUsers } = await supabase.from("users").select("id, email, full_name").not("email", "is", null);
  const emailToUser = new Map<string, { id: string; name: string }>();
  for (const u of allUsers ?? []) {
    if (u.email) emailToUser.set(u.email.toLowerCase(), { id: u.id, name: u.full_name });
  }

  let inserted = 0;
  let skipped = 0;

  for (const call of calls) {
    if (alreadyDone.has(call.id)) { skipped++; continue; }

    const rows: { call_id: string; user_id: string | null; contact_id: string | null; role: string; display_name: string | null; email: string | null }[] = [];

    // Try Read.ai session first
    if (call.read_ai_session_id) {
      const { data: session } = await supabase
        .from("read_ai_sessions")
        .select("participant_emails")
        .eq("session_id", call.read_ai_session_id)
        .maybeSingle();

      if (session?.participant_emails?.length) {
        for (const email of session.participant_emails) {
          const lc = email.toLowerCase();

          if (lc.endsWith(`@${NAH_DOMAIN}`)) {
            const user = emailToUser.get(lc);
            rows.push({
              call_id: call.id,
              user_id: user?.id ?? null,
              contact_id: null,
              role: "nah_team",
              display_name: user?.name ?? email.split("@")[0],
              email,
            });
          } else {
            // Match to contact
            const { data: contact } = await supabase
              .from("contacts")
              .select("id, ghl_contact_id, first_name, last_name")
              .ilike("email", lc)
              .maybeSingle();

            let role = "unknown";
            if (contact) {
              const { data: ownerLink } = await supabase
                .from("territory_owners")
                .select("ms_slug")
                .eq("ghl_contact_id", contact.ghl_contact_id)
                .is("end_date", null)
                .maybeSingle();
              role = ownerLink?.ms_slug ? "franchisee" : "prospect";
            }

            rows.push({
              call_id: call.id,
              user_id: null,
              contact_id: contact?.id ?? null,
              role,
              display_name: contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") : email,
              email,
            });
          }
        }
      }
    }

    // Fallback: use hosted_by_user_id + contact_id from call record
    if (rows.length === 0) {
      if (call.hosted_by_user_id) {
        const { data: host } = await supabase
          .from("users")
          .select("id, full_name, email")
          .eq("id", call.hosted_by_user_id)
          .single();
        if (host) {
          rows.push({
            call_id: call.id,
            user_id: host.id,
            contact_id: null,
            role: "nah_team",
            display_name: host.full_name,
            email: host.email,
          });
        }
      }

      if (call.contact_id) {
        const { data: contact } = await supabase
          .from("contacts")
          .select("id, first_name, last_name, email")
          .eq("id", call.contact_id)
          .single();
        if (contact) {
          rows.push({
            call_id: call.id,
            user_id: null,
            contact_id: contact.id,
            role: "prospect",
            display_name: [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unknown",
            email: contact.email,
          });
        }
      }
    }

    if (rows.length > 0) {
      const { error: insertErr } = await supabase.from("call_participants").insert(rows);
      if (insertErr) {
        console.error(`  Error on call ${call.id}:`, insertErr.message);
      } else {
        inserted += rows.length;
        console.log(`  Call ${call.id}: inserted ${rows.length} participants`);
      }
    }
  }

  console.log(`\nDone. Inserted ${inserted} rows. Skipped ${skipped} calls (already had participants).`);
}

main().catch(console.error);
