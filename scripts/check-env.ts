#!/usr/bin/env tsx
/**
 * Environment sanity check for FranDev.
 *
 * Prints missing variable names only — never prints secret values.
 * Use before local builds/deploy debugging so failures are explicit instead of
 * surfacing as opaque Next.js page-data errors.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ENV_GROUPS } from "@/lib/env";

const envFiles = [".env.local", ".vercel/.env.production.local"];

for (const file of envFiles) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) continue;

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

let failed = false;

for (const group of ENV_GROUPS) {
  const missing = group.required.filter((key) => !process.env[key]);
  const presentRequired = group.required.length - missing.length;
  const presentOptional = (group.optional ?? []).filter((key) => !!process.env[key]).length;

  if (missing.length > 0) {
    failed = true;
    console.log(`✗ ${group.name}: missing ${missing.join(", ")}`);
  } else {
    console.log(`✓ ${group.name}: ${presentRequired}/${group.required.length} required present`);
  }

  if (group.optional?.length) {
    console.log(`  optional present: ${presentOptional}/${group.optional.length}`);
  }
}

if (failed) {
  console.error("\nEnvironment check failed. Pull Vercel env with `vercel pull --yes --environment=production`, or create .env.local.");
  process.exit(1);
}

console.log("\nEnvironment check passed.");
