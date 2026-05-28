#!/usr/bin/env tsx
/**
 * Lightweight production smoke checks.
 *
 * Default checks are unauthenticated page/API shape checks that should be safe
 * to run after deploy. Use SMOKE_CRON=true only when intentionally checking
 * cron auth/health behavior; this script will not invoke heavy sync jobs.
 */

const baseUrl = (process.env.SMOKE_BASE_URL ?? "https://nah-franchise-os-sandbox.vercel.app/frandev").replace(/\/$/, "");

type Check = {
  name: string;
  path: string;
  method?: "GET" | "HEAD";
  expected: number[];
};

const checks: Check[] = [
  { name: "pipeline page", path: "/pipeline", method: "HEAD", expected: [200, 307, 308] },
  { name: "calls page", path: "/calls", method: "HEAD", expected: [200, 307, 308] },
  { name: "login page", path: "/login", method: "HEAD", expected: [200, 307, 308] },
  { name: "Scout chat route auth gate", path: "/api/scout/chat", method: "GET", expected: [401, 405] },
  { name: "contacts search auth gate", path: "/api/contacts/search?q=test", method: "GET", expected: [401] },
];

async function main() {
  let failed = false;

  for (const check of checks) {
    const url = `${baseUrl}${check.path}`;
    try {
      const res = await fetch(url, { method: check.method ?? "GET", redirect: "manual" });
      if (!check.expected.includes(res.status)) {
        failed = true;
        console.log(`✗ ${check.name}: ${res.status} ${url} (expected ${check.expected.join("/")})`);
      } else {
        console.log(`✓ ${check.name}: ${res.status}`);
      }
    } catch (err) {
      failed = true;
      console.log(`✗ ${check.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (failed) process.exit(1);
  console.log(`\nSmoke checks passed for ${baseUrl}`);
}

void main();
