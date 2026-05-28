#!/usr/bin/env tsx
/**
 * DB drift report for FranDev.
 *
 * Read-only check that regenerates Supabase types from the linked production
 * project and compares them to the checked-in types/supabase.ts. This avoids
 * requiring an unsafe exec_sql RPC and catches schema/type drift before builds.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const DEFAULT_PROJECT_REF = "llnrvophuvrqcqducgrr";

function readProjectRef() {
  const linkedRefPath = resolve(process.cwd(), "supabase/.temp/project-ref");
  if (existsSync(linkedRefPath)) {
    const linked = readFileSync(linkedRefPath, "utf8").trim();
    if (linked) return linked;
  }
  return process.env.SUPABASE_PROJECT_REF || DEFAULT_PROJECT_REF;
}

function normalizeGeneratedTypes(text: string) {
  return text
    .replace(/^\/\*\*[\s\S]*?\*\/\n\n/, "")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

function countTables(text: string) {
  const matches = text.match(/^      [A-Za-z0-9_]+: \{/gm);
  return matches?.length ?? 0;
}

function firstDiffLine(a: string, b: string) {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const max = Math.max(aLines.length, bLines.length);
  for (let i = 0; i < max; i++) {
    if (aLines[i] !== bLines[i]) return i + 1;
  }
  return null;
}

async function main() {
  const projectRef = readProjectRef();
  const tmp = mkdtempSync(join(tmpdir(), "frandev-db-drift-"));
  const generatedPath = join(tmp, "supabase.generated.ts");

  try {
    const result = spawnSync(
      "npx",
      ["supabase", "gen", "types", "typescript", "--project-id", projectRef],
      { encoding: "utf8", maxBuffer: 1024 * 1024 * 20 }
    );

    if (result.status !== 0 || !result.stdout.trim()) {
      console.error("Could not regenerate Supabase types for drift check.");
      if (result.stderr) console.error(result.stderr.trim());
      process.exit(1);
    }

    writeFileSync(generatedPath, result.stdout);

    const checkedInPath = resolve(process.cwd(), "types/supabase.ts");
    const checkedInRaw = readFileSync(checkedInPath, "utf8");
    const generatedRaw = result.stdout;
    const checkedIn = normalizeGeneratedTypes(checkedInRaw);
    const generated = normalizeGeneratedTypes(generatedRaw);

    const checkedInTables = countTables(checkedIn);
    const generatedTables = countTables(generated);

    if (checkedIn === generated) {
      console.log(`DB drift check passed. types/supabase.ts matches project ${projectRef}.`);
      console.log(`Generated type tables: ${generatedTables}`);
      return;
    }

    const diffLine = firstDiffLine(checkedIn, generated);
    console.error("DB drift detected: types/supabase.ts does not match generated production types.");
    console.error(`Project ref: ${projectRef}`);
    console.error(`Checked-in type tables: ${checkedInTables}`);
    console.error(`Generated type tables: ${generatedTables}`);
    console.error(`First differing normalized line: ${diffLine ?? "unknown"}`);
    console.error("Fix: npx supabase gen types typescript --project-id " + projectRef + " > types/supabase.ts");
    process.exit(2);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

void main();
