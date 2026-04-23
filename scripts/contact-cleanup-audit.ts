/**
 * Read-only contact cleanup audit. Pulls three lists:
 *
 *   1. Duplicates — by normalized email, by last-10 phone digits, by
 *      normalized full name (lower, punctuation-stripped).
 *   2. Contacts not attached to any journey (not primary, not member).
 *   3. Names that don't look like real/standardized names — empty, emails,
 *      numbers, single-letter initials, ALL CAPS, all lowercase, unknown/
 *      test placeholders, device/speaker labels.
 *
 * Writes a human-readable report to stdout. Nothing is modified.
 */

import { createClient } from "@supabase/supabase-js";

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

interface Contact {
  id: string;
  ghl_contact_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  opportunity_source: string | null;
  created_at: string;
  updated_at: string;
}

async function loadAllContacts(): Promise<Contact[]> {
  const PAGE = 1000;
  const all: Contact[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await s
      .from("contacts")
      .select("id, ghl_contact_id, first_name, last_name, email, phone, opportunity_source, created_at, updated_at")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...(data as Contact[]));
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

function normEmail(e: string | null): string | null {
  if (!e) return null;
  const t = e.trim().toLowerCase();
  return t.length === 0 ? null : t;
}

function normPhone(p: string | null): string | null {
  if (!p) return null;
  const d = p.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}

function normName(first: string | null, last: string | null): string | null {
  const raw = [first, last].filter(Boolean).join(" ").trim().toLowerCase();
  const cleaned = raw.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  return cleaned.length >= 3 ? cleaned : null;
}

function fmtName(c: Contact): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "(no name)";
}

/** Heuristics for "doesn't look like a real name." */
function nameQualityIssue(c: Contact): string | null {
  const first = (c.first_name ?? "").trim();
  const last = (c.last_name ?? "").trim();
  const full = `${first} ${last}`.trim();

  if (!full) return "both names empty";
  if (!first) return "first name empty";
  if (!last) return "last name empty";

  // Email used as a name
  if (/@/.test(first) || /@/.test(last)) return "contains '@' (email used as name)";

  // Contains digits
  if (/\d/.test(first) || /\d/.test(last)) return `contains digits (${full})`;

  // Speaker/device labels from Read.ai
  if (/speaker\s*\d+/i.test(full)) return "looks like 'Speaker N' transcript label";
  if (/macbook|iphone|ipad|laptop|pc|conference room|meeting room/i.test(full))
    return "contains device/room keyword";

  // Placeholder values
  if (/^(unknown|test|null|none|n\/?a|sample|demo|example)$/i.test(first) ||
      /^(unknown|test|null|none|n\/?a|sample|demo|example)$/i.test(last))
    return `placeholder word (${full})`;

  // Single-letter last name (John A.)
  if (last.replace(/[^a-z]/gi, "").length <= 1) return `last name is single letter (${full})`;

  // All caps on a multi-char word (e.g. "JOHN SMITH" — probable bulk import)
  if (full.length >= 4 && full === full.toUpperCase() && /[A-Z]/.test(full))
    return `ALL CAPS (${full})`;

  // All lowercase (e.g. "john smith" — unprofessional entry)
  if (full.length >= 4 && full === full.toLowerCase() && /[a-z]/.test(full))
    return `all lowercase (${full})`;

  // Starts with punctuation or space
  if (/^[^a-zA-Z]/.test(first) || /^[^a-zA-Z]/.test(last))
    return `starts with non-letter (${full})`;

  return null;
}

