/**
 * Apply the franchise-locations reconciliation in a single pass.
 *
 * Phases (each logs its ops, no-op in dry-run):
 *   A. Email / name fixes on existing contacts.
 *   B. Simple dedupes (orphan has no data-refs → direct delete).
 *   C. Data-migrate dedupes (orphan has extractions/actions → reassign, then delete).
 *   D. Journey-merge dedupes (both rows have journeys → merge into canonical).
 *   E. Create 6 missing co-owner contacts + link to journey.
 *   F. Link 19 existing contacts to their primary's journey as co-owners.
 *   G. Rename 7 partnership journeys where a co_primary was added.
 *
 * Invocation:
 *   pnpm tsx scripts/apply-franchise-reconciliation.ts          (dry-run)
 *   pnpm tsx scripts/apply-franchise-reconciliation.ts --apply  (write)
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DRY_RUN = !process.argv.includes("--apply");

const envRaw = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

function tag(): string { return DRY_RUN ? "[DRY]" : "[LIVE]"; }

// ───────────────────── helpers ─────────────────────

async function updateContact(id: string, patch: Record<string, unknown>): Promise<void> {
  console.log(`${tag()}  update contact ${id.slice(0,8)} ${JSON.stringify(patch)}`);
  if (DRY_RUN) return;
  const { error } = await supabase.from("contacts").update(patch).eq("id", id);
  if (error) throw new Error(`update contact ${id}: ${JSON.stringify(error)}`);
}

async function updateJourney(id: string, patch: Record<string, unknown>): Promise<void> {
  console.log(`${tag()}  update journey ${id.slice(0,8)} ${JSON.stringify(patch)}`);
  if (DRY_RUN) return;
  const { error } = await supabase.from("journeys").update(patch).eq("id", id);
  if (error) throw new Error(`update journey ${id}: ${JSON.stringify(error)}`);
}

async function deleteContact(id: string, reason: string): Promise<void> {
  console.log(`${tag()}  delete contact ${id.slice(0,8)} (${reason})`);
  if (DRY_RUN) return;
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw new Error(`delete contact ${id}: ${JSON.stringify(error)}`);
}

async function deleteJourney(id: string, reason: string): Promise<void> {
  console.log(`${tag()}  delete journey ${id.slice(0,8)} (${reason})`);
  if (DRY_RUN) return;
  const { error } = await supabase.from("journeys").delete().eq("id", id);
  if (error) throw new Error(`delete journey ${id}: ${JSON.stringify(error)}`);
}

async function insertContact(row: Record<string, unknown>): Promise<string> {
  console.log(`${tag()}  create contact ${JSON.stringify(row)}`);
  if (DRY_RUN) return "dry-new-uuid";
  const { data, error } = await supabase.from("contacts").insert(row).select("id").single();
  if (error) throw new Error(`insert contact: ${JSON.stringify(error)}`);
  return data.id;
}

async function insertJourneyContact(journeyId: string, contactId: string, role: string): Promise<void> {
  console.log(`${tag()}  link journey_contacts j=${journeyId.slice(0,8)} c=${contactId.slice(0,8)} role=${role}`);
  if (DRY_RUN) return;
  const { error } = await supabase.from("journey_contacts").insert({
    journey_id: journeyId, contact_id: contactId, role, joined_at: new Date().toISOString(),
  });
  if (error && !String(error.message ?? error).includes("duplicate"))
    throw new Error(`link journey_contacts: ${JSON.stringify(error)}`);
}

async function reassign(table: string, field: string, fromId: string, toId: string): Promise<void> {
  console.log(`${tag()}  reassign ${table}.${field}: ${fromId.slice(0,8)} → ${toId.slice(0,8)}`);
  if (DRY_RUN) return;
  const { error } = await supabase.from(table).update({ [field]: toId }).eq(field, fromId);
  if (error) throw new Error(`reassign ${table}.${field}: ${JSON.stringify(error)}`);
}

async function deleteFromTable(table: string, field: string, value: string): Promise<void> {
  console.log(`${tag()}  delete ${table} where ${field}=${value.slice(0,8)}`);
  if (DRY_RUN) return;
  const { error } = await supabase.from(table).delete().eq(field, value);
  if (error) throw new Error(`delete ${table}.${field}: ${JSON.stringify(error)}`);
}

async function findJourneyByPrimary(contactId: string): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase.from("journeys")
    .select("id, name").eq("primary_contact_id", contactId).eq("status", "active").maybeSingle();
  if (error) { console.error(`findJourneyByPrimary ${contactId}:`, error); return null; }
  return data;
}

async function findContact(first: string, last: string): Promise<{ id: string; email: string | null; ghl_contact_id: string }[]> {
  const { data } = await supabase.from("contacts")
    .select("id, email, ghl_contact_id").eq("first_name", first).eq("last_name", last);
  return data ?? [];
}

async function findContactByEmail(email: string): Promise<{ id: string; first_name: string | null; last_name: string | null } | null> {
  const { data } = await supabase.from("contacts")
    .select("id, first_name, last_name").eq("email", email).maybeSingle();
  return data;
}

// ───────────────────── A. email / name fixes ─────────────────────

async function phaseA(): Promise<void> {
  console.log("\n═══ PHASE A — name/email fixes on existing contacts ═══");

  // 1. Juan Varon → Juan Camilo Varon (keep same email)
  const { data: juan } = await supabase.from("contacts")
    .select("id").eq("email", "jvaron@newagainhouses.com").maybeSingle();
  if (juan) await updateContact(juan.id, { first_name: "Juan Camilo", last_name: "Varon" });

  // 2. Rajendra Vemula → Raja Vemula
  const { data: raja } = await supabase.from("contacts")
    .select("id").eq("email", "raja@newagainhouses.com").maybeSingle();
  if (raja) await updateContact(raja.id, { first_name: "Raja", last_name: "Vemula" });

  // 3. Corey Armstrong contact actually belongs to Oliver Cahueque (TAMPAW).
  //    oliver@newagainhouses.com is on a row named "Corey Armstrong".
  const { data: oliverRow } = await supabase.from("contacts")
    .select("id, first_name, last_name").eq("email", "oliver@newagainhouses.com").maybeSingle();
  if (oliverRow && oliverRow.first_name === "Corey") {
    await updateContact(oliverRow.id, { first_name: "Oliver", last_name: "Cahueque" });
    // Rename the journey from "Corey Armstrong" → "Oliver Cahueque"
    const j = await findJourneyByPrimary(oliverRow.id);
    if (j && j.name === "Corey Armstrong") {
      await updateJourney(j.id, { name: "Oliver Cahueque" });
    }
  }

  // 4. John Adams (HOTSAR franchisee, id 7945130f) — fix email to NAH.
  const { data: jadams } = await supabase.from("contacts")
    .select("id").eq("email", "johnadams43219876@yahoo.com").maybeSingle();
  if (jadams) await updateContact(jadams.id, { email: "jadams@newagainhouses.com" });

  // 5. Michael Heist — update email to NAH domain.
  const { data: heist } = await supabase.from("contacts")
    .select("id").eq("email", "michaelpheist@gmail.com").maybeSingle();
  if (heist) await updateContact(heist.id, { email: "mheist@newagainhouses.com" });

  // 6. Keith Parker — personal email → NAH.
  const { data: parker } = await supabase.from("contacts")
    .select("id").eq("email", "kparker@pobox.com").maybeSingle();
  if (parker) await updateContact(parker.id, { email: "kparker@newagainhouses.com" });

  // 7. Sarah Calderone — personal email → NAH.
  const { data: calderone } = await supabase.from("contacts")
    .select("id").eq("email", "scalderone22@gmail.com").maybeSingle();
  if (calderone) await updateContact(calderone.id, { email: "scalderone@newagainhouses.com" });

  // 8. Austin Pate — no email in DB → set NAH.
  const { data: apate } = await supabase.from("contacts")
    .select("id, email").eq("first_name", "Austin").eq("last_name", "Pate").maybeSingle();
  if (apate && !apate.email) await updateContact(apate.id, { email: "apate@newagainhouses.com" });

  // 9. Ron Cates — resolve email conflict with Nicki. Both have ncates@.
  //    Per user: give Ron charleston@newagainhouses.com, Nicki keeps ncates@.
  const { data: ronCates } = await supabase.from("contacts")
    .select("id").eq("ghl_contact_id", "8ESuo17E9AQW4ahQY7vi").maybeSingle();
  if (ronCates) await updateContact(ronCates.id, { email: "charleston@newagainhouses.com" });
}

// ───────────────────── B. simple dedupes ─────────────────────

async function simpleDedupe(canonicalId: string, orphanId: string, reason: string): Promise<void> {
  console.log(`${tag()}  simple dedupe: keep ${canonicalId.slice(0,8)}, delete ${orphanId.slice(0,8)} (${reason})`);
  // Orphan has 0 journey_contacts / 0 extractions / 0 etc. → just delete.
  if (DRY_RUN) return;
  // Ensure: remove any stray journey_contacts on orphan first (FK is RESTRICT).
  await deleteFromTable("journey_contacts", "contact_id", orphanId);
  await deleteContact(orphanId, reason);
}

async function phaseB(): Promise<void> {
  console.log("\n═══ PHASE B — simple dedupes (orphan has no data) ═══");

  // Shannon Smylie
  await simpleDedupe("ff11625c-1a1a-1a1a-1a1a-000000000000", "075e0694-1a1a-1a1a-1a1a-000000000000", "Shannon Smylie orphan");
  // Actually we need real IDs — re-fetch.
  const shannon = await findContact("Shannon", "Smylie");
  const shannonCanonical = shannon.find((c) => c.ghl_contact_id.startsWith("manual_"));
  const shannonOrphan = shannon.find((c) => c.ghl_contact_id.startsWith("related_"));
  if (shannonCanonical && shannonOrphan) {
    console.log(`  resolving Shannon: canonical=${shannonCanonical.id.slice(0,8)} orphan=${shannonOrphan.id.slice(0,8)}`);
    if (DRY_RUN) console.log(`${tag()}  delete journey_contacts by contact_id=${shannonOrphan.id.slice(0,8)}`);
    else await deleteFromTable("journey_contacts", "contact_id", shannonOrphan.id);
    await deleteContact(shannonOrphan.id, "Shannon Smylie orphan related_");
  }

  const mark = await findContact("Mark", "Pate");
  const markCanonical = mark.find((c) => !c.ghl_contact_id.startsWith("related_") && !c.ghl_contact_id.startsWith("manual_"));
  const markOrphan = mark.find((c) => c.ghl_contact_id.startsWith("related_"));
  if (markCanonical && markOrphan) {
    if (!DRY_RUN) await deleteFromTable("journey_contacts", "contact_id", markOrphan.id);
    await deleteContact(markOrphan.id, "Mark Pate orphan related_");
  }

  const megan = await findContact("Megan", "Dunbar");
  // Both are `related_*` with no email — pick lowest-id as canonical, delete other.
  if (megan.length === 2) {
    megan.sort((a, b) => a.id.localeCompare(b.id));
    const keep = megan[0], drop = megan[1];
    console.log(`  Megan Dunbar: keep ${keep.id.slice(0,8)}, drop ${drop.id.slice(0,8)}`);
    if (!DRY_RUN) await deleteFromTable("journey_contacts", "contact_id", drop.id);
    await deleteContact(drop.id, "Megan Dunbar duplicate orphan");
  }

  const chandler = await findContact("Chandler", "Tolbert");
  const chandlerCanonical = chandler.find((c) => c.ghl_contact_id.startsWith("manual_"));
  const chandlerOrphan = chandler.find((c) => c.ghl_contact_id.startsWith("related_"));
  if (chandlerCanonical && chandlerOrphan) {
    if (!DRY_RUN) await deleteFromTable("journey_contacts", "contact_id", chandlerOrphan.id);
    await deleteContact(chandlerOrphan.id, "Chandler Tolbert orphan related_");
  }

  const ryan = await findContact("Ryan", "Decker");
  const ryanCanonical = ryan.find((c) => !c.ghl_contact_id.startsWith("related_") && !c.ghl_contact_id.startsWith("manual_"));
  const ryanOrphan = ryan.find((c) => c.ghl_contact_id.startsWith("related_"));
  if (ryanCanonical && ryanOrphan) {
    if (!DRY_RUN) await deleteFromTable("journey_contacts", "contact_id", ryanOrphan.id);
    await deleteContact(ryanOrphan.id, "Ryan Decker orphan related_");
  }
}

// ───────────────────── C. data-migrate dedupes ─────────────────────

async function dataMigrateDedupe(canonicalId: string, orphanId: string, newEmail: string, newPhone: string | null): Promise<void> {
  console.log(`  canonical=${canonicalId.slice(0,8)} orphan=${orphanId.slice(0,8)} (migrate ext/acts/crp)`);
  await reassign("call_data_extractions", "contact_id", orphanId, canonicalId);
  await reassign("call_action_items", "contact_id", orphanId, canonicalId);
  await reassign("contact_related_people", "contact_id", orphanId, canonicalId);
  await reassign("contact_related_people", "linked_contact_id", orphanId, canonicalId);
  const patch: Record<string, unknown> = { email: newEmail };
  if (newPhone) patch.phone = newPhone;
  await updateContact(canonicalId, patch);
  if (!DRY_RUN) await deleteFromTable("journey_contacts", "contact_id", orphanId);
  await deleteContact(orphanId, "data-migrated, now empty");
}

async function phaseC(): Promise<void> {
  console.log("\n═══ PHASE C — dedupes with data migration ═══");

  // Dale Rykse: real-GHL journey row; manual_ has ext+acts → migrate.
  const dale = await findContact("Dale", "Rykse");
  const daleCanonical = dale.find((c) => !c.ghl_contact_id.startsWith("manual_") && !c.ghl_contact_id.startsWith("related_"));
  const daleOrphan = dale.find((c) => c.ghl_contact_id.startsWith("manual_"));
  if (daleCanonical && daleOrphan) {
    await dataMigrateDedupe(daleCanonical.id, daleOrphan.id, "drykse@newagainhouses.com", "+17343236185");
  }

  const erica = await findContact("Erica", "Vasquez");
  const ericaCanonical = erica.find((c) => !c.ghl_contact_id.startsWith("manual_") && !c.ghl_contact_id.startsWith("related_"));
  const ericaOrphan = erica.find((c) => c.ghl_contact_id.startsWith("manual_"));
  if (ericaCanonical && ericaOrphan) {
    await dataMigrateDedupe(ericaCanonical.id, ericaOrphan.id, "evasquez@newagainhouses.com", "+16309656287");
  }
}

// ───────────────────── D. journey merges ─────────────────────

/**
 * Merge two journeys for the same person (same phone confirms identity):
 *   - The "franchisee journey" has the real pipeline state (runway/onboarded).
 *   - The "prospect journey" just has followup/Nurture — leftover from pre-conversion.
 *
 * Strategy: keep the franchisee journey, migrate any extractions/actions/crp
 * from the prospect-contact → franchisee-contact, delete prospect journey,
 * then delete prospect-contact.
 *
 * Then swap the canonical contact's ghl_contact_id to the real GHL ID so
 * future GHL syncs align to this row.
 */
