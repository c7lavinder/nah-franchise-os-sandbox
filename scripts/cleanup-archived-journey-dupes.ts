/**
 * One-off script: clean up archived duplicate journeys.
 *
 * The journeys backfill created duplicate journeys for contacts that had
 * multiple contact_pipeline_state rows. This script:
 *
 * 1. Finds contacts with multiple journeys
 * 2. Picks a "keeper" (active preferred, else newest)
 * 3. Reassigns call_data_extractions and call_action_items to the keeper
 * 4. Deletes the archived dupes (CASCADE removes jps + journey_contacts)
 *
 * Run: npx tsx scripts/cleanup-archived-journey-dupes.ts
 * Add --dry-run to preview without making changes.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const DRY_RUN = process.argv.includes("--dry-run");

async function sbFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options?.method === "PATCH" || options?.method === "DELETE" ? "return=minimal" : "return=representation",
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${options?.method ?? "GET"} ${path}: ${res.status} ${text}`);
  }
  if (options?.method === "DELETE" || options?.method === "PATCH") return null;
  return res.json();
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== LIVE RUN ===");

  // 1. Fetch all journeys (paginated)
  type Journey = { id: string; primary_contact_id: string; status: string; created_at: string };
  const allJourneys: Journey[] = [];
  let offset = 0;
  while (true) {
    const rows: Journey[] = await sbFetch(
      `journeys?select=id,primary_contact_id,status,created_at&order=created_at.asc&offset=${offset}&limit=1000`
    );
    allJourneys.push(...rows);
    if (rows.length < 1000) break;
    offset += 1000;
  }
  console.log(`Total journeys: ${allJourneys.length}`);

  // 2. Group by contact
  const byContact = new Map<string, Journey[]>();
  for (const j of allJourneys) {
    const arr = byContact.get(j.primary_contact_id) ?? [];
    arr.push(j);
    byContact.set(j.primary_contact_id, arr);
  }

  // 3. Determine keepers and dupes
  const toDelete: string[] = [];
  const reassignMap = new Map<string, string>(); // archived ID -> keeper ID

  for (const [, journeys] of byContact) {
    if (journeys.length <= 1) continue;

    const active = journeys.filter((j) => j.status === "active");
    const archived = journeys.filter((j) => j.status === "archived");

    let keeper: string;
    let dupes: Journey[];

    if (active.length >= 1) {
      keeper = active[0].id;
      dupes = archived;
    } else if (archived.length > 1) {
      archived.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      keeper = archived[0].id;
      dupes = archived.slice(1);
    } else {
      continue;
    }

    for (const d of dupes) {
      toDelete.push(d.id);
      reassignMap.set(d.id, keeper);
    }
  }

  console.log(`Contacts with dupes: ${reassignMap.size > 0 ? new Set(reassignMap.values()).size : 0}`);
  console.log(`Archived dupes to delete: ${toDelete.length}`);

  if (toDelete.length === 0) {
    console.log("Nothing to clean up.");
    return;
  }

  // 4. Reassign call_data_extractions and call_action_items
  let extractionsReassigned = 0;
  let actionsReassigned = 0;

  for (const [oldId, keeperId] of reassignMap) {
    if (!DRY_RUN) {
      await sbFetch(`call_data_extractions?journey_id=eq.${oldId}`, {
        method: "PATCH",
        body: JSON.stringify({ journey_id: keeperId }),
      }).catch(() => null);

      await sbFetch(`call_action_items?journey_id=eq.${oldId}`, {
        method: "PATCH",
        body: JSON.stringify({ journey_id: keeperId }),
      }).catch(() => null);
    }
  }
  if (!DRY_RUN) console.log("Reassigned call extractions and action items to keeper journeys.");

  // 5. Delete archived dupes in batches
  const BATCH = 50;
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const batch = toDelete.slice(i, i + BATCH);
    const idFilter = batch.map((id) => `"${id}"`).join(",");
    if (!DRY_RUN) {
      await sbFetch(`journeys?id=in.(${idFilter})`, { method: "DELETE" });
    }
    deleted += batch.length;
    if (deleted % 500 === 0 || i + BATCH >= toDelete.length) {
      console.log(`  Deleted ${deleted}/${toDelete.length}...`);
    }
  }

  console.log(`\nDone. Deleted ${deleted} archived duplicate journeys.`);
  console.log("Cascaded: journey_pipeline_state + journey_contacts rows removed automatically.");
}

main().catch(console.error);
