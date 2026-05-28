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

type EnvGroup = {
  name: string;
  required: string[];
  optional?: string[];
};

const groups: EnvGroup[] = [
  {
    name: "Core app / Supabase",
    required: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_KEY", "NEXT_PUBLIC_BASE_PATH"],
    optional: ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_URL"],
  },
  {
    name: "Auth / cron",
    required: ["MASTERSUITE_API_JWT_SECRET", "CRON_SECRET"],
    optional: ["MASTERSUITE_API_URL"],
  },
  {
    name: "Scout / AI",
    required: ["ANTHROPIC_API_KEY"],
    optional: ["OPENAI_API_KEY", "VOYAGE_API_KEY"],
  },
  {
    name: "MasterSuite sync",
    required: [
      "MASTERSUITE_DB_HOST",
      "MASTERSUITE_DB_PORT",
      "MASTERSUITE_DB_USER",
      "MASTERSUITE_DB_PASSWORD",
      "MASTERSUITE_DB_NAME",
    ],
  },
  {
    name: "GHL / Read.ai integrations",
    required: [],
    optional: ["GHL_LOCATION_ID", "GHL_CLIENT_ID", "GHL_CLIENT_SECRET", "READ_AI_API_KEY"],
  },
];

let failed = false;

for (const group of groups) {
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
