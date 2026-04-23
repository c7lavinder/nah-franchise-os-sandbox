/**
 * Place the 5 orphan contacts surfaced by the Apr 23 audit into their
 * correct journeys, and merge the two contacts that have both a pre-@nah
 * record and a post-@nah record.
 *
 * Dona McLeod — two rows (one in journey, one with the @nah email). Same
 *   person, so this is a merge via scripts/merge-contact-pairs.ts pattern.
 * Tara Tolbert — same situation.
 * Rob Tinker — partner of Katherine Pierre, add as co_primary of her journey.
 * David Espen — acquisition manager on Ron Schinharl's Toledo territory —
 *   add as co_primary of Ron's journey.
 * Adeline Shobusa — journey unknown, surfaced but not placed.
 *
 * Dry-run by default. Pass --live to apply.
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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!);

/** Shorts resolved from the Apr 23 audit. */
const MERGES: Array<{ keepShort: string; dropShort: string; renameTo?: { first: string; last: string } }> = [
  { keepShort: "49e83f63", dropShort: "bad3739d" }, // Dona McLeod — keep in-journey row, absorb @nah email
  { keepShort: "419f1ef8", dropShort: "d78c92b7" }, // Tara Tolbert — same pattern
];

const MEMBERSHIPS: Array<{ contactShort: string; journeyId: string; role: string; note: string }> = [
  { contactShort: "fdcd1812", journeyId: "7f87d64b-ee74-42bc-a49c-0240991edc91", role: "co_primary", note: "Rob Tinker + Katherine Pierre, Reno" },
  { contactShort: "e8874f43", journeyId: "3ee59908-3530-4f9e-a51d-27c3254b6a14", role: "co_primary", note: "David Espen, Toledo acquisition manager on Ron Schinharl journey" },
];

