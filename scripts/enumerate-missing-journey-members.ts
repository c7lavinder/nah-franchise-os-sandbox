/**
 * Build a review list of contact_related_people rows whose linked contact
 * is NOT yet a journey_contacts member of the anchor contact's journey.
 *
 * Output is grouped by journey name so the user can eyeball the list and
 * confirm before running a backfill. Read-only; no writes.
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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

async function fetchAll<T>(table: string, select: string, filter?: (q: unknown) => unknown): Promise<T[]> {
  const pageSize = 1000;
  let offset = 0;
  const all: T[] = [];
  while (true) {
    let q = supabase.from(table).select(select).range(offset, offset + pageSize - 1) as unknown;
    if (filter) q = filter(q);
    const { data, error } = await (q as { then: unknown } as Promise<{ data: T[] | null; error: unknown }>);
    if (error) throw new Error(JSON.stringify(error));
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

interface ContactRow { id: string; first_name: string | null; last_name: string | null; ghl_contact_id: string }
interface JourneyRow { id: string; name: string; primary_contact_id: string; status: string }
interface JourneyMemberRow { journey_id: string; contact_id: string; role: string; left_at: string | null }
interface RelatedRow {
  contact_id: string;
  linked_contact_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  relationship_notes: string | null;
  deleted_at: string | null;
}

async function main() {
  const [contacts, journeys, members, related] = await Promise.all([
    fetchAll<ContactRow>("contacts", "id, first_name, last_name, ghl_contact_id"),
    fetchAll<JourneyRow>("journeys", "id, name, primary_contact_id, status"),
    fetchAll<JourneyMemberRow>("journey_contacts", "journey_id, contact_id, role, left_at"),
    fetchAll<RelatedRow>("contact_related_people", "contact_id, linked_contact_id, first_name, last_name, email, phone, role, relationship_notes, deleted_at"),
  ]);

  const activeJourneys = journeys.filter((j) => j.status === "active");
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const journeysByPrimary = new Map<string, JourneyRow>();
  for (const j of activeJourneys) journeysByPrimary.set(j.primary_contact_id, j);

  // Active membership set keyed by (journey_id, contact_id).
  const activeMember = new Set<string>();
  for (const m of members) {
    if (m.left_at === null) activeMember.add(`${m.journey_id}:${m.contact_id}`);
  }

  // For each NON-deleted related_people row where the anchor contact is a
  // primary on an active journey, surface the row as a candidate unless the
  // linked contact is already a member. Rows with linked_contact_id=NULL
  // are shown separately — those need a contact record created before they
  // can be added to the journey.
  interface Linked {
    journey_id: string; journey_name: string; primary: string;
    linked_id: string; linked_name: string; role: string; notes: string | null;
  }
  interface Unlinked {
    journey_id: string; journey_name: string; primary: string;
    inline_name: string; email: string | null; phone: string | null;
    role: string; notes: string | null;
  }

  const linked: Linked[] = [];
  const unlinked: Unlinked[] = [];

  for (const r of related) {
    if (r.deleted_at) continue;
    const journey = journeysByPrimary.get(r.contact_id);
    if (!journey) continue;
    const primary = contactById.get(r.contact_id);
    if (!primary) continue;
    const primaryName = `${primary.first_name ?? ""} ${primary.last_name ?? ""}`.trim();

    if (r.linked_contact_id) {
      const key = `${journey.id}:${r.linked_contact_id}`;
      if (activeMember.has(key)) continue;
      const linkedContact = contactById.get(r.linked_contact_id);
      if (!linkedContact) continue;
      linked.push({
        journey_id: journey.id,
        journey_name: journey.name,
        primary: primaryName,
        linked_id: r.linked_contact_id,
        linked_name: `${linkedContact.first_name ?? ""} ${linkedContact.last_name ?? ""}`.trim(),
        role: r.role ?? "other",
        notes: r.relationship_notes,
      });
    } else {
      const inlineName = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim();
      if (!inlineName && !r.email) continue;
      unlinked.push({
        journey_id: journey.id,
        journey_name: journey.name,
        primary: primaryName,
        inline_name: inlineName || r.email || "(no name)",
        email: r.email,
        phone: r.phone,
        role: r.role ?? "other",
        notes: r.relationship_notes,
      });
    }
  }

  console.log(`\n═══ LINKED candidates (contact record already exists): ${linked.length} ═══`);
  const byJourneyLinked = new Map<string, Linked[]>();
  for (const c of linked) {
    const arr = byJourneyLinked.get(c.journey_id) ?? [];
    arr.push(c);
    byJourneyLinked.set(c.journey_id, arr);
  }
  const sortedLinked = [...byJourneyLinked.values()].sort((a, b) => a[0].journey_name.localeCompare(b[0].journey_name));
  for (const group of sortedLinked) {
    const head = group[0];
    console.log(`\n${head.journey_name} (journey ${head.journey_id.slice(0, 8)})`);
    for (const c of group) {
      console.log(`  + ${c.linked_name.padEnd(32)} role=${c.role.padEnd(20)} ${c.notes ? `notes="${c.notes}"` : ""}`);
    }
  }

  console.log(`\n═══ UNLINKED candidates (no contact record, inline only): ${unlinked.length} ═══`);
  const byJourneyUnlinked = new Map<string, Unlinked[]>();
  for (const c of unlinked) {
    const arr = byJourneyUnlinked.get(c.journey_id) ?? [];
    arr.push(c);
    byJourneyUnlinked.set(c.journey_id, arr);
  }
  const sortedUnlinked = [...byJourneyUnlinked.values()].sort((a, b) => a[0].journey_name.localeCompare(b[0].journey_name));
  for (const group of sortedUnlinked) {
    const head = group[0];
    console.log(`\n${head.journey_name} (journey ${head.journey_id.slice(0, 8)})`);
    for (const c of group) {
      console.log(`  + ${c.inline_name.padEnd(32)} role=${c.role.padEnd(20)} ${c.email ? `<${c.email}>` : ""} ${c.phone ? `(${c.phone})` : ""}`);
    }
  }
}

void main();