async function main() {
  console.log("Loading contacts…");
  const contacts = await loadAllContacts();
  console.log(`Loaded ${contacts.length} contacts.\n`);

  // ── 1. Duplicates ──────────────────────────────────────────────────────
  const byEmail = new Map<string, Contact[]>();
  const byPhone = new Map<string, Contact[]>();
  const byName = new Map<string, Contact[]>();
  for (const c of contacts) {
    const e = normEmail(c.email);
    const p = normPhone(c.phone);
    const n = normName(c.first_name, c.last_name);
    if (e) {
      if (!byEmail.has(e)) byEmail.set(e, []);
      byEmail.get(e)!.push(c);
    }
    if (p) {
      if (!byPhone.has(p)) byPhone.set(p, []);
      byPhone.get(p)!.push(c);
    }
    if (n) {
      if (!byName.has(n)) byName.set(n, []);
      byName.get(n)!.push(c);
    }
  }

  const emailDupes = [...byEmail.entries()].filter(([, v]) => v.length > 1);
  const phoneDupes = [...byPhone.entries()].filter(([, v]) => v.length > 1);
  const nameDupes = [...byName.entries()].filter(([, v]) => v.length > 1);

  console.log("═══ 1. DUPLICATES ═══\n");
  console.log(`Email dupes:  ${emailDupes.length}`);
  console.log(`Phone dupes:  ${phoneDupes.length}`);
  console.log(`Name dupes:   ${nameDupes.length}\n`);

  if (emailDupes.length > 0) {
    console.log("── Duplicate emails ──");
    for (const [email, rows] of emailDupes.slice(0, 50)) {
      console.log(`\n[${rows.length}] ${email}`);
      for (const r of rows) {
        console.log(`   ${r.id.slice(0, 8)}  ${fmtName(r).padEnd(25)}  phone=${r.phone ?? "null"}  src=${r.opportunity_source ?? "-"}`);
      }
    }
  }
  if (phoneDupes.length > 0) {
    console.log("\n── Duplicate phones (last-10) ──");
    for (const [phone, rows] of phoneDupes.slice(0, 50)) {
      console.log(`\n[${rows.length}] ${phone}`);
      for (const r of rows) {
        console.log(`   ${r.id.slice(0, 8)}  ${fmtName(r).padEnd(25)}  email=${r.email ?? "null"}`);
      }
    }
  }
  if (nameDupes.length > 0) {
    console.log("\n── Duplicate names (normalized) ──");
    for (const [name, rows] of nameDupes.slice(0, 50)) {
      console.log(`\n[${rows.length}] ${name}`);
      for (const r of rows) {
        console.log(`   ${r.id.slice(0, 8)}  ${fmtName(r).padEnd(25)}  email=${r.email ?? "null"}  phone=${r.phone ?? "null"}`);
      }
    }
  }

  // ── 2. Contacts not attached to any journey ────────────────────────────
  console.log("\n\n═══ 2. CONTACTS NOT IN A JOURNEY ═══\n");

  // Collect: contacts that are primary of any journey
  const { data: journeys } = await s.from("journeys").select("primary_contact_id");
  const primarySet = new Set((journeys ?? []).map((j) => j.primary_contact_id));

  // Collect: contacts that are members (left_at IS NULL)
  const PAGE = 1000;
  const memberSet = new Set<string>();
  let off = 0;
  while (true) {
    const { data } = await s
      .from("journey_contacts")
      .select("contact_id")
      .is("left_at", null)
      .range(off, off + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const r of data) memberSet.add(r.contact_id);
    if (data.length < PAGE) break;
    off += PAGE;
  }

  const orphans = contacts.filter((c) => !primarySet.has(c.id) && !memberSet.has(c.id));
  console.log(`Contacts not in any journey: ${orphans.length}\n`);
  console.log("Sample (first 80):");
  for (const c of orphans.slice(0, 80)) {
    console.log(`  ${c.id.slice(0, 8)}  ${fmtName(c).padEnd(30)}  email=${(c.email ?? "null").padEnd(35)}  src=${c.opportunity_source ?? "-"}`);
  }

  // ── 3. Name quality issues ─────────────────────────────────────────────
  console.log("\n\n═══ 3. NAME QUALITY ISSUES ═══\n");
  type Flagged = { contact: Contact; issue: string };
  const flagged: Flagged[] = [];
  for (const c of contacts) {
    const issue = nameQualityIssue(c);
    if (issue) flagged.push({ contact: c, issue });
  }
  console.log(`Flagged: ${flagged.length}\n`);

  // Group by issue type
  const byIssue = new Map<string, Flagged[]>();
  for (const f of flagged) {
    // Normalize the issue message to a category label
    const cat = f.issue.split(" (")[0];
    if (!byIssue.has(cat)) byIssue.set(cat, []);
    byIssue.get(cat)!.push(f);
  }
  for (const [cat, list] of [...byIssue.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n[${list.length}] ${cat}`);
    for (const f of list.slice(0, 20)) {
      console.log(`   ${f.contact.id.slice(0, 8)}  ${fmtName(f.contact).padEnd(30)}  email=${f.contact.email ?? "null"}  src=${f.contact.opportunity_source ?? "-"}`);
    }
    if (list.length > 20) console.log(`   …and ${list.length - 20} more`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
