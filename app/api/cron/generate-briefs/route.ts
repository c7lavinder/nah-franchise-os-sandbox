export const dynamic = "force-dynamic";

/**
 * POST /api/cron/generate-briefs — regenerate stale contact + territory briefs.
 *
 * Runs nightly via Vercel Cron. Finds all briefs marked stale=true
 * and regenerates them. Also generates briefs for contacts/territories
 * that don't have one yet.
 *
 * No LLM call — pure data aggregation for speed and cost.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateAndStoreContactBrief } from "@/lib/briefs/contact-brief-generator";
import { generateAndStoreTerritoryBrief } from "@/lib/briefs/territory-brief-generator";

const BATCH_SIZE = 25;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const results = {
    contacts: { generated: 0, failed: 0 },
    territories: { generated: 0, failed: 0 },
  };

  // 1. Regenerate stale contact briefs
  const { data: staleContacts } = await supabase
    .from("contact_briefs")
    .select("contact_id")
    .eq("stale", true)
    .limit(BATCH_SIZE);

  for (const row of staleContacts ?? []) {
    try {
      await generateAndStoreContactBrief(row.contact_id);
      results.contacts.generated++;
    } catch (err) {
      results.contacts.failed++;
      console.error(
        `[generate-briefs] contact ${row.contact_id} failed:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // 2. Generate briefs for contacts that don't have one yet (new contacts)
  // Only contacts with at least one call (active leads)
  const { data: newContacts } = await supabase
    .from("contacts")
    .select("id")
    .not("id", "in", supabase.from("contact_briefs").select("contact_id"))
    .limit(BATCH_SIZE);

  // Supabase doesn't support subquery NOT IN, so use a different approach
  const { data: existingBriefIds } = await supabase.from("contact_briefs").select("contact_id");
  const existingSet = new Set((existingBriefIds ?? []).map((r) => r.contact_id));

  const { data: activeContacts } = await supabase
    .from("call_participants")
    .select("contact_id")
    .not("contact_id", "is", null)
    .limit(200);

  const uniqueNewContacts = [...new Set((activeContacts ?? []).map((r) => r.contact_id))]
    .filter((id): id is string => id != null && !existingSet.has(id))
    .slice(0, BATCH_SIZE);

  for (const contactId of uniqueNewContacts) {
    try {
      await generateAndStoreContactBrief(contactId);
      results.contacts.generated++;
    } catch (err) {
      results.contacts.failed++;
      console.error(
        `[generate-briefs] new contact ${contactId} failed:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // 3. Regenerate stale territory briefs
  const { data: staleTerritories } = await supabase
    .from("territory_briefs")
    .select("territory_slug")
    .eq("stale", true)
    .limit(BATCH_SIZE);

  for (const row of staleTerritories ?? []) {
    try {
      await generateAndStoreTerritoryBrief(row.territory_slug);
      results.territories.generated++;
    } catch (err) {
      results.territories.failed++;
      console.error(
        `[generate-briefs] territory ${row.territory_slug} failed:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // 4. Generate briefs for territories without one
  const { data: existingTerritoryBriefs } = await supabase.from("territory_briefs").select("territory_slug");
  const existingTerritorySet = new Set((existingTerritoryBriefs ?? []).map((r) => r.territory_slug));

  const { data: allTerritories } = await supabase
    .from("territories")
    .select(`"TerritorySlug"`)
    .eq("status", "active")
    .limit(200);

  const newTerritories = ((allTerritories ?? []) as any[])
    .map((t) => t.TerritorySlug)
    .filter((slug: string) => !existingTerritorySet.has(slug))
    .slice(0, BATCH_SIZE);

  for (const slug of newTerritories) {
    try {
      await generateAndStoreTerritoryBrief(slug);
      results.territories.generated++;
    } catch (err) {
      results.territories.failed++;
      console.error(
        `[generate-briefs] new territory ${slug} failed:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // Log to cron_job_log
  await supabase.from("cron_job_log").insert({
    job_name: "generate-briefs",
    status: results.contacts.failed + results.territories.failed === 0 ? "success" : "partial",
    metadata: results,
  });

  return NextResponse.json(results);
}
