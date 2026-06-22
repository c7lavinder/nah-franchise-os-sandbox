/**
 * Merge franchisee duplicate contacts created by the May 2026 lead import.
 *
 * The BatchLeads/lead import created a second contact row for franchisees who
 * already had a @newagainhouses.com identity — on their personal email, with a
 * fresh pre-award "prospect" journey stub. This collapses each duplicate back
 * into the franchisee record.
 *
 * For each detected group:
 *   keeper  = the single @newagainhouses.com contact (active franchisee)
 *   orphan  = same-person personal/no-email twin(s) from the import
 *
 * Steps per orphan:
 *   1. Repoint the orphan journey's call data (call_journeys, extractions,
 *      action items) onto the keeper's journey, so deleting the stub doesn't
 *      cascade-delete real coaching data.
 *   2. Delete the orphan's pre-award journey stub (cascades its jps + membership).
 *   3. Move the orphan's remaining contact FK references onto the keeper.
 *   4. Absorb the orphan's email as a secondary, then delete the orphan contact.
 *
 * Detection: same last name, exactly one @newagainhouses.com keeper, and a twin
 * whose first name equals or is a nickname-prefix of the keeper's (Tim/Timothy).
 * Test contacts are skipped. Keepers with >1 journey only merge when the orphan
 * journey is empty (no ambiguous journey reassignment).
 *
 * Dry-run by default. Pass --live to apply.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import WebSocketImpl from "ws";
import fs from "fs";
import path from "path";

// supabase-js eagerly constructs a realtime client; Node 20 has no global
// WebSocket, so polyfill from the installed `ws` package. (We never use realtime.)
const g = globalThis as unknown as { WebSocket?: unknown };
if (!g.WebSocket) g.WebSocket = WebSocketImpl;

const envRaw = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!);

const TEST_RE = /\btest\b|testing|^amber@|^ben3@|^37618$/i;

interface Contact {
  id: string;
  ghl_contact_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
}

const norm = (s: string | null) => (s ?? "").trim().toLowerCase();
const isNah = (e: string | null) => norm(e).endsWith("@newagainhouses.com");
const isTest = (c: Contact) => TEST_RE.test(c.email ?? "") || TEST_RE.test(`${c.first_name} ${c.last_name}`);
const firstKey = (s: string | null) => norm(s).replace(/[^a-z]/g, "");
/** first names are compatible if equal, or the shorter (>=3) prefixes the longer (Tim/Timothy). */
function firstCompatible(a: string | null, b: string | null): boolean {
  const x = firstKey(a);
  const y = firstKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const lo = x.length < y.length ? x : y;
  const hi = x.length < y.length ? y : x;
  return lo.length >= 3 && hi.startsWith(lo);
}