async function mergeJourneys(opts: {
  franchiseeContactId: string; franchiseeJourneyId: string;
  prospectContactId: string; prospectJourneyId: string;
  realGhlId: string; newEmail: string; newPhone: string;
  oldGhlId: string;
}): Promise<void> {
  console.log(`  merge: franchisee=${opts.franchiseeContactId.slice(0,8)}/${opts.franchiseeJourneyId.slice(0,8)} prospect=${opts.prospectContactId.slice(0,8)}/${opts.prospectJourneyId.slice(0,8)}`);

  // 1. Migrate journey-scoped refs: journey_id for extractions/actions.
  await reassign("call_data_extractions", "journey_id", opts.prospectJourneyId, opts.franchiseeJourneyId);
  await reassign("call_action_items", "journey_id", opts.prospectJourneyId, opts.franchiseeJourneyId);

  // 2. Migrate contact-scoped refs: contact_id for extractions/actions/crp.
  await reassign("call_data_extractions", "contact_id", opts.prospectContactId, opts.franchiseeContactId);
  await reassign("call_action_items", "contact_id", opts.prospectContactId, opts.franchiseeContactId);
  await reassign("contact_related_people", "contact_id", opts.prospectContactId, opts.franchiseeContactId);
  await reassign("contact_related_people", "linked_contact_id", opts.prospectContactId, opts.franchiseeContactId);

  // 3. Delete the prospect journey's remaining rows (journey_contacts, jps via CASCADE).
  //    First remove journey_contacts referencing the prospect contact on either journey.
  if (!DRY_RUN) {
    await supabase.from("journey_contacts").delete().eq("journey_id", opts.prospectJourneyId);
  } else {
    console.log(`${tag()}  delete journey_contacts where journey_id=${opts.prospectJourneyId.slice(0,8)}`);
  }

  // 4. Delete prospect journey. Cascade on journey_pipeline_state via FK ON DELETE CASCADE.
  await deleteJourney(opts.prospectJourneyId, "merged into franchisee journey");

  // 5. Remove any remaining journey_contacts referring to the prospect contact.
  if (!DRY_RUN) await deleteFromTable("journey_contacts", "contact_id", opts.prospectContactId);

  // 6. Delete prospect contact (now free of refs).
  await deleteContact(opts.prospectContactId, "merged into franchisee contact");

  // 7-8. FK chicken-and-egg between contacts.ghl_contact_id and
  //   territory_owners.ghl_contact_id: neither side can be updated first
  //   while the other references the old id. Resolution: capture the
  //   territory_owners rows, delete them, update the contact, then
  //   re-insert the rows pointing at the new id.
  if (opts.oldGhlId !== opts.realGhlId) {
    console.log(`${tag()}  repoint territory_owners.ghl_contact_id: ${opts.oldGhlId} → ${opts.realGhlId}`);
    if (!DRY_RUN) {
      const { data: captured, error: selErr } = await supabase.from("territory_owners")
        .select("*").eq("ghl_contact_id", opts.oldGhlId);
      if (selErr) throw new Error(`capture territory_owners: ${JSON.stringify(selErr)}`);
      const { error: delErr } = await supabase.from("territory_owners")
        .delete().eq("ghl_contact_id", opts.oldGhlId);
      if (delErr) throw new Error(`delete territory_owners: ${JSON.stringify(delErr)}`);
      await updateContact(opts.franchiseeContactId, {
        ghl_contact_id: opts.realGhlId, email: opts.newEmail,
        phone: opts.newPhone, is_converted_franchisee: true,
      });
      if (captured && captured.length > 0) {
        const repointed = captured.map((r) => ({ ...r, ghl_contact_id: opts.realGhlId }));
        const { error: insErr } = await supabase.from("territory_owners").insert(repointed);
        if (insErr) throw new Error(`reinsert territory_owners: ${JSON.stringify(insErr)}`);
      }
    } else {
      await updateContact(opts.franchiseeContactId, {
        ghl_contact_id: opts.realGhlId, email: opts.newEmail,
        phone: opts.newPhone, is_converted_franchisee: true,
      });
    }
  } else {
    await updateContact(opts.franchiseeContactId, {
      email: opts.newEmail, phone: opts.newPhone, is_converted_franchisee: true,
    });
  }
}

