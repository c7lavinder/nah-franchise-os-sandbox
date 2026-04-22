/**
 * Read-only reconciliation: compare the franchise-locations CSV against the
 * current DB and produce a diff. No writes.
 *
 * Produces four sections:
 *   1. Name standardization — primary contacts whose name in DB contains a
 *      nickname / trailing role annotation that should be stripped.
 *   2. Missing co-owners — Franchise Owner 2 values from the CSV that are
 *      not currently members of the primary's journey.
 *   3. Duplicate contacts — multiple contacts rows for the same person
 *      (e.g. two "Megan Dunbar" orphans with different ghl_contact_ids).
 *   4. Unmatched CSV rows — territory rows whose primary owner we can't
 *      resolve to a local contact (so the user can see blind spots).
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

// --- CSV parse ----------------------------------------------------------

interface CsvRow {
  territorySlug: string;
  locations: string;
  primaryName: string;
  primaryEmail: string;
  primaryPhone: string;
  coOwnerRaw: string;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { buf += '"'; i++; }
      else inQ = !inQ;
    } else if (c === "," && !inQ) {
      out.push(buf);
      buf = "";
    } else {
      buf += c;
    }
  }
  out.push(buf);
  return out;
}

function loadCsv(): CsvRow[] {
  const raw = fs.readFileSync(
    path.resolve(process.cwd(), "Onboarding_Runway NAH Franchise Locations a.o. 03.27.26 - Franchise Locations.csv"),
    "utf8",
  );
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const rows: CsvRow[] = [];
  for (const line of lines) {
    const cols = parseCsvLine(line);
    if (cols.length < 14) continue;
    const slug = cols[3]?.trim();
    if (!slug || slug === "Territory Slug") continue;
    const primary = cols[7]?.trim();
    if (!primary || primary === "Home office location") continue;
    rows.push({
      territorySlug: slug,
      locations: cols[1]?.trim() ?? "",
      primaryName: primary,
      primaryEmail: cols[12]?.trim() ?? "",
      primaryPhone: cols[11]?.trim() ?? "",
      coOwnerRaw: cols[8]?.trim() ?? "",
    });
  }
  return rows;
}

// --- name standardization ------------------------------------------------

interface ParsedName { first: string; last: string; display: string; note: string | null }

/**
 * Strip nicknames in quotes/parens and role annotations like "(Partner)".
 *   'Rajendra "Raja" Vemula'  → Raja Vemula           (prefer nickname)
 *   'James (Tim) Hall'        → Tim Hall              (prefer nickname)
 *   'Michael Mays (Partner)'  → Michael Mays          (role annotation only)
 *   'Joanne McCann (operator)' → Joanne McCann
 */
function standardizeName(raw: string): ParsedName {
  let s = raw.trim().replace(/\s+/g, " ");
  let note: string | null = null;

  // Capture role annotation in parens at the end.
  const roleAnno = s.match(/\(([A-Za-z][A-Za-z ]*)\)\s*$/);
  if (roleAnno && /^(partner|operator|co[\- ]?owner|manager)$/i.test(roleAnno[1].trim())) {
    note = roleAnno[1].trim().toLowerCase();
    s = s.slice(0, roleAnno.index).trim();
  }

  // Capture nickname in parens/quotes mid-name.
  const nick = s.match(/\(([A-Za-z]+)\)|"([A-Za-z]+)"|'([A-Za-z]+)'/);
  if (nick) {
    const nickname = (nick[1] ?? nick[2] ?? nick[3]).trim();
    const pre = s.slice(0, nick.index).trim();
    const post = s.slice(nick.index! + nick[0].length).trim();
    // pre is "Rajendra" (first name), post is "Vemula" (last name).
    const preTokens = pre.split(" ");
    const last = post.split(" ")[0] ?? preTokens.pop() ?? "";
    s = `${nickname} ${last}`.trim();
  }

  s = s.replace(/\s+/g, " ").trim();
  const parts = s.split(" ");
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ");
  return { first, last, display: s, note };
}

/**
 * Split a co-owner cell into one or more named people.
 *   "Chandler Tolbert, Tara Tolbert"   → [Chandler Tolbert, Tara Tolbert]
 *   "Michael Mays (Partner)"           → [Michael Mays]  (note: business_partner)
 *   "Elida MElida Maria Amador Marcia" → flagged as garbled, return [].
 */
function splitCoOwners(cell: string): { parsed: ParsedName; garbled: boolean }[] {
  if (!cell) return [];
  // Garbled detector: same token repeated with no space ("MElida" pattern).
  if (/[A-Z][a-z]+[A-Z][a-z]+/.test(cell) && !cell.includes(" ")) {
    return [{ parsed: { first: cell, last: "", display: cell, note: null }, garbled: true }];
  }
  if (/^[A-Z][a-z]+ [A-Z][A-Za-z]*[A-Z][a-z]+/.test(cell)) {
    return [{ parsed: { first: cell, last: "", display: cell, note: null }, garbled: true }];
  }
  const parts = cell.split(/,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean);
  return parts.map((p) => ({ parsed: standardizeName(p), garbled: false }));
}

