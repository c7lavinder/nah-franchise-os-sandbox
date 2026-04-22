/**
 * /contacts/[contactId] — person-scoped page.
 *
 * Split by role:
 *   - Prospect / franchisee (primary on ≥1 journey) → RICH page with
 *     Activity Snapshot, Quarterly Grades (franchisee only), and tabs
 *     for Profile / Personal EOS / Contacts / Deals.
 *   - Side-member-only (spouse, attorney, advisor) → SLIM page: profile
 *     summary + journeys list + call history.
 *   - No journeys → SLIM page anyway (a stray contact).
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Phone, Mail, MapPin, Calendar, Users } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";
import { capitalizeName, formatPhone } from "@/lib/format/contact";
import RichContactPage from "@/components/contact/RichContactPage";
import BackButton from "@/components/contact/BackButton";

export const dynamic = "force-dynamic";

interface JourneyRow {
  id: string;
  name: string;
  status: string;
  primary_contact_id: string;
  slug: string | null;
}
interface MembershipRow {
  journey_id: string;
  role: string;
  joined_at: string;
  journeys: JourneyRow | JourneyRow[] | null;
}
interface CallRow {
  id: string;
  scheduled_at: string | null;
  started_at: string | null;
  status: string;
  duration_seconds: number | null;
  grade: string | null;
  call_type_id: string | null;
}
interface PipelineStateRow {
  pipeline_id: string;
  territory_ms_slug: string | null;
  current_stage_id: string;
  entered_current_stage_at: string;
  is_active: boolean;
  pipelines: { slug: string; name: string } | null;
  pipeline_stages: { name: string } | null;
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const { contactId: rawId } = await params;
  const supabase = createServerClient();

  // Accept both a local contacts.id UUID and a GHL contact id so legacy
  // /leads/<ghl_id> bookmarks + any GHL-side integrations keep working
  // when they redirect here.
  const localId = await resolveContactId(rawId);
  if (!localId) notFound();
  // Canonical URL is local UUID. If the caller passed a GHL ID, redirect
  // so the browser URL bar settles on the canonical form.
  if (localId !== rawId) redirect(`/contacts/${localId}`);
  const contactId = localId;

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, city, state, opportunity_source, ghl_contact_id, is_converted_franchisee, created_at")
    .eq("id", contactId)
    .maybeSingle();

  if (!contact) notFound();

  const [primaryJourneysRes, memberRowsRes, callRowsRes, callTypesRes] = await Promise.all([
    supabase
      .from("journeys")
      .select("id, name, status, primary_contact_id, slug")
      .eq("primary_contact_id", contactId),
    supabase
      .from("journey_contacts")
      .select("journey_id, role, joined_at, journeys(id, name, status, primary_contact_id, slug)")
      .eq("contact_id", contactId)
      .is("left_at", null)
      .order("joined_at", { ascending: false }),
    supabase
      .from("calls")
      .select("id, scheduled_at, started_at, status, duration_seconds, grade, call_type_id")
      .eq("contact_id", contactId)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(30),
    supabase.from("call_types").select("id, name"),
  ]);

  const primaryJourneys = (primaryJourneysRes.data ?? []) as JourneyRow[];
  const isPrimary = primaryJourneys.length > 0;

  // Render slim view for non-primary contacts (spouses/advisors/strays).
  if (!isPrimary) {
    return renderSlim(contact, memberRowsRes.data ?? [], callRowsRes.data ?? [], callTypesRes.data ?? []);
  }

  // Rich view for prospects + franchisees. Classify by pipeline state —
  // a franchisee has at least one active runway or onboarding state.
  const activeJourney = primaryJourneys.find((j) => j.status === "active") ?? primaryJourneys[0];
  const { data: pipelineStates } = await supabase
    .from("journey_pipeline_state")
    .select("pipeline_id, territory_ms_slug, current_stage_id, entered_current_stage_at, is_active, pipelines(slug, name), pipeline_stages(name)")
    .eq("journey_id", activeJourney.id)
    .eq("is_active", true);

  const statesRaw = (pipelineStates ?? []) as unknown as PipelineStateRow[];
  const isFranchisee = Boolean(contact.is_converted_franchisee)
    || statesRaw.some((p) => p.pipelines?.slug === "runway" || p.pipelines?.slug === "onboarding");
  const role: "prospect" | "franchisee" = isFranchisee ? "franchisee" : "prospect";

  // Grades + per-territory inventory (franchisee only). Rolls up across
  // every territory owned by this contact's GHL id.
  let grades: { year: number; quarter: number; self_grade: number | null; john_grade: number | null }[] = [];
  let territoryInventory: TerritoryInventoryRow[] = [];
  if (isFranchisee && contact.ghl_contact_id) {
    const { data: ownerRows } = await supabase
      .from("territory_owners")
      .select("ms_slug")
      .eq("ghl_contact_id", contact.ghl_contact_id)
      .is("end_date", null);
    const slugs = (ownerRows ?? []).map((r) => r.ms_slug);
    if (slugs.length > 0) {
      const [tRes, gRes, pRes] = await Promise.all([
        supabase.from("territories").select("ms_slug, territory_name").in("ms_slug", slugs),
        supabase.from("territory_owner_grades")
          .select("year, quarter, self_grade, john_grade, ms_slug")
          .in("ms_slug", slugs)
          .order("year", { ascending: false }).order("quarter", { ascending: false }),
        supabase.from("territory_profile")
          .select("ms_slug, houses_purchased_ytd, houses_sold_ytd, active_deals, lead_conversion_rate, avg_profit_per_flip")
          .in("ms_slug", slugs),
      ]);
      const tRows = (tRes.data ?? []) as { ms_slug: string; territory_name: string }[];
      const pRows = (pRes.data ?? []) as { ms_slug: string; houses_purchased_ytd: number | null; houses_sold_ytd: number | null; active_deals: number | null; lead_conversion_rate: number | null; avg_profit_per_flip: number | null }[];
      const nameBySlug = new Map(tRows.map((t) => [t.ms_slug, t.territory_name]));
      territoryInventory = tRows.map((t) => {
        const p = pRows.find((x) => x.ms_slug === t.ms_slug);
        return {
          ms_slug: t.ms_slug,
          territory_name: nameBySlug.get(t.ms_slug) ?? t.ms_slug,
          purchased_ytd: p?.houses_purchased_ytd ?? 0,
          sold_ytd: p?.houses_sold_ytd ?? 0,
          active_deals: p?.active_deals ?? 0,
          conv_rate: p?.lead_conversion_rate ?? null,
          avg_profit: p?.avg_profit_per_flip ?? null,
        };
      });
      grades = (gRes.data ?? []) as typeof grades;
    }
  }

  const memberships = (memberRowsRes.data ?? []) as MembershipRow[];
  const displayName = capitalizeName(`${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim())
    || contact.email || "Unknown";
  const primaryState = statesRaw[0];

  return (
    <RichContactPage
      contactId={contactId}
      displayName={displayName}
      role={role}
      contact={{
        email: contact.email, phone: contact.phone,
        city: contact.city, state: contact.state,
        opportunity_source: contact.opportunity_source,
      }}
      activeJourney={{ id: activeJourney.id, name: activeJourney.name, slug: activeJourney.slug, status: activeJourney.status }}
      memberships={memberships}
      territoryInventory={territoryInventory}
      grades={grades}
      currentStage={primaryState?.pipeline_stages?.name ?? null}
      currentPipelineSlug={primaryState?.pipelines?.slug ?? null}
    />
  );
}

interface TerritoryInventoryRow {
  ms_slug: string;
  territory_name: string;
  purchased_ytd: number;
  sold_ytd: number;
  active_deals: number;
  conv_rate: number | null;
  avg_profit: number | null;
}

// ─── slim fallback (unchanged) ───────────────────────────────────────

function renderSlim(
  contact: { first_name: string | null; last_name: string | null; email: string | null; phone: string | null; city: string | null; state: string | null; opportunity_source: string | null },
  memberRows: unknown[],
  callRows: unknown[],
  callTypes: unknown[],
) {
  const callTypeMap = new Map<string, string>();
  for (const ct of callTypes as { id: string; name: string }[]) callTypeMap.set(ct.id, ct.name);

  const memberships: { journey: JourneyRow; role: string; joinedAt: string }[] = [];
  for (const raw of memberRows as MembershipRow[]) {
    const j = Array.isArray(raw.journeys) ? raw.journeys[0] : raw.journeys;
    if (!j) continue;
    memberships.push({ journey: j, role: raw.role, joinedAt: raw.joined_at });
  }
  const calls = callRows as CallRow[];
  const displayName = capitalizeName(`${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()) || contact.email || "Unknown";

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="font-headline text-page-title text-text-primary truncate flex-1">{displayName}</h1>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
            <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider mb-3">CONTACT INFORMATION</h3>
            <dl className="space-y-2 text-body-sm">
              <div>
                <dt className="text-text-tertiary text-[10px]">Name</dt>
                <dd className="text-text-primary">{displayName}</dd>
              </div>
              {contact.email && <div><dt className="text-text-tertiary text-[10px] flex items-center gap-1"><Mail size={10} /> Email</dt><dd className="text-text-primary break-all">{contact.email}</dd></div>}
              {contact.phone && <div><dt className="text-text-tertiary text-[10px] flex items-center gap-1"><Phone size={10} /> Phone</dt><dd className="text-text-primary">{formatPhone(contact.phone)}</dd></div>}
              {(contact.city || contact.state) && <div><dt className="text-text-tertiary text-[10px] flex items-center gap-1"><MapPin size={10} /> Location</dt><dd className="text-text-primary">{[capitalizeName(contact.city), contact.state?.toUpperCase()].filter(Boolean).join(", ")}</dd></div>}
              {contact.opportunity_source && <div><dt className="text-text-tertiary text-[10px]">Lead Source</dt><dd className="text-text-primary">{contact.opportunity_source}</dd></div>}
            </dl>
            <p className="mt-3 pt-3 border-t border-border-default text-[10px] text-text-tertiary">
              This contact isn&apos;t the primary on any journey. To edit extended profile fields, open a journey they&apos;re part of.
            </p>
          </div>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Users size={14} className="text-text-tertiary" />
              <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider">JOURNEYS ({memberships.length})</h3>
            </div>
            {memberships.length === 0 ? (
              <p className="text-caption text-text-tertiary">This contact is not part of any journey yet.</p>
            ) : (
              <div className="space-y-1">
                {memberships.map(({ journey, role, joinedAt }) => (
                  <Link key={journey.id} href={`/journeys/${journey.id}`} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-bg-hover transition-colors">
                    <span className="text-body-sm font-medium text-text-primary truncate flex-1">{journey.name}</span>
                    <span className="text-[10px] text-text-tertiary">{role === "primary" ? "Primary" : role === "co_primary" ? "Co-primary" : role.replace(/_/g, " ")}</span>
                    <span className={`text-[10px] px-1.5 rounded ${journey.status === "active" ? "bg-success/10 text-success" : journey.status === "closed" ? "bg-text-tertiary/10 text-text-tertiary" : "bg-nah-blue/10 text-nah-blue"}`}>{journey.status}</span>
                    <span className="text-[10px] text-text-tertiary w-20 text-right">{new Date(joinedAt).toLocaleDateString()}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Calendar size={14} className="text-text-tertiary" />
              <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider">CALL HISTORY ({calls.length})</h3>
            </div>
            {calls.length === 0 ? (
              <p className="text-caption text-text-tertiary">No calls logged for this contact.</p>
            ) : (
              <div className="space-y-1">
                {calls.map((c) => {
                  const when = c.scheduled_at ?? c.started_at;
                  const typeName = c.call_type_id ? callTypeMap.get(c.call_type_id) ?? "Call" : "Call";
                  return (
                    <Link key={c.id} href={`/calls/${c.id}`} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-bg-hover transition-colors">
                      <span className="text-body-sm font-medium text-text-primary truncate flex-1">{typeName}</span>
                      {c.duration_seconds ? <span className="text-[10px] text-text-tertiary">{Math.round(c.duration_seconds / 60)}m</span> : null}
                      {c.grade && <span className={`text-[10px] font-bold px-1 rounded ${c.grade === "A" ? "bg-success/10 text-success" : c.grade === "F" ? "bg-danger/10 text-danger" : "bg-nah-blue/10 text-nah-blue"}`}>{c.grade}</span>}
                      <span className={`text-[10px] px-1.5 rounded ${c.status === "completed" ? "bg-success/10 text-success" : c.status === "missed" ? "bg-danger/10 text-danger" : "bg-text-tertiary/10 text-text-tertiary"}`}>{c.status}</span>
                      <span className="text-[10px] text-text-tertiary w-20 text-right">{when ? new Date(when).toLocaleDateString() : "—"}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