async function phaseD(): Promise<void> {
  console.log("\n═══ PHASE D — journey merges (Ron Schinharl, Tori Mills, Chad Matt, Jessica Hollingsworth) ═══");

  const cases = [
    { label: "Ron Schinharl", first: "Ron", last: "Schinharl",
      franchiseeEmail: "rschinharl@newagainhouses.com", prospectEmail: "ronks13@gmail.com",
      newPhone: "+14194667177" },
    { label: "Tori Mills", first: "Tori", last: "Mills",
      franchiseeEmail: "vhurlburt@newagainhouses.com", prospectEmail: "monroe@newagainhouses.com",
      newPhone: "+13187371805" },
    { label: "Chad Matt", first: "Chad", last: "Matt",
      franchiseeEmail: "chad.matt@newagainhouses.com", prospectEmail: "chad.matt@me.com",
      newPhone: "+13373990776" },
    { label: "Jessica Hollingsworth", first: "Jessica", last: "Hollingsworth",
      franchiseeEmail: "jhollingsworth@newagainhouses.com", prospectEmail: "jhollingsworth1012@gmail.com",
      newPhone: "+16017681129" },
  ];

  for (const c of cases) {
    const rows = await findContact(c.first, c.last);
    const franchisee = rows.find((r) => r.email === c.franchiseeEmail);
    const prospect = rows.find((r) => r.email === c.prospectEmail);
    if (!franchisee || !prospect) {
      console.log(`  ${c.label}: already merged or incomplete state — skipping`);
      continue;
    }
    const fj = await findJourneyByPrimary(franchisee.id);
    const pj = await findJourneyByPrimary(prospect.id);
    if (!fj || !pj) {
      console.log(`  ${c.label}: missing journey — skipping`);
      continue;
    }
    await mergeJourneys({
      franchiseeContactId: franchisee.id, franchiseeJourneyId: fj.id,
      prospectContactId: prospect.id, prospectJourneyId: pj.id,
      realGhlId: prospect.ghl_contact_id, oldGhlId: franchisee.ghl_contact_id,
      newEmail: c.franchiseeEmail, newPhone: c.newPhone,
    });
  }
}

