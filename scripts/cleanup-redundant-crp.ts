/**
 * Delete contact_related_people rows that are now fully represented in
 * journey_contacts. A CRP row is redundant when its linked_contact_id
 * is an active member of the anchor contact's active journey.
 *
 * Inline CRP rows (linked_contact_id IS NULL) are kept — they represent
 * relationships we haven't materialized as real contacts yet.
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
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const DRY = !process.argv.includes("--apply");

async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const pageSize = 1000;
  let offset = 0;
  const all: T[] = [];
  while (true) {
    const { data, error } = await s.from(table).select(select).range(offset, offset + pageSize - 1);
    if (error) throw new Error(JSON.stringify(error));
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

interface Journey { id: string; primary_contact_id: string; status: string }
interface Member { journey_id: string; contact_id: string; left_at: string | null; contacts: { first_name: string | null; last_name: string | null } | null }
interface Crp {
  id: string; contact_id: string; linked_contact_id: string | null; deleted_at: string | null;
  first_name: string | null; last_name: string | null;
}

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

async function main() {
  console.log(DRY ? "DRY RUN" : "LIVE RUN");

  const [journeys, members, crp] = await Promise.all([
    fetchAll<Journey>("journeys", "id, primary_contact_id, status"),
    fetchAll<Member>("journey_contacts", "journey_id, contact_id, left_at, contacts(first_name, last_name)"),
    fetchAll<Crp>("contact_related_people", "id, contact_id, linked_contact_id, deleted_at, first_name, last_name"),
  ]);

  const activeJourneyByPrimary = new Map<string, string>();
  for (const j of journeys) if (j.status === "active") activeJourneyByPrimary.set(j.primary_contact_id, j.id);
  const activeMemberKey = new Set<string>();
  // Also index members by (journey_id, normalized-name) for inline-CRP matching.
  const memberNameByJourney = new Map<string, Set<string>>();
  for (const m of members) {
    if (m.left_at !== null) continue;
    activeMemberKey.add(`${m.journey_id}:${m.contact_id}`);
    const c = m.contacts;
    if (!c) continue;
    const nameKey = `${norm(c.first_name)} ${norm(c.last_name)}`.trim();
    if (!nameKey) continue;
    if (!memberNameByJourney.has(m.journey_id)) memberNameByJourney.set(m.journey_id, new Set());
    memberNameByJourney.get(m.journey_id)!.add(nameKey);
  }

  const redundant: string[] = [];
  for (const r of crp) {
    if (r.deleted_at) continue;
    const journeyId = activeJourneyByPrimary.get(r.contact_id);
    if (!journeyId) continue;

    // Case 1: linked contact is already a journey member → redundant.
    if (r.linked_contact_id && activeMemberKey.has(`${journeyId}:${r.linked_contact_id}`)) {
      redundant.push(r.id);
      continue;
    }

    // Case 2: inline-only CRP whose name matches an active journey member.
    if (!r.linked_contact_id && r.first_name) {
      const nameKey = `${norm(r.first_name)} ${norm(r.last_name)}`.trim();
      const names = memberNameByJourney.get(journeyId);
      if (names && names.has(nameKey)) {
        redundant.push(r.id);
        continue;
      }
      // Also match first-name only (e.g. "Elida MElida..." garbled vs "Elida Nicholson" member).
      const firstOnly = norm(r.first_name);
      if (names && firstOnly && [...names].some((n) => n.startsWith(firstOnly + " "))) {
        redundant.push(r.id);
      }
    }
  }

  console.log(`Total CRP rows: ${crp.length}`);
  console.log(`Redundant (covered by journey_contacts): ${redundant.length}`);

  if (redundant.length === 0) return;

  if (!DRY) {
    // Delete in chunks of 200.
    for (let i = 0; i < redundant.length; i += 200) {
      const chunk = redundant.slice(i, i + 200);
      const { error } = await s.from("contact_related_people").delete().in("id", chunk);
      if (error) throw new Error(`delete crp chunk: ${JSON.stringify(error)}`);
      console.log(`deleted ${Math.min(i + 200, redundant.length)}/${redundant.length}`);
    }
  }
  console.log("Done.");
}
void main();