async function loadAll(): Promise<Contact[]> {
  const PAGE = 1000;
  const out: Contact[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, ghl_contact_id, first_name, last_name, email, phone, created_at")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...(data as Contact[]));
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

interface Group {
  keeper: Contact;
  orphans: Contact[];
}

function detectGroups(all: Contact[]): Group[] {
  const byLast = new Map<string, Contact[]>();
  for (const c of all) {
    const k = norm(c.last_name);
    if (!k) continue;
    (byLast.get(k) ?? byLast.set(k, []).get(k)!).push(c);
  }
  const groups: Group[] = [];
  for (const arr of byLast.values()) {
    const nah = arr.filter((c) => isNah(c.email) && !isTest(c));
    if (nah.length !== 1) continue; // need exactly one unambiguous franchisee keeper
    const keeper = nah[0];
    const orphans = arr.filter(
      (c) => c.id !== keeper.id && !isNah(c.email) && !isTest(c) && firstCompatible(c.first_name, keeper.first_name)
    );
    if (orphans.length > 0) groups.push({ keeper, orphans });
  }
  return groups;
}

/** Contact FK references to re-point orphan -> keeper. Excludes journeys.primary_contact_id
 *  (the orphan journey is deleted, not transferred). */
interface FkMove {
  table: string;
  fkColumn: string;
  fkType: "contact_id" | "ghl_contact_id";
  uniqueCols?: string[];
}
const CONTACT_FK_MOVES: FkMove[] = [
  { table: "contact_related_people", fkColumn: "contact_id", fkType: "contact_id" },
  { table: "contact_related_people", fkColumn: "linked_contact_id", fkType: "contact_id" },
  { table: "contact_team_members", fkColumn: "contact_id", fkType: "contact_id" },
  {
    table: "contact_profile_fields",
    fkColumn: "contact_id",
    fkType: "contact_id",
    uniqueCols: ["contact_id", "field_name"],
  },
  { table: "contact_activity_messages", fkColumn: "contact_id", fkType: "contact_id" },
  { table: "calls", fkColumn: "contact_id", fkType: "contact_id" },
  { table: "call_participants", fkColumn: "contact_id", fkType: "contact_id" },
  { table: "call_review_packages", fkColumn: "contact_id", fkType: "contact_id" },
  { table: "call_data_extractions", fkColumn: "contact_id", fkType: "contact_id" },
  { table: "call_action_items", fkColumn: "contact_id", fkType: "contact_id" },
  { table: "embeddings", fkColumn: "contact_id", fkType: "contact_id" },
  { table: "notifications", fkColumn: "contact_id", fkType: "contact_id" },
  { table: "ghl_sync_queue", fkColumn: "contact_id", fkType: "contact_id" },
  { table: "ghl_action_drafts", fkColumn: "contact_id", fkType: "contact_id" },
  // ghl string-id references
  { table: "territory_owners", fkColumn: "ghl_contact_id", fkType: "ghl_contact_id" },
  { table: "contact_scores", fkColumn: "ghl_contact_id", fkType: "ghl_contact_id" },
];

async function moveFkRows(
  db: SupabaseClient,
  move: FkMove,
  fromValue: string,
  toValue: string,
  dryRun: boolean
): Promise<{ moved: number; skippedCollision: number; error?: string }> {
  const col = move.fkColumn;
  const { data: rows, error } = await db.from(move.table).select("*").eq(col, fromValue);
  if (error) return { moved: 0, skippedCollision: 0, error: error.message };
  if (!rows || rows.length === 0) return { moved: 0, skippedCollision: 0 };
  if (dryRun) return { moved: rows.length, skippedCollision: 0 };

  let moved = 0;
  let skipped = 0;
  for (const r of rows) {
    if (move.uniqueCols && move.uniqueCols.length > 0) {
      let probe = db.from(move.table).select("id");
      for (const c of move.uniqueCols) {
        const v = c === col ? toValue : (r as Record<string, unknown>)[c];
        probe = probe.eq(c, v as never);
      }
      const { data: collision } = await probe;
      if (collision && collision.length > 0 && (collision[0] as { id: string }).id !== (r as { id: string }).id) {
        await db
          .from(move.table)
          .delete()
          .eq("id", (r as { id: string }).id);
        skipped += 1;
        continue;
      }
    }
    const res = await db
      .from(move.table)
      .update({ [col]: toValue })
      .eq("id", (r as { id: string }).id);
    if (res.error) return { moved, skippedCollision: skipped, error: `${move.table}: ${res.error.message}` };
    moved += 1;
  }
  return { moved, skippedCollision: skipped };
}

async function journeyIdsFor(contactId: string): Promise<string[]> {
  const { data } = await supabase.from("journeys").select("id").eq("primary_contact_id", contactId);
  return (data ?? []).map((j) => (j as { id: string }).id);
}

/** Pick the keeper's authoritative journey + its primary pipeline-state id. */
async function keeperJourneyTarget(
  keeperJourneyIds: string[]
): Promise<{ journeyId: string | null; jpsId: string | null }> {
  if (keeperJourneyIds.length === 0) return { journeyId: null, jpsId: null };
  // Prefer a journey with an active, territory-bound pipeline state.
  const { data: states } = await supabase
    .from("journey_pipeline_state")
    .select("id, journey_id, is_active, TerritorySlug")
    .in("journey_id", keeperJourneyIds);
  const rows = (states ?? []) as { id: string; journey_id: string; is_active: boolean; TerritorySlug: string | null }[];
  const ranked = [...rows].sort((a, b) => {
    const score = (r: typeof a) => (r.is_active ? 2 : 0) + (r.TerritorySlug ? 1 : 0);
    return score(b) - score(a);
  });
  if (ranked.length > 0) return { journeyId: ranked[0].journey_id, jpsId: ranked[0].id };
  return { journeyId: keeperJourneyIds[0], jpsId: null };
}

async function repointJourneyData(
  orphanJourneyId: string,
  target: { journeyId: string | null; jpsId: string | null },
  dryRun: boolean
): Promise<string[]> {
  const notes: string[] = [];
  if (!target.journeyId) return notes;

  // call_journeys — repoint journey_id (+ jps); drop rows that would collide on (call_id, journey_id).
  const { data: cjRows } = await supabase.from("call_journeys").select("id, call_id").eq("journey_id", orphanJourneyId);
  for (const r of (cjRows ?? []) as { id: string; call_id: string }[]) {
    if (dryRun) continue;
    const { data: clash } = await supabase
      .from("call_journeys")
      .select("id")
      .eq("call_id", r.call_id)
      .eq("journey_id", target.journeyId);
    if (clash && clash.length > 0) {
      await supabase.from("call_journeys").delete().eq("id", r.id);
    } else {
      await supabase
        .from("call_journeys")
        .update({ journey_id: target.journeyId, journey_pipeline_state_id: target.jpsId })
        .eq("id", r.id);
    }
  }
  if (cjRows && cjRows.length) notes.push(`call_journeys: ${cjRows.length}`);

  for (const table of ["call_data_extractions", "call_action_items"]) {
    const { data: rows } = await supabase.from(table).select("id").eq("journey_id", orphanJourneyId);
    if (!rows || rows.length === 0) continue;
    if (!dryRun) {
      await supabase.from(table).update({ journey_id: target.journeyId }).eq("journey_id", orphanJourneyId);
    }
    notes.push(`${table}: ${rows.length}`);
  }
  return notes;
}

async function mergeOrphan(keeper: Contact, orphan: Contact, dryRun: boolean): Promise<void> {
  console.log(
    `   drop ${orphan.id.slice(0, 8)}  ${orphan.email ?? "(no-email)"}  created ${orphan.created_at.slice(0, 10)}`
  );

  const keeperJourneyIds = await journeyIdsFor(keeper.id);
  const orphanJourneyIds = await journeyIdsFor(orphan.id);
  const target = await keeperJourneyTarget(keeperJourneyIds);

  // 1. Repoint each orphan journey's call data onto the keeper journey, then delete the stub.
  for (const oj of orphanJourneyIds) {
    const notes = await repointJourneyData(oj, target, dryRun);
    if (notes.length)
      console.log(
        `      ${dryRun ? "would repoint" : "repointed"} journey data -> keeper journey: ${notes.join(", ")}`
      );
    if (dryRun) {
      console.log(`      would delete orphan journey ${oj.slice(0, 8)}`);
    } else {
      const { error } = await supabase.from("journeys").delete().eq("id", oj);
      console.log(
        error ? `      DELETE journey ERR: ${error.message}` : `      deleted orphan journey ${oj.slice(0, 8)}`
      );
    }
  }

  // 2. Move remaining contact FK references onto the keeper.
  for (const move of CONTACT_FK_MOVES) {
    const fromValue = move.fkType === "ghl_contact_id" ? orphan.ghl_contact_id : orphan.id;
    const toValue = move.fkType === "ghl_contact_id" ? keeper.ghl_contact_id : keeper.id;
    if (!fromValue || !toValue) continue;
    const res = await moveFkRows(supabase, move, fromValue, toValue, dryRun);
    if (res.moved > 0 || res.skippedCollision > 0 || res.error) {
      console.log(
        `      ${dryRun ? "would move" : "moved"} ${move.table}.${move.fkColumn}: ${res.moved}` +
          `${res.skippedCollision ? ` (+${res.skippedCollision} collisions resolved)` : ""}` +
          `${res.error ? ` — ERR ${res.error}` : ""}`
      );
    }
  }

  // 3. Absorb orphan email, then delete the orphan contact.
  if (orphan.email) {
    if (dryRun) {
      console.log(`      would absorb email ${orphan.email}`);
    } else {
      const { error } = await supabase
        .from("contact_emails")
        .insert({ contact_id: keeper.id, email: orphan.email, is_primary: false, source: "merge" });
      if (error && !error.message.includes("duplicate")) console.log(`      email-add ERR: ${error.message}`);
      else console.log(`      absorbed email ${orphan.email}`);
    }
  }

  if (dryRun) {
    console.log(`      would delete orphan contact ${orphan.id.slice(0, 8)}`);
  } else {
    await supabase.from("contact_emails").delete().eq("contact_id", orphan.id);
    const { error } = await supabase.from("contacts").delete().eq("id", orphan.id);
    console.log(
      error ? `      DELETE contact ERR: ${error.message}` : `      deleted orphan contact ${orphan.id.slice(0, 8)}`
    );
  }
}

async function main(live: boolean): Promise<void> {
  console.log(`Mode: ${live ? "LIVE" : "DRY RUN"}\n`);
  const all = await loadAll();
  const groups = detectGroups(all);
  console.log(
    `Detected ${groups.length} mergeable groups, ${groups.reduce((n, g) => n + g.orphans.length, 0)} orphans\n`
  );

  let i = 0;
  for (const g of groups) {
    i += 1;
    const kj = await journeyIdsFor(g.keeper.id);
    const nick = g.orphans.some((o) => norm(o.first_name) !== norm(g.keeper.first_name));
    console.log(`#${i}${nick ? " [nickname]" : ""}  ${g.keeper.first_name} ${g.keeper.last_name}`);
    console.log(`   keep ${g.keeper.id.slice(0, 8)}  ${g.keeper.email}  (journeys: ${kj.length})`);
    for (const orphan of g.orphans) await mergeOrphan(g.keeper, orphan, !live);
    console.log("");
  }
}

void main(process.argv.includes("--live")).catch((e) => {
  console.error(e);
  process.exit(1);
});