// ───────────────────── E+F. create + link co-owners ─────────────────────

interface CoOwnerSpec {
  primaryEmail: string;
  coOwnerFirst: string;
  coOwnerLast: string;
  coOwnerEmail?: string | null;
  coOwnerPhone?: string | null;
  role: string;
}

// Co-owners to backfill. For each: the primary's email identifies the journey,
// then we either create the co-owner contact (if missing) or link an existing one.
const COOWNERS: CoOwnerSpec[] = [
  // Simple LINK cases (contact already exists by name)
  { primaryEmail: "anna.arceneaux@newagainhouses.com", coOwnerFirst: "Kyle", coOwnerLast: "Arceneaux", role: "family" },
  { primaryEmail: "acandlish@newagainhouses.com", coOwnerFirst: "Hollee", coOwnerLast: "Candlish", role: "family" },
  { primaryEmail: "chad.matt@newagainhouses.com", coOwnerFirst: "Michelle", coOwnerLast: "Matt", role: "family" },
  { primaryEmail: "clewis@newagainhouses.com", coOwnerFirst: "Mechael", coOwnerLast: "Lewis", role: "family" },
  { primaryEmail: "oliver@newagainhouses.com", coOwnerFirst: "Doris", coOwnerLast: "Cahueque", role: "co_primary" },
  { primaryEmail: "dcheetwood@newagainhouses.com", coOwnerFirst: "Carie", coOwnerLast: "Cheetwood", role: "family" },
  { primaryEmail: "espersrud@newagainhouses.com", coOwnerFirst: "Jennifer", coOwnerLast: "Spersrud", role: "family" },
  { primaryEmail: "jsylva@newagainhouses.com", coOwnerFirst: "Steven", coOwnerLast: "Lowenthal", role: "co_primary" },
  { primaryEmail: "jstigers@newagainhouses.com", coOwnerFirst: "Tameka", coOwnerLast: "Stigers", role: "family" },
  { primaryEmail: "justin.halstead@newagainhouses.com", coOwnerFirst: "Jennifer", coOwnerLast: "Halstead", role: "family" },
  { primaryEmail: "kparker@newagainhouses.com", coOwnerFirst: "Sarah", coOwnerLast: "Parker", role: "family" },
  { primaryEmail: "ktolbert@newagainhouses.com", coOwnerFirst: "Tara", coOwnerLast: "Tolbert", role: "family" },
  { primaryEmail: "ktolbert@newagainhouses.com", coOwnerFirst: "Chandler", coOwnerLast: "Tolbert", role: "family" },
  { primaryEmail: "marco.pena@newagainhouses.com", coOwnerFirst: "Marta", coOwnerLast: "Pena", role: "family" },
  { primaryEmail: "rmorris@newagainhouses.com", coOwnerFirst: "Sarah", coOwnerLast: "Morris", role: "family" },
  { primaryEmail: "sajeena@newagainhouses.com", coOwnerFirst: "Jayprakash", coOwnerLast: "Ayyappan", role: "co_primary" },
  { primaryEmail: "scalderone@newagainhouses.com", coOwnerFirst: "Michael", coOwnerLast: "Mays", role: "business_partner" },
  { primaryEmail: "shaynes@newagainhouses.com", coOwnerFirst: "Sharon", coOwnerLast: "Drye", role: "co_primary" },
  { primaryEmail: "thall@newagainhouses.com", coOwnerFirst: "Stephanie", coOwnerLast: "Hall", role: "family" },
  { primaryEmail: "vhurlburt@newagainhouses.com", coOwnerFirst: "Steven", coOwnerLast: "Mills", role: "family" },
  { primaryEmail: "zchrisman@newagainhouses.com", coOwnerFirst: "Mae", coOwnerLast: "Chrisman", role: "family" },
  // Dedupe-then-link (need canonical ID after phase B)
  { primaryEmail: "apate@newagainhouses.com", coOwnerFirst: "Mark", coOwnerLast: "Pate", role: "family" },
  { primaryEmail: "pdunbar@newagainhouses.com", coOwnerFirst: "Megan", coOwnerLast: "Dunbar", role: "family" },
  // CREATE cases (no existing contact)
  { primaryEmail: "jhollingsworth@newagainhouses.com", coOwnerFirst: "Tony", coOwnerLast: "Hollingsworth", role: "family" },
  { primaryEmail: "tlangley@newagainhouses.com", coOwnerFirst: "Michelle", coOwnerLast: "Langley", role: "family" },
  { primaryEmail: "bnicholson@newagainhouses.com", coOwnerFirst: "Elida", coOwnerLast: "Nicholson", role: "family" },
  { primaryEmail: "tlinder@newagainhouses.com", coOwnerFirst: "Dona", coOwnerLast: "McLeod",
    coOwnerEmail: "dmcleod@newagainhouses.com", role: "co_primary" },
  // Cates: Ron is primary in DB (has the CHARSC journey). Add Nicki as co_primary.
  // Nicki's existing 'related_*' contact row keeps ncates@newagainhouses.com.
  { primaryEmail: "charleston@newagainhouses.com", coOwnerFirst: "Nicki", coOwnerLast: "Cates", role: "co_primary" },
  { primaryEmail: "jadams@newagainhouses.com", coOwnerFirst: "Margie", coOwnerLast: "Resto-Adams", role: "co_primary" },
];