// --- pagination helper ---------------------------------------------------

async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const pageSize = 1000;
  let offset = 0;
  const all: T[] = [];
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(offset, offset + pageSize - 1);
    if (error) throw new Error(JSON.stringify(error));
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

// --- main ----------------------------------------------------------------

interface Contact { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; ghl_contact_id: string }
interface Journey { id: string; name: string; primary_contact_id: string; status: string }
interface Member { journey_id: string; contact_id: string; role: string; left_at: string | null }

function normPhone(p: string | null): string { return (p ?? "").replace(/\D/g, ""); }
function normEmail(e: string | null): string { return (e ?? "").trim().toLowerCase(); }
function fullName(c: Contact): string { return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(); }

async function main() {
  const csvRows = loadCsv();
  const [contacts, journeys, members] = await Promise.all([
    fetchAll<Contact>("contacts", "id, first_name, last_name, email, phone, ghl_contact_id"),
    fetchAll<Journey>("journeys", "id, name, primary_contact_id, status"),
    fetchAll<Member>("journey_contacts", "journey_id, contact_id, role, left_at"),
  ]);

  const activeJourneys = journeys.filter((j) => j.status === "active");
  const byContactId = new Map(contacts.map((c) => [c.id, c]));
  const byEmail = new Map<string, Contact[]>();
  for (const c of contacts) {
    const k = normEmail(c.email);
    if (!k) continue;
    (byEmail.get(k) ?? byEmail.set(k, []).get(k)!).push(c);
  }
  const byNameNorm = new Map<string, Contact[]>();
  const nameKey = (f: string, l: string) => `${f.toLowerCase().trim()}|${l.toLowerCase().trim()}`;
  for (const c of contacts) {
    const k = nameKey(c.first_name ?? "", c.last_name ?? "");
    if (!k.trim() || k === "|") continue;
    (byNameNorm.get(k) ?? byNameNorm.set(k, []).get(k)!).push(c);
  }
  const journeysByPrimary = new Map<string, Journey>();
  for (const j of activeJourneys) journeysByPrimary.set(j.primary_contact_id, j);
  const activeMemberSet = new Set<string>();
  for (const m of members) if (m.left_at === null) activeMemberSet.add(`${m.journey_id}:${m.contact_id}`);

  // --- Buckets ---
  const standardizationNeeded: { contactId: string; currentName: string; suggestedName: string; primaryEmail: string }[] = [];
  const missingCoOwners: {
    journeyId: string; journeyName: string; primaryName: string; territorySlug: string;
    suggestedName: string; suggestedRole: string; suggestedEmail: string | null;
    resolution: "found-contact" | "create-contact" | "multiple-matches"; matchedContactId: string | null;
    duplicates: string[]; note: string | null;
  }[] = [];
  const unmatchedPrimaries: { csv: CsvRow; reason: string }[] = [];
  const allDuplicateGroups: { name: string; email: string | null; contacts: Contact[] }[] = [];

  // Pre-scan: raw duplicate contacts (same first+last, more than one row).
  const seenDupeKeys = new Set<string>();
  for (const [key, group] of byNameNorm) {
    if (group.length < 2) continue;
    if (seenDupeKeys.has(key)) continue;
    seenDupeKeys.add(key);
    allDuplicateGroups.push({
      name: `${group[0].first_name} ${group[0].last_name}`,
      email: group[0].email,
      contacts: group,
    });
  }

  for (const row of csvRows) {
    // 1. Resolve primary contact
    let primary: Contact | null = null;
    const byEmailMatches = byEmail.get(normEmail(row.primaryEmail)) ?? [];
    if (byEmailMatches.length === 1) primary = byEmailMatches[0];
    else if (byEmailMatches.length > 1) {
      primary = byEmailMatches[0]; // pick one, flag dupes below
    } else {
      // Fallback: exact name match
      const n = standardizeName(row.primaryName);
      const nameMatches = byNameNorm.get(nameKey(n.first, n.last)) ?? [];
      if (nameMatches.length === 1) primary = nameMatches[0];
    }
    if (!primary) {
      unmatchedPrimaries.push({ csv: row, reason: "no matching contact by email or name" });
      continue;
    }

    // 2. Name standardization for primary
    const currentName = fullName(primary);
    const parsedPrimary = standardizeName(row.primaryName);
    if (currentName && currentName !== parsedPrimary.display && parsedPrimary.display.length > 3) {
      // Only flag when DB name literally differs (stripped nickname/role or trailing whitespace).
      const currentTrim = currentName.replace(/\s+/g, " ").trim();
      if (currentTrim !== parsedPrimary.display) {
        standardizationNeeded.push({
          contactId: primary.id,
          currentName: currentTrim,
          suggestedName: parsedPrimary.display,
          primaryEmail: primary.email ?? row.primaryEmail,
        });
      }
    }

    // 3. Find primary's journey
    const journey = journeysByPrimary.get(primary.id);
    if (!journey) {
      unmatchedPrimaries.push({ csv: row, reason: `primary ${fullName(primary)} has no active journey` });
      continue;
    }

    // 4. Parse co-owners
    const coOwners = splitCoOwners(row.coOwnerRaw);
    for (const { parsed, garbled } of coOwners) {
      if (garbled) {
        missingCoOwners.push({
          journeyId: journey.id, journeyName: journey.name, primaryName: fullName(primary),
          territorySlug: row.territorySlug, suggestedName: parsed.display,
          suggestedRole: "other", suggestedEmail: null,
          resolution: "create-contact", matchedContactId: null, duplicates: [],
          note: "GARBLED — needs manual name input",
        });
        continue;
      }
      // Does the primary already have another territory in this journey with same co-owner? Skip duplicates.
      // Role heuristic
      let role = "co_primary"; // default for two separate names
      if (parsed.note === "partner") role = "business_partner";
      else if (parsed.note === "operator") role = "business_partner";
      else if (parsed.last && parsed.last.toLowerCase() === (primary.last_name ?? "").toLowerCase()) {
        role = "family"; // default for same last name; user can re-label spouse
      } else {
        role = "co_primary"; // different last name, likely partnership
      }

      // Try to resolve to an existing contact
      const matchKey = nameKey(parsed.first, parsed.last);
      const nameMatches = byNameNorm.get(matchKey) ?? [];
      let matched: Contact | null = null;
      if (nameMatches.length === 1) matched = nameMatches[0];
      else if (nameMatches.length > 1) {
        // Prefer the one with a real GHL id (non-"related_" prefix) and/or with email.
        const real = nameMatches.find((c) => !c.ghl_contact_id.startsWith("related_") && !c.ghl_contact_id.startsWith("manual_"));
        matched = real ?? nameMatches.find((c) => c.email) ?? nameMatches[0];
      }

      if (matched && activeMemberSet.has(`${journey.id}:${matched.id}`)) {
        // Already on journey — nothing to do for this co-owner.
        continue;
      }

      const duplicateIds = nameMatches.length > 1 ? nameMatches.map((c) => c.id.slice(0, 8)) : [];
      missingCoOwners.push({
        journeyId: journey.id, journeyName: journey.name, primaryName: fullName(primary),
        territorySlug: row.territorySlug, suggestedName: parsed.display,
        suggestedRole: role, suggestedEmail: null,
        resolution: matched ? (nameMatches.length > 1 ? "multiple-matches" : "found-contact") : "create-contact",
        matchedContactId: matched?.id ?? null,
        duplicates: duplicateIds,
        note: parsed.note,
      });
    }
  }

  // --- Output --------------------------------------------------------------

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  RECONCILIATION — CSV vs DB                                ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  console.log(`\n▼ NAME STANDARDIZATION: ${standardizationNeeded.length}`);
  for (const s of standardizationNeeded) {
    console.log(`  ${s.currentName.padEnd(32)} → ${s.suggestedName.padEnd(32)} (${s.primaryEmail})`);
  }

  console.log(`\n▼ MISSING CO-OWNERS: ${missingCoOwners.length}`);
  const grouped = new Map<string, typeof missingCoOwners>();
  for (const m of missingCoOwners) {
    const arr = grouped.get(m.journeyId) ?? [];
    arr.push(m);
    grouped.set(m.journeyId, arr);
  }
  for (const arr of [...grouped.values()].sort((a, b) => a[0].primaryName.localeCompare(b[0].primaryName))) {
    const head = arr[0];
    console.log(`\n  ${head.primaryName}  [journey ${head.journeyName} / territory ${head.territorySlug}]`);
    for (const m of arr) {
      const tag = m.resolution === "create-contact" ? "CREATE " :
                  m.resolution === "multiple-matches" ? "DEDUPE " : "LINK   ";
      const dupes = m.duplicates.length ? ` dupes=[${m.duplicates.join(",")}]` : "";
      const note = m.note ? ` note="${m.note}"` : "";
      console.log(`    ${tag} ${m.suggestedName.padEnd(30)} role=${m.suggestedRole.padEnd(20)}${dupes}${note}`);
    }
  }

  console.log(`\n▼ DUPLICATE CONTACTS (same first+last, >1 row): ${allDuplicateGroups.length}`);
  for (const g of allDuplicateGroups.slice(0, 30)) {
    console.log(`  ${g.name}:`);
    for (const c of g.contacts) {
      console.log(`    ${c.id.slice(0, 8)}  ghl=${c.ghl_contact_id.padEnd(28)}  email=${c.email ?? "—"}  phone=${c.phone ?? "—"}`);
    }
  }
  if (allDuplicateGroups.length > 30) console.log(`  ... +${allDuplicateGroups.length - 30} more`);

  console.log(`\n▼ UNMATCHED CSV ROWS (no journey resolved): ${unmatchedPrimaries.length}`);
  for (const u of unmatchedPrimaries) {
    console.log(`  ${u.csv.territorySlug.padEnd(8)} ${u.csv.primaryName.padEnd(30)} ${u.csv.primaryEmail.padEnd(40)} — ${u.reason}`);
  }

  console.log("\nDone. This is a dry-run — nothing was written.");
}

void main();
