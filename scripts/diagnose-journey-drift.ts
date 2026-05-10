/**
 * Diagnose why journey_pipeline_state counts drift from contact_pipeline_state
 * per stage. Paginates properly so 1000-row cap doesn't truncate.
 *
 *   npx tsx scripts/diagnose-journey-drift.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(offset, offset + 999);
    if (error) {
      console.error(error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as T[]));
    if (data.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

interface CpsRow {
  id: string;
  contact_id: string;
  pipeline_id: string;
  current_stage_id: string;
  is_active: boolean;
}
interface JpsRow {
  id: string;
  journey_id: string;
  pipeline_id: string;
  current_stage_id: string;
  TerritorySlug: string | null;
  is_active: boolean;
}
interface JourneyRow {
  id: string;
  primary_contact_id: string;
}
interface StageRow {
  id: string;
  name: string;
  pipeline_id: string;
}
interface PipelineRow {
  id: string;
  slug: string;
}

function hdr(title: string) {
  console.log(`\n━━ ${title} ━━`);
}

async function main() {
  const [cps, jps, journeys, stages, pipelines] = await Promise.all([
    fetchAll<CpsRow>("contact_pipeline_state", "id, contact_id, pipeline_id, current_stage_id, is_active"),
    fetchAll<JpsRow>(
      "journey_pipeline_state",
      "id, journey_id, pipeline_id, current_stage_id, TerritorySlug, is_active"
    ),
    fetchAll<JourneyRow>("journeys", "id, primary_contact_id"),
    fetchAll<StageRow>("pipeline_stages", "id, name, pipeline_id"),
    fetchAll<PipelineRow>("pipelines", "id, slug"),
  ]);

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const pipeById = new Map(pipelines.map((p) => [p.id, p]));
  const journeyByContact = new Map(journeys.map((j) => [j.primary_contact_id, j.id]));

  hdr("1 · Raw row counts");
  console.log(`  contact_pipeline_state total:       ${cps.length}`);
  console.log(`  contact_pipeline_state is_active:   ${cps.filter((r) => r.is_active).length}`);
  console.log(`  journey_pipeline_state total:       ${jps.length}`);
  console.log(`  journey_pipeline_state is_active:   ${jps.filter((r) => r.is_active).length}`);
  console.log(`  journeys total:                     ${journeys.length}`);

  hdr("2 · Active-count delta per stage (contact vs journey side)");
  const cpsByStage = new Map<string, number>();
  for (const r of cps.filter((r) => r.is_active)) {
    const s = stageById.get(r.current_stage_id);
    const p = s ? pipeById.get(s.pipeline_id) : null;
    const key = `${p?.slug ?? "?"} / ${s?.name ?? "?"}`;
    cpsByStage.set(key, (cpsByStage.get(key) ?? 0) + 1);
  }
  const jpsByStage = new Map<string, number>();
  for (const r of jps.filter((r) => r.is_active)) {
    const s = stageById.get(r.current_stage_id);
    const p = s ? pipeById.get(s.pipeline_id) : null;
    const key = `${p?.slug ?? "?"} / ${s?.name ?? "?"}`;
    jpsByStage.set(key, (jpsByStage.get(key) ?? 0) + 1);
  }
  const keys = new Set([...cpsByStage.keys(), ...jpsByStage.keys()]);
  for (const k of [...keys].sort()) {
    const b = cpsByStage.get(k) ?? 0;
    const a = jpsByStage.get(k) ?? 0;
    const delta = a - b;
    console.log(
      `  ${k.padEnd(50)} cps=${String(b).padStart(4)}  jps=${String(a).padStart(4)}  ${delta === 0 ? "·" : delta > 0 ? `+${delta}` : String(delta)}`
    );
  }

  hdr("3 · Per-contact comparison (find the mismatches)");
  const cpsActiveByContact = new Map<string, CpsRow[]>();
  for (const r of cps.filter((r) => r.is_active)) {
    const list = cpsActiveByContact.get(r.contact_id) ?? [];
    list.push(r);
    cpsActiveByContact.set(r.contact_id, list);
  }
  const jpsActiveByJourney = new Map<string, JpsRow[]>();
  for (const r of jps.filter((r) => r.is_active)) {
    const list = jpsActiveByJourney.get(r.journey_id) ?? [];
    list.push(r);
    jpsActiveByJourney.set(r.journey_id, list);
  }

  let lostContacts = 0; // contact has active cps but no matching active jps
  let extraContacts = 0; // journey has active jps but contact has no matching active cps
  let sampleLost: string[] = [];
  let sampleExtra: string[] = [];

  for (const [contactId, cpsRows] of cpsActiveByContact) {
    const journeyId = journeyByContact.get(contactId);
    const jpsRows = journeyId ? (jpsActiveByJourney.get(journeyId) ?? []) : [];
    for (const cpsR of cpsRows) {
      const match = jpsRows.find(
        (j) => j.pipeline_id === cpsR.pipeline_id && j.current_stage_id === cpsR.current_stage_id
      );
      if (!match) {
        lostContacts++;
        if (sampleLost.length < 10) {
          const s = stageById.get(cpsR.current_stage_id);
          const p = s ? pipeById.get(s.pipeline_id) : null;
          sampleLost.push(`contact ${contactId} — cps row in ${p?.slug}/${s?.name} has no matching active jps row`);
        }
      }
    }
  }

  for (const [journeyId, jpsRows] of jpsActiveByJourney) {
    const journey = journeys.find((j) => j.id === journeyId);
    const contactId = journey?.primary_contact_id;
    const cpsRows = contactId ? (cpsActiveByContact.get(contactId) ?? []) : [];
    for (const jpsR of jpsRows) {
      const match = cpsRows.find(
        (c) => c.pipeline_id === jpsR.pipeline_id && c.current_stage_id === jpsR.current_stage_id
      );
      if (!match) {
        extraContacts++;
        if (sampleExtra.length < 10) {
          const s = stageById.get(jpsR.current_stage_id);
          const p = s ? pipeById.get(s.pipeline_id) : null;
          sampleExtra.push(
            `journey ${journeyId} (contact ${contactId}) — jps row in ${p?.slug}/${s?.name} has no matching active cps row`
          );
        }
      }
    }
  }

  console.log(`  Lost cps rows (cps active, no matching jps):  ${lostContacts}`);
  console.log(`  Extra jps rows (jps active, no matching cps): ${extraContacts}`);
  if (sampleLost.length > 0) {
    console.log("\n  Examples of LOST rows:");
    for (const s of sampleLost) console.log(`    · ${s}`);
  }
  if (sampleExtra.length > 0) {
    console.log("\n  Examples of EXTRA rows:");
    for (const s of sampleExtra) console.log(`    · ${s}`);
  }

  hdr("4 · Contacts with is_active cps but no journey");
  const noJourney: string[] = [];
  for (const contactId of cpsActiveByContact.keys()) {
    if (!journeyByContact.has(contactId)) noJourney.push(contactId);
  }
  console.log(`  ${noJourney.length} contacts have active cps but no journey was created.`);
  if (noJourney.length > 0) {
    console.log(`    first 10: ${noJourney.slice(0, 10).join(", ")}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