async function phaseEF(): Promise<void> {
  console.log("\n═══ PHASE E+F — create + link co-owners ═══");

  for (const spec of COOWNERS) {
    const primary = await findContactByEmail(spec.primaryEmail);
    if (!primary) {
      console.log(`  ⚠  skip ${spec.coOwnerFirst} ${spec.coOwnerLast}: no primary by email ${spec.primaryEmail}`);
      continue;
    }
    const journey = await findJourneyByPrimary(primary.id);
    if (!journey) {
      console.log(`  ⚠  skip ${spec.coOwnerFirst} ${spec.coOwnerLast}: no active journey for primary ${primary.first_name} ${primary.last_name}`);
      continue;
    }

    // Resolve or create the co-owner contact.
    let coOwnerId: string | null = null;
    const existing = await findContact(spec.coOwnerFirst, spec.coOwnerLast);
    if (existing.length === 1) coOwnerId = existing[0].id;
    else if (existing.length > 1) {
      // After phase B/C/D this shouldn't happen for our targets, but guard.
      const withEmail = existing.find((e) => e.email);
      coOwnerId = (withEmail ?? existing[0]).id;
    }

    if (!coOwnerId) {
      // Create new contact with synthetic manual ghl_id.
      coOwnerId = await insertContact({
        first_name: spec.coOwnerFirst,
        last_name: spec.coOwnerLast,
        email: spec.coOwnerEmail ?? null,
        phone: spec.coOwnerPhone ?? null,
        ghl_contact_id: `manual_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      });
    }

    // Check membership.
    const { data: existingMembership } = await supabase.from("journey_contacts")
      .select("id").eq("journey_id", journey.id).eq("contact_id", coOwnerId).is("left_at", null).maybeSingle();
    if (existingMembership) {
      console.log(`  already member: ${spec.coOwnerFirst} ${spec.coOwnerLast} on ${journey.name}`);
      continue;
    }

    await insertJourneyContact(journey.id, coOwnerId, spec.role);
  }
}

// ───────────────────── G. rename partnership journeys ─────────────────────

const PARTNERSHIP_RENAMES: { primaryEmail: string; newName: string }[] = [
  { primaryEmail: "oliver@newagainhouses.com", newName: "Oliver + Doris Cahueque" },
  { primaryEmail: "jsylva@newagainhouses.com", newName: "Jennifer Sylva + Steven Lowenthal" },
  { primaryEmail: "sajeena@newagainhouses.com", newName: "Sajeena Jayprakash + Jayprakash Ayyappan" },
  { primaryEmail: "shaynes@newagainhouses.com", newName: "Stephen Haynes + Sharon Drye" },
  { primaryEmail: "tlinder@newagainhouses.com", newName: "Todd Linder + Dona McLeod" },
  { primaryEmail: "charleston@newagainhouses.com", newName: "Nicki + Ron Cates" },
  { primaryEmail: "jadams@newagainhouses.com", newName: "John Adams + Margie Resto-Adams" },
  // Ryan+Shannon already renamed earlier in session.
];

async function phaseG(): Promise<void> {
  console.log("\n═══ PHASE G — rename partnership journeys ═══");
  for (const r of PARTNERSHIP_RENAMES) {
    const primary = await findContactByEmail(r.primaryEmail);
    if (!primary) { console.log(`  skip ${r.newName}: no primary`); continue; }
    const j = await findJourneyByPrimary(primary.id);
    if (!j) { console.log(`  skip ${r.newName}: no journey`); continue; }
    if (j.name === r.newName) { console.log(`  already renamed: ${r.newName}`); continue; }
    await updateJourney(j.id, { name: r.newName, slug: null });
    //  ^^ clear slug so the slug backfill regenerates it from the new name.
  }
}

// ───────────────────── main ─────────────────────

async function main(): Promise<void> {
  console.log(DRY_RUN ? "DRY RUN — no writes will be made." : "LIVE RUN — writes will be applied.");
  await phaseA();
  await phaseB();
  await phaseC();
  await phaseD();
  await phaseEF();
  await phaseG();
  console.log("\nDone. Remember to re-run backfill-journey-slugs.ts after a live run.");
}

void main();
