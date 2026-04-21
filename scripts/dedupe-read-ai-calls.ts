/**
 * Soft-delete duplicate calls that share the same read_ai_session_id.
 *
 * Keeps the earliest-created row, soft-deletes the rest. Default is DRY RUN —
 * pass --live to write.
 *
 *   DRY RUN:  npx tsx scripts/dedupe-read-ai-calls.ts
 *   LIVE:     npx tsx scripts/dedupe-read-ai-calls.ts --live
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const LIVE = process.argv.includes("--live");

async function main() {
  console.log(`Mode: ${LIVE ? "LIVE (writing)" : "DRY RUN (no writes)"}\n`);

  const { data: calls, error } = await supabase
    .from("calls")
    .select("id, title, read_ai_session_id, created_at")
    .not("read_ai_session_id", "is", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) { console.error(error.message); process.exit(1); }
  if (!calls?.length) { console.log("No calls with read_ai_session_id."); return; }

  const bySession = new Map<string, typeof calls>();
  for (const c of calls) {
    const s = c.read_ai_session_id!;
    if (!bySession.has(s)) bySession.set(s, []);
    bySession.get(s)!.push(c);
  }

  let kept = 0;
  let wouldDelete = 0;
  const toDelete: string[] = [];

  for (const [session, rows] of bySession.entries()) {
    if (rows.length <= 1) { kept++; continue; }
    kept++;
    const winner = rows[0]; // earliest
    for (const dupe of rows.slice(1)) {
      wouldDelete++;
      toDelete.push(dupe.id);
      console.log(
        `[${LIVE ? "delete" : "dry"}] session=${session} keep=${winner.id} ` +
          `dupe=${dupe.id} (${dupe.created_at}) title=${JSON.stringify(dupe.title)}`,
      );
    }
  }

  if (LIVE && toDelete.length > 0) {
    const { error: updateErr } = await supabase
      .from("calls")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", toDelete);
    if (updateErr) console.error("Update failed:", updateErr.message);
  }

  console.log("\n--- summary ---");
  console.log(`Unique sessions:      ${bySession.size}`);
  console.log(`Kept (earliest):      ${kept}`);
  console.log(`Duplicates ${LIVE ? "deleted" : "would delete"}: ${wouldDelete}`);
  if (!LIVE && wouldDelete > 0) console.log("\nDry run complete. Re-run with --live to apply.");
}

main().catch((err) => { console.error(err); process.exit(1); });
