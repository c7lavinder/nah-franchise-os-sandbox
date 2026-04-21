/**
 * Backfill calls.call_type_id for rows with NULL classification.
 *
 * Default mode is DRY RUN — prints every call it would update with the
 * old/new values and the reason, writes nothing. Pass --live to apply the
 * updates.
 *
 *   DRY RUN:  npx tsx scripts/backfill-call-types.ts
 *   LIVE:     npx tsx scripts/backfill-call-types.ts --live
 */

import { createClient } from "@supabase/supabase-js";
import { classifyCallType } from "../lib/calls/classify-type";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const LIVE = process.argv.includes("--live");

type ClassifySource = "read_ai" | "ghl_calendar" | "manual";

function normalizeSource(raw: string | null | undefined): ClassifySource {
  if (raw === "read_ai" || raw === "ghl_calendar" || raw === "manual") return raw;
  // Unknown source → treat as manual (least-privileged — no ghl title fallback).
  return "manual";
}

async function main() {
  console.log(`Mode: ${LIVE ? "LIVE (writing)" : "DRY RUN (no writes)"}\n`);

  const { data: calls, error } = await supabase
    .from("calls")
    .select("id, title, source, contact_id, hosted_by_user_id, read_ai_session_id, territory_ms_slug")
    .is("call_type_id", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) { console.error("Error fetching calls:", error.message); process.exit(1); }
  if (!calls?.length) { console.log("No calls with NULL call_type_id."); return; }
  console.log(`Found ${calls.length} calls with NULL call_type_id.\n`);

  const { data: callTypes } = await supabase.from("call_types").select("id, slug");
  const slugToId = new Map((callTypes ?? []).map((ct) => [ct.slug, ct.id as string]));

  let wouldUpdate = 0;
  let unresolved = 0;
  const summary: Record<string, number> = {};

  for (const call of calls) {
    // Rebuild NAH email list from call_participants → users.
    const { data: participants } = await supabase
      .from("call_participants")
      .select("email, role, territory_ms_slug")
      .eq("call_id", call.id);

    const nahEmails = (participants ?? [])
      .filter((p) => p.role === "nah_team" && p.email)
      .map((p) => p.email as string);

    // Fall back to the host's email if no participants are recorded.
    if (nahEmails.length === 0 && call.hosted_by_user_id) {
      const { data: host } = await supabase
        .from("users")
        .select("email")
        .eq("id", call.hosted_by_user_id)
        .maybeSingle();
      if (host?.email) nahEmails.push(host.email);
    }

    const hasTerritoryOwner = !!call.territory_ms_slug ||
      (participants ?? []).some((p) => !!p.territory_ms_slug);

    // is_internal: all recorded participants are NAH team AND there is at least one.
    const isInternal = (participants ?? []).length > 0 &&
      (participants ?? []).every((p) => p.role === "nah_team");

    const hasExternal = (participants ?? []).some(
      (p) => p.role === "prospect" || p.role === "franchisee",
    ) || (!isInternal && !!call.contact_id);

    const classification = classifyCallType({
      title: call.title ?? null,
      nah_emails: nahEmails,
      is_internal: isInternal,
      has_external_participant: hasExternal,
      has_territory_owner: hasTerritoryOwner,
      source: normalizeSource(call.source),
    });

    const newCallTypeId = slugToId.get(classification.slug) ?? null;
    if (!newCallTypeId) {
      console.warn(`[skip] call ${call.id}: slug '${classification.slug}' not in call_types table`);
      unresolved++;
      continue;
    }

    summary[classification.slug] = (summary[classification.slug] ?? 0) + 1;
    wouldUpdate++;

    console.log(
      `[${LIVE ? "write" : "dry"}] ${call.id} source=${call.source ?? "null"} ` +
        `title=${JSON.stringify(call.title ?? "")} → slug=${classification.slug} ` +
        `(${classification.reason})`,
    );

    if (LIVE) {
      const { error: updateError } = await supabase
        .from("calls")
        .update({
          call_type_id: newCallTypeId,
          classification_reason: classification.reason,
        })
        .eq("id", call.id);
      if (updateError) {
        console.error(`[error] call ${call.id}: ${updateError.message}`);
      }
    }
  }

  console.log("\n--- summary ---");
  console.log(`Total NULL rows:        ${calls.length}`);
  console.log(`Would update:           ${wouldUpdate}`);
  console.log(`Unresolved (no slug):   ${unresolved}`);
  for (const [slug, count] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${slug.padEnd(20)} ${count}`);
  }
  if (!LIVE) {
    console.log("\nDry run complete. Re-run with --live to apply these changes.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