interface Contact {
  id: string;
  ghl_contact_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

async function loadAllContacts(): Promise<Contact[]> {
  const PAGE = 1000;
  const out: Contact[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, ghl_contact_id, first_name, last_name, email")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...(data as Contact[]));
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

/** Minimal merge helper — absorb drop's emails + FKs into keep, delete drop. */
async function merge(keep: Contact, drop: Contact, dry: boolean): Promise<void> {
  console.log(`\n── MERGE  ${keep.first_name} ${keep.last_name} ──`);
  console.log(`   keep ${keep.id.slice(0, 8)} email=${keep.email ?? "null"}  ghl=${keep.ghl_contact_id ?? "—"}`);
  console.log(`   drop ${drop.id.slice(0, 8)} email=${drop.email ?? "null"}  ghl=${drop.ghl_contact_id ?? "—"}`);

  if (dry) {
    console.log(`   would add ${drop.email ?? "(no email)"} as primary on keep, move journey_contacts + journeys FKs, delete drop.`);
    return;
  }

  // 1. Install drop's email as PRIMARY on the keep side. The trigger keeps
  //    contacts.email in sync. For Dona/Tara the keep row currently has no
  //    email at all so this populates the main address cleanly.
  if (drop.email) {
    await supabase.from("contact_emails").update({ is_primary: false })
      .eq("contact_id", keep.id).eq("is_primary", true);
    await supabase.from("contact_emails").upsert({
      contact_id: keep.id, email: drop.email, is_primary: true, source: "merge",
    }, { onConflict: "contact_id,email" });
    console.log(`   set primary email to ${drop.email}`);
  }

  // 2. Move journey_contacts / journeys.primary_contact_id / related tables.
  await supabase.from("journey_contacts").update({ contact_id: keep.id }).eq("contact_id", drop.id);
  await supabase.from("journeys").update({ primary_contact_id: keep.id }).eq("primary_contact_id", drop.id);
  await supabase.from("calls").update({ contact_id: keep.id }).eq("contact_id", drop.id);
  await supabase.from("call_participants").update({ contact_id: keep.id }).eq("contact_id", drop.id);

  // 3. Remove drop's emails, then the contact row itself.
  await supabase.from("contact_emails").delete().eq("contact_id", drop.id);
  const { error } = await supabase.from("contacts").delete().eq("id", drop.id);
  if (error) console.log(`   DELETE ERR ${error.message}`);
  else console.log(`   deleted drop ${drop.id.slice(0, 8)}`);

  // 4. If keep had no ghl_contact_id and drop did, carry it forward so GHL
  //    sync still works for this person.
  if (!keep.ghl_contact_id && drop.ghl_contact_id) {
    await supabase.from("contacts").update({ ghl_contact_id: drop.ghl_contact_id }).eq("id", keep.id);
    console.log(`   carried ghl_contact_id from drop → keep`);
  }
}

async function addMember(
  contactId: string, journeyId: string, role: string, dry: boolean,
): Promise<void> {
  const { data: existing } = await supabase
    .from("journey_contacts")
    .select("id, left_at, role")
    .eq("journey_id", journeyId)
    .eq("contact_id", contactId);
  const active = (existing ?? []).find((r) => !r.left_at);
  if (active) {
    console.log(`   already member (role=${active.role}) — no change`);
    return;
  }
  if (dry) {
    console.log(`   would insert journey_contacts { journey=${journeyId.slice(0, 8)}, contact=${contactId.slice(0, 8)}, role=${role} }`);
    return;
  }
  const { error } = await supabase.from("journey_contacts").insert({
    journey_id: journeyId, contact_id: contactId, role,
  });
  if (error) console.log(`   ADD ERR ${error.message}`);
  else console.log(`   added as ${role}`);
}

async function main(live: boolean): Promise<void> {
  const dry = !live;
  console.log(`Mode: ${live ? "LIVE" : "DRY RUN"}\n`);

  const contacts = await loadAllContacts();
  const byShort = new Map<string, Contact>();
  for (const c of contacts) byShort.set(c.id.slice(0, 8), c);

  // ── Merges ──────────────────────────────────────────────────────────
  console.log("═══ MERGES ═══");
  for (const m of MERGES) {
    const keep = byShort.get(m.keepShort);
    const drop = byShort.get(m.dropShort);
    if (!keep || !drop) {
      console.log(`  [skip] ${m.keepShort}/${m.dropShort} not found`);
      continue;
    }
    await merge(keep, drop, dry);

    if (m.renameTo && !dry) {
      await supabase.from("contacts")
        .update({ first_name: m.renameTo.first, last_name: m.renameTo.last })
        .eq("id", keep.id);
      console.log(`   renamed keep → ${m.renameTo.first} ${m.renameTo.last}`);
    }
  }

  // ── Memberships ─────────────────────────────────────────────────────
  console.log("\n═══ MEMBERSHIPS ═══");
  for (const m of MEMBERSHIPS) {
    const contact = byShort.get(m.contactShort);
    if (!contact) {
      console.log(`\n[skip] ${m.contactShort} not found`);
      continue;
    }
    const { data: journey } = await supabase.from("journeys").select("id, name").eq("id", m.journeyId).maybeSingle();
    if (!journey) {
      console.log(`\n[skip] journey ${m.journeyId.slice(0, 8)} not found`);
      continue;
    }
    console.log(`\n── ADD ${contact.first_name} ${contact.last_name} → ${journey.name} as ${m.role}`);
    console.log(`   ${m.note}`);
    await addMember(contact.id, journey.id, m.role, dry);
  }

  // ── Unresolved ──────────────────────────────────────────────────────
  const unresolved = byShort.get("6fb89d1f");
  if (unresolved) {
    console.log(`\n═══ UNRESOLVED ═══`);
    console.log(`  Adeline Shobusa (${unresolved.id.slice(0, 8)}) — journey unknown. Left as-is; waiting on user.`);
  }
}

void main(process.argv.includes("--live")).catch((e) => {
  console.error(e);
  process.exit(1);
});
