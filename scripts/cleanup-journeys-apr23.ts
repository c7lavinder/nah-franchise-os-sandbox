/**
 * Round-2 cleanup following the Apr 23 contact audit.
 *
 * A. Place the last 3 orphaned contacts:
 *      Adeline Shobusa   → Douglas Ward journey (BRAZTS, now inactive)
 *      Jennifer Rife     → Larry Rife journey (DESMIA)
 *      Elida Maria Amador → delete (no identity)
 *
 * B. Merge duplicate-journey pairs created when scripts/merge-contact-pairs.ts
 *    absorbed a second contact row. Each of these franchisees now owns two
 *    journeys — one real (sales→onboarding→runway with a territory) and one
 *    leftover "followup/Nurture" bucket from the dupe. We keep the real
 *    journey, move any call references, then drop the leftover.
 *      Ryan Norman      drop 27a5640b  keep abd2fcd3 (NSHOMA runway)
 *      Alex Inanc       drop 0235de4d  keep 251f4106 (both followup only;
 *                                         canonical = older-created keep)
 *      Latoya Johnson   drop 2d496d60  keep dda0364d (same — both followup)
 *      Larry Rife       drop 627b0589  keep 36e7bc49 (DESMIA runway)
 *      John Adams       drop be2a8354  keep 7b704cd4 (John + Margie, HOTSAR)
 *
 * Dry-run by default. Pass --live to apply.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envRaw = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!);

const ADELINE_ID = "6fb89d1f";
const JENNIFER_ID = "cece1ef4";
const ELIDA_ID = "6429bd13";

const DOUGLAS_WARD_JOURNEY = "ac8d7789-9c98-4eeb-94e2-b4b27c21de1e";
const LARRY_RIFE_JOURNEY = "36e7bc49-20da-4b6b-86fa-fcb2ba68960d";

interface JourneyMerge {
  who: string;
  dropShort: string;
  keepShort: string;
}

const JOURNEY_MERGES: JourneyMerge[] = [
  { who: "Ryan Norman", dropShort: "27a5640b", keepShort: "abd2fcd3" },
  { who: "Alex Inanc", dropShort: "0235de4d", keepShort: "251f4106" },
  { who: "Latoya Johnson", dropShort: "2d496d60", keepShort: "dda0364d" },
  { who: "Larry Rife", dropShort: "627b0589", keepShort: "36e7bc49" },
  { who: "John Adams", dropShort: "be2a8354", keepShort: "7b704cd4" },
];

async function resolveContactShort(short: string): Promise<string | null> {
  const PAGE = 1000;
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) return null;
    const hit = data.find((c) => c.id.startsWith(short));
    if (hit) return hit.id;
    if (data.length < PAGE) return null;
    offset += PAGE;
  }
}

async function resolveJourneyShort(short: string): Promise<{ id: string; name: string } | null> {
  const PAGE = 1000;
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("journeys")
      .select("id, name")
      .range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) return null;
    const hit = data.find((j) => j.id.startsWith(short));
    if (hit) return hit;
    if (data.length < PAGE) return null;
    offset += PAGE;
  }
}

async function addMember(contactId: string, journeyId: string, role: string, dry: boolean): Promise<void> {
  const { data: existing } = await supabase
    .from("journey_contacts")
    .select("id, role, left_at")
    .eq("journey_id", journeyId)
    .eq("contact_id", contactId);
  const active = (existing ?? []).find((r) => !r.left_at);
  if (active) {
    console.log(`   already member as ${active.role}`);
    return;
  }
  if (dry) {
    console.log(`   would insert journey_contacts role=${role}`);
    return;
  }
  const { error } = await supabase.from("journey_contacts").insert({
    journey_id: journeyId,
    contact_id: contactId,
    role,
  });
  if (error) console.log(`   ADD ERR ${error.message}`);
  else console.log(`   added as ${role}`);
}

async function deleteContact(contactId: string, dry: boolean): Promise<void> {
  if (dry) {
    console.log(`   would delete contact ${contactId.slice(0, 8)}`);
    return;
  }
  // Clean up contact_emails first (cascade handles it, but trigger-safe).
  await supabase.from("contact_emails").delete().eq("contact_id", contactId);
  // Null out call_participants refs (FK is SET NULL already).
  await supabase.from("call_participants").update({ contact_id: null }).eq("contact_id", contactId);
  const { error } = await supabase.from("contacts").delete().eq("id", contactId);
  if (error) console.log(`   DELETE ERR ${error.message}`);
  else console.log(`   deleted contact ${contactId.slice(0, 8)}`);
}

/**
 * Merge drop journey into keep journey:
 *   1. Re-point call_journeys rows from drop → keep (skip any that would
 *      duplicate-key the keep side — we just delete those).
 *   2. Re-point jps rows from drop → keep where the (pipeline, territory)
 *      slot isn't already filled on keep. Leave conflicting rows behind;
 *      they'll cascade-delete when the drop journey is deleted.
 *   3. Delete the drop journey — cascade removes its journey_contacts +
 *      any stranded jps rows from step 2.
 */
