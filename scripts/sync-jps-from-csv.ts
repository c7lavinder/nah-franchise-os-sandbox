/**
 * Sync journey_pipeline_state to match the franchise-locations CSV.
 *
 *   For each territory row, set the journey's (onboarding, runway)
 *   pipeline-state rows to match CSV's "Onboarding/Runway" + "Stage"
 *   columns.
 *
 * Rules (derived from user spec + inspection):
 *   - (Runway, Running)            → onboarding=Onboarded + runway=Running
 *   - (Runway, First Offer)        → onboarding=Onboarded + runway=First Offer
 *   - (Runway, First Purchase)     → onboarding=Onboarded + runway=First Purchase
 *   - (Runway, Inventory Building) → onboarding=Onboarded + runway=Inventory Building
 *   - (Runway, Onboarded)          → onboarding=Onboarded + runway=First Offer
 *     (CSV uses "Onboarded" loosely for "completed onboarding, just entered Runway")
 *   - (Onboarding, First Offer)    → onboarding=Onboarded + runway=First Offer
 *     (user-specified: "first offer as stage + onboarding as pipeline"
 *     means the franchisee has been onboarded and is now at first-offer)
 *   - (Onboarding, Training/Setup/Launch Prep) → onboarding=<stage> only
 *   - (non-active, *)              → leave alone, flagged in output
 *
 * Manual overrides from user:
 *   - MYTBCH (Myrtle Beach) → Runway/First Offer (CSV says non-active)
 *   - FREDVA already handled by rule above (CSV says Runway/Onboarded)
 *
 * Usage:
 *   pnpm tsx scripts/sync-jps-from-csv.ts          (dry-run)
 *   pnpm tsx scripts/sync-jps-from-csv.ts --apply  (write)
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const DRY = !process.argv.includes("--apply");
const envRaw = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

// ─── CSV parse ───────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        buf += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === "," && !inQ) {
      out.push(buf);
      buf = "";
    } else buf += c;
  }
  out.push(buf);
  return out;
}

interface CsvRow {
  slug: string;
  pipeline: string;
  stage: string;
}

function loadCsv(): CsvRow[] {
  const raw = fs.readFileSync(
    path.resolve(process.cwd(), "Onboarding_Runway NAH Franchise Locations a.o. 03.27.26 - Franchise Locations.csv"),
    "utf8"
  );
  const rows: CsvRow[] = [];
  for (const line of raw.split("\n")) {
    const cols = parseCsvLine(line);
    if (cols.length < 14) continue;
    const slug = cols[3]?.trim();
    if (!slug || slug === "Territory Slug") continue;
    if (slug === "TRI") continue; // home office, no franchisee
    rows.push({
      slug,
      pipeline: (cols[5] ?? "").trim(),
      stage: (cols[6] ?? "").trim(),
    });
  }

  // Manual overrides.
  for (const r of rows) {
    if (r.slug === "MYTBCH") {
      r.pipeline = "Runway";
      r.stage = "First Offer";
    }
  }
  return rows;
}

// ─── target-state derivation ─────────────────────────────────────────

type TargetState =
  | { kind: "skip"; reason: string }
  | { kind: "rows"; rows: { pipelineSlug: "onboarding" | "runway"; stageName: string }[] };

function targetFor(row: CsvRow): TargetState {
  const pipe = row.pipeline.toLowerCase();
  const stage = row.stage;

  if (pipe.startsWith("non-active") || !row.pipeline || !row.stage) {
    return { kind: "skip", reason: `CSV pipeline="${row.pipeline}" stage="${row.stage}"` };
  }

  // Runway pipeline variants.
  if (pipe === "runway") {
    if (stage === "Running")
      return {
        kind: "rows",
        rows: [
          { pipelineSlug: "onboarding", stageName: "Onboarded" },
          { pipelineSlug: "runway", stageName: "Running" },
        ],
      };
    if (stage === "Onboarded" || stage === "First Offer")
      return {
        kind: "rows",
        rows: [
          { pipelineSlug: "onboarding", stageName: "Onboarded" },
          { pipelineSlug: "runway", stageName: "First Offer" },
        ],
      };
    if (stage === "First Purchase")
      return {
        kind: "rows",
        rows: [
          { pipelineSlug: "onboarding", stageName: "Onboarded" },
          { pipelineSlug: "runway", stageName: "First Purchase" },
        ],
      };
    if (stage === "Inventory Building")
      return {
        kind: "rows",
        rows: [
          { pipelineSlug: "onboarding", stageName: "Onboarded" },
          { pipelineSlug: "runway", stageName: "Inventory Building" },
        ],
      };
    return { kind: "skip", reason: `unknown Runway stage "${stage}"` };
  }

  // Onboarding pipeline variants.
  if (pipe === "onboarding") {
    // User-specified: Onboarding/First Offer ⇒ onboarded + first offer runway.
    if (stage === "First Offer")
      return {
        kind: "rows",
        rows: [
          { pipelineSlug: "onboarding", stageName: "Onboarded" },
          { pipelineSlug: "runway", stageName: "First Offer" },
        ],
      };
    // Straight onboarding stages with no runway presence yet.
    if (["Setup", "Training", "Launch Prep", "Onboarded"].includes(stage))
      return { kind: "rows", rows: [{ pipelineSlug: "onboarding", stageName: stage }] };
    return { kind: "skip", reason: `unknown Onboarding stage "${stage}"` };
  }

  return { kind: "skip", reason: `unknown pipeline "${row.pipeline}"` };
}

// ─── DB helpers ──────────────────────────────────────────────────────

interface Pipe {
  id: string;
  slug: string;
}
interface Stage {
  id: string;
  name: string;
  pipeline_id: string;
}
interface Jps {
  id: string;
  journey_id: string;
  TerritorySlug: string | null;
  pipeline_id: string;
  current_stage_id: string;
  is_active: boolean;
}

async function loadLookups() {
  const [pRes, stRes] = await Promise.all([
    s.from("pipelines").select("id, slug"),
    s.from("pipeline_stages").select("id, name, pipeline_id"),
  ]);
  const pipes = (pRes.data ?? []) as Pipe[];
  const stages = (stRes.data ?? []) as Stage[];
  const pipeBySlug = new Map(pipes.map((p) => [p.slug, p]));
  const stageByKey = new Map<string, Stage>();
  for (const st of stages) {
    const pipe = pipes.find((p) => p.id === st.pipeline_id);
    if (!pipe) continue;
    stageByKey.set(`${pipe.slug}:${st.name}`, st);
  }
  return { pipeBySlug, stageByKey };
}

async function loadJpsForTerritories(slugs: string[]): Promise<Jps[]> {
  const out: Jps[] = [];
  const pageSize = 500;
  for (let i = 0; i < slugs.length; i += pageSize) {
    const chunk = slugs.slice(i, i + pageSize);
    const { data, error } = await s
      .from("journey_pipeline_state")
      .select("id, journey_id, TerritorySlug, pipeline_id, current_stage_id, is_active")
      .in("TerritorySlug", chunk);
    if (error) throw new Error(JSON.stringify(error));
    out.push(...((data ?? []) as Jps[]));
  }
  return out;
}

// ─── main ────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY ? "DRY RUN — no writes." : "LIVE RUN — writing.");
  const csv = loadCsv();
  const { pipeBySlug, stageByKey } = await loadLookups();
  const allJps = await loadJpsForTerritories(csv.map((r) => r.slug));

  // Group jps by (TerritorySlug → journey_id → pipeline_slug → row)
  const bySlug = new Map<string, Jps[]>();
  for (const j of allJps) {
    if (!j.TerritorySlug) continue;
    if (!bySlug.has(j.TerritorySlug)) bySlug.set(j.TerritorySlug, []);
    bySlug.get(j.TerritorySlug)!.push(j);
  }

  let changes = 0;
  let skipped = 0;
  const flagged: { slug: string; reason: string }[] = [];

  for (const row of csv) {
    const target = targetFor(row);
    if (target.kind === "skip") {
      flagged.push({ slug: row.slug, reason: target.reason });
      skipped++;
      continue;
    }

    const existingForTerritory = bySlug.get(row.slug) ?? [];
    if (existingForTerritory.length === 0) {
      console.log(`⚠  ${row.slug}: no existing journey_pipeline_state rows — no journey owns this territory yet`);
      continue;
    }

    // One territory may have >1 journey (rare, e.g. partnership split).
    // Update each owning journey's rows to match target independently.
    const byJourney = new Map<string, Jps[]>();
    for (const j of existingForTerritory) {
      if (!byJourney.has(j.journey_id)) byJourney.set(j.journey_id, []);
      byJourney.get(j.journey_id)!.push(j);
    }

    for (const [journeyId, jpsList] of byJourney) {
      // Per pipeline slug, compute desired stage_id. We only touch
      // onboarding + runway pipelines; sales/followup untouched.
      const targetByPipe = new Map<string, string>(); // pipelineSlug → stageId
      for (const t of target.rows) {
        const st = stageByKey.get(`${t.pipelineSlug}:${t.stageName}`);
        if (!st) throw new Error(`No stage for ${t.pipelineSlug}:${t.stageName}`);
        targetByPipe.set(t.pipelineSlug, st.id);
      }

      // Pipeline slugs we manage in this pass.
      const managed = new Set(["onboarding", "runway"]);

      // Existing rows on managed pipelines for this (journey, territory).
      const managedExisting = jpsList.filter((j) => {
        const pipe = [...pipeBySlug.values()].find((p) => p.id === j.pipeline_id);
        return pipe && managed.has(pipe.slug);
      });

      // 1. Rows to deactivate — active on a managed pipeline but pipeline
      //    isn't in target, OR row is at the wrong stage.
      for (const j of managedExisting) {
        const pipe = [...pipeBySlug.values()].find((p) => p.id === j.pipeline_id)!;
        const wantedStageId = targetByPipe.get(pipe.slug);
        if (!wantedStageId) {
          // Pipeline isn't in target — deactivate.
          if (j.is_active) {
            console.log(
              `  ${row.slug} j=${journeyId.slice(0, 8)} pipe=${pipe.slug}: is_active true → false (not in target)`
            );
            if (!DRY) {
              const { error } = await s.from("journey_pipeline_state").update({ is_active: false }).eq("id", j.id);
              if (error) throw new Error(JSON.stringify(error));
            }
            changes++;
          }
        } else if (j.current_stage_id !== wantedStageId || !j.is_active) {
          // Update stage + activate.
          const fromStage = [...stageByKey.entries()].find(([, st]) => st.id === j.current_stage_id)?.[1];
          const toStage = [...stageByKey.entries()].find(([, st]) => st.id === wantedStageId)?.[1];
          console.log(
            `  ${row.slug} j=${journeyId.slice(0, 8)} pipe=${pipe.slug}: ${fromStage?.name ?? "?"} → ${toStage?.name ?? "?"}`
          );
          if (!DRY) {
            const { error } = await s
              .from("journey_pipeline_state")
              .update({
                current_stage_id: wantedStageId,
                is_active: true,
                entered_current_stage_at: new Date().toISOString(),
              })
              .eq("id", j.id);
            if (error) throw new Error(JSON.stringify(error));
          }
          changes++;
        }
      }

      // 2. Rows to insert — pipelines in target but no existing row.
      for (const [pipeSlug, stageId] of targetByPipe) {
        const pipe = pipeBySlug.get(pipeSlug);
        if (!pipe) continue;
        const hasActive = managedExisting.some((j) => {
          const p = [...pipeBySlug.values()].find((pp) => pp.id === j.pipeline_id);
          return p?.slug === pipeSlug;
        });
        if (hasActive) continue;
        const stageName = [...stageByKey.entries()].find(([, st]) => st.id === stageId)?.[1].name;
        console.log(`  ${row.slug} j=${journeyId.slice(0, 8)} pipe=${pipeSlug}: INSERT at ${stageName}`);
        if (!DRY) {
          const { error } = await s.from("journey_pipeline_state").insert({
            journey_id: journeyId,
            TerritorySlug: row.slug,
            pipeline_id: pipe.id,
            current_stage_id: stageId,
            is_active: true,
            entered_pipeline_at: new Date().toISOString(),
            entered_current_stage_at: new Date().toISOString(),
          });
          if (error) throw new Error(JSON.stringify(error));
        }
        changes++;
      }
    }
  }

  console.log(`\n=========================================`);
  console.log(`Changes: ${changes}`);
  console.log(`Skipped (non-active / unknown): ${skipped}`);
  if (flagged.length > 0) {
    console.log(`\nFLAGGED (CSV non-active or unknown stage — left alone):`);
    for (const f of flagged) console.log(`  ${f.slug}: ${f.reason}`);
  }
}

void main();
