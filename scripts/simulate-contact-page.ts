/**
 * Runs the new contact-page classification against live data for a
 * handful of people, so we can confirm the rich/slim decision + the
 * franchisee/prospect label without spinning up the browser.
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
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!);

const FRANCHISE_ROLES = new Set(["primary", "co_primary", "business_partner"]);
const FRANCHISEE_PIPELINES = new Set(["runway", "onboarding"]);
const PROSPECT_PIPELINES = new Set(["sales", "followup"]);

async function simulate(contactId: string): Promise<void> {
  const { data: contact } = await s.from("contacts").select("id, first_name, last_name").eq("id", contactId).maybeSingle();
  if (!contact) return;
  const name = `${contact.first_name} ${contact.last_name}`;

  const [primaryJourneysRes, memberRowsRes] = await Promise.all([
    s.from("journeys").select("id, name").eq("primary_contact_id", contactId),
    s.from("journey_contacts").select("journey_id, role").eq("contact_id", contactId).is("left_at", null),
  ]);
  const primaryJourneys = primaryJourneysRes.data ?? [];
  const memberships = memberRowsRes.data ?? [];

  const roleRank = (r: string): number => r === "primary" ? 3 : r === "co_primary" ? 2 : r === "business_partner" ? 1 : 0;
  const joined = new Map<string, { id: string; role: string }>();
  for (const j of primaryJourneys) joined.set(j.id, { id: j.id, role: "primary" });
  for (const m of memberships) {
    const existing = joined.get(m.journey_id);
    if (!existing || roleRank(m.role) > roleRank(existing.role)) {
      joined.set(m.journey_id, { id: m.journey_id, role: m.role });
    }
  }

  const ids = [...joined.keys()];
  if (ids.length === 0) {
    console.log(`${name.padEnd(28)} → SLIM (no journeys)`);
    return;
  }

  const { data: jps } = await s.from("journey_pipeline_state")
    .select("journey_id, pipelines(slug), territory_ms_slug").in("journey_id", ids).eq("is_active", true);
  const slugsByJourney = new Map<string, Set<string>>();
  const terrsByJourney = new Map<string, Set<string>>();
  for (const r of (jps ?? []) as unknown as Array<{ journey_id: string; pipelines: { slug: string } | null; territory_ms_slug: string | null }>) {
    if (!slugsByJourney.has(r.journey_id)) slugsByJourney.set(r.journey_id, new Set());
    if (r.pipelines?.slug) slugsByJourney.get(r.journey_id)!.add(r.pipelines.slug);
    if (!terrsByJourney.has(r.journey_id)) terrsByJourney.set(r.journey_id, new Set());
    if (r.territory_ms_slug) terrsByJourney.get(r.journey_id)!.add(r.territory_ms_slug);
  }

  const kinds: Array<{ jid: string; kind: string; role: string; territories: string[] }> = [];
  for (const { id, role } of joined.values()) {
    if (!FRANCHISE_ROLES.has(role)) continue;
    const slugs = slugsByJourney.get(id) ?? new Set();
    let kind = "none";
    if ([...slugs].some((x) => FRANCHISEE_PIPELINES.has(x))) kind = "franchisee";
    else if ([...slugs].some((x) => PROSPECT_PIPELINES.has(x))) kind = "prospect";
    kinds.push({ jid: id, kind, role, territories: [...(terrsByJourney.get(id) ?? [])] });
  }

  const franchiseeHit = kinds.find((k) => k.kind === "franchisee");
  const prospectHit = kinds.find((k) => k.kind === "prospect");
  const activeMatch = franchiseeHit ?? prospectHit;

  if (!activeMatch) {
    console.log(`${name.padEnd(28)} → SLIM (side roles only: ${[...joined.values()].map((v) => v.role).join(", ")})`);
    return;
  }

  const terrs = activeMatch.kind === "franchisee"
    ? [...new Set(kinds.filter((k) => k.kind === "franchisee").flatMap((k) => k.territories))]
    : [];
  console.log(`${name.padEnd(28)} → RICH ${activeMatch.kind.toUpperCase().padEnd(10)} role=${activeMatch.role.padEnd(16)} territories=[${terrs.join(", ")}]`);
}

(async () => {
  // A mix: franchisees (co_primary, primary, business_partner), prospects, side members, strays.
  const tests = [
    "ff11625c-f6ae-4d47-9405-cb75c057f6eb", // Shannon Smylie — co_primary of MURFTN
    "b446b0a7",                              // Traci Owor — co_primary of partnership journey (no territory)
    "577186a8-e5ba-45a0-b6a2-61ff37859757", // Stephanie Hall — family of real Tim Hall journey
    "1e88e500",                              // Arthur W — prospect (single-letter lastname lead)
    "97292899",                              // Larry Rife — primary franchisee
  ];
  // Resolve shortened IDs
  const PAGE = 1000;
  const all: Array<{ id: string }> = [];
  let offset = 0;
  while (true) {
    const { data } = await s.from("contacts").select("id").range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  for (const t of tests) {
    const full = t.length === 36 ? t : all.find((c) => c.id.startsWith(t))?.id;
    if (!full) { console.log(`${t} not found`); continue; }
    await simulate(full);
  }
})();