async function mergeJourneys(
  drop: { id: string; name: string },
  keep: { id: string; name: string },
  dry: boolean
): Promise<void> {
  console.log(`   drop  ${drop.id.slice(0, 8)}  "${drop.name}"`);
  console.log(`   keep  ${keep.id.slice(0, 8)}  "${keep.name}"`);

  // 1. call_journeys — prefer keep; call_id unique per journey_id combination.
  const { data: cjRows } = await supabase.from("call_journeys").select("id, call_id").eq("journey_id", drop.id);
  for (const r of cjRows ?? []) {
    const { data: existing } = await supabase
      .from("call_journeys")
      .select("id")
      .eq("call_id", r.call_id)
      .eq("journey_id", keep.id)
      .maybeSingle();
    if (existing) {
      if (!dry) await supabase.from("call_journeys").delete().eq("id", r.id);
      console.log(`   ${dry ? "would delete" : "deleted"} duplicate call_journeys row`);
    } else {
      if (!dry) await supabase.from("call_journeys").update({ journey_id: keep.id }).eq("id", r.id);
      console.log(`   ${dry ? "would move" : "moved"} call_journey.${r.id.slice(0, 8)} → keep`);
    }
  }

  // 2. jps rows — migrate selectively. Rules:
  //    - Skip followup/nurture jps whenever the keep journey already has
  //      sales/onboarding/runway activity — those are leftover buckets from
  //      the pre-merge duplicate contact and shouldn't follow an active
  //      franchisee into their real journey.
  //    - Skip any jps that would collide with an existing active slot on
  //      keep (same pipeline + territory).
  //    - Otherwise move it.
  const { data: dropJps } = await supabase
    .from("journey_pipeline_state")
    .select("id, pipeline_id, TerritorySlug, is_active, pipelines(slug)")
    .eq("journey_id", drop.id);
  const { data: keepJps } = await supabase
    .from("journey_pipeline_state")
    .select("pipeline_id, TerritorySlug, is_active, pipelines(slug)")
    .eq("journey_id", keep.id)
    .eq("is_active", true);

  const keepHasRealActivity = (keepJps ?? []).some((k) => {
    const slug = (k.pipelines as unknown as { slug: string } | null)?.slug;
    return slug === "sales" || slug === "onboarding" || slug === "runway";
  });

  for (const j of dropJps ?? []) {
    const dropSlug = (j.pipelines as unknown as { slug: string } | null)?.slug;
    if (dropSlug === "followup" && keepHasRealActivity) {
      console.log(`   ${dry ? "would drop" : "dropping"} stale followup jps (keep is an active franchisee)`);
      continue;
    }

    const conflict = (keepJps ?? []).some(
      (k) => k.pipeline_id === j.pipeline_id && k.TerritorySlug === j.TerritorySlug
    );
    if (conflict) {
      console.log(
        `   ${dry ? "would skip" : "skipped"} jps (duplicate slot on keep) pipeline=${dropSlug} territory=${j.TerritorySlug ?? "—"}`
      );
      continue;
    }

    if (!dry) {
      const { error } = await supabase.from("journey_pipeline_state").update({ journey_id: keep.id }).eq("id", j.id);
      if (error) console.log(`   jps move ERR ${error.message}`);
      else console.log(`   moved jps ${j.id.slice(0, 8)} (${dropSlug}) → keep`);
    } else {
      console.log(`   would move jps ${j.id.slice(0, 8)} (${dropSlug}, territory=${j.TerritorySlug ?? "—"}) → keep`);
    }
  }

  // 3. Point call_data_extractions + call_action_items at keep (SET NULL FK,
  //    but let's preserve the link).
  for (const t of ["call_data_extractions", "call_action_items"]) {
    if (dry) continue;
    await supabase.from(t).update({ journey_id: keep.id }).eq("journey_id", drop.id);
  }

  // 4. Delete the drop journey — cascades clean up journey_contacts, any
  //    stranded jps rows, call_journeys, etc.
  if (!dry) {
    const { error } = await supabase.from("journeys").delete().eq("id", drop.id);
    if (error) console.log(`   DELETE ERR ${error.message}`);
    else console.log(`   deleted drop journey ${drop.id.slice(0, 8)}`);
  } else {
    console.log(`   would delete drop journey ${drop.id.slice(0, 8)}`);
  }
}

async function main(live: boolean): Promise<void> {
  const dry = !live;
  console.log(`Mode: ${live ? "LIVE" : "DRY RUN"}\n`);

  // ── A. Orphan placements ────────────────────────────────────────────
  console.log("═══ ORPHAN PLACEMENTS ═══");

  const adeline = await resolveContactShort(ADELINE_ID);
  if (adeline) {
    console.log(`\n── Adeline Shobusa → Douglas Ward (BRAZTS, inactive)`);
    await addMember(adeline, DOUGLAS_WARD_JOURNEY, "co_primary", dry);
  }

  const jennifer = await resolveContactShort(JENNIFER_ID);
  if (jennifer) {
    console.log(`\n── Jennifer Rife → Larry Rife (DESMIA)`);
    await addMember(jennifer, LARRY_RIFE_JOURNEY, "co_primary", dry);
  }

  const elida = await resolveContactShort(ELIDA_ID);
  if (elida) {
    console.log(`\n── Elida Maria Amador — DELETE`);
    await deleteContact(elida, dry);
  }

  // ── B. Journey-pair merges ──────────────────────────────────────────
  console.log("\n\n═══ JOURNEY MERGES ═══");
  for (const m of JOURNEY_MERGES) {
    console.log(`\n── ${m.who}`);
    const drop = await resolveJourneyShort(m.dropShort);
    const keep = await resolveJourneyShort(m.keepShort);
    if (!drop || !keep) {
      console.log(`   [skip] drop=${drop?.id.slice(0, 8) ?? "?"} keep=${keep?.id.slice(0, 8) ?? "?"} not found`);
      continue;
    }
    await mergeJourneys(drop, keep, dry);
  }
}

void main(process.argv.includes("--live")).catch((e) => {
  console.error(e);
  process.exit(1);
});
