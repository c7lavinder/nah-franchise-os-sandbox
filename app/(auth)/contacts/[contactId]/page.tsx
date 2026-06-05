/**
 * /contacts/[contactId] — person-scoped page.
 *
 * Classification is journey-driven, not role-driven:
 *   - Franchisee → anyone in a franchise role (primary, co_primary,
 *     business_partner) on a journey with an active runway or onboarding
 *     pipeline state. Gets the RICH page with inventory + grades.
 *   - Prospect → anyone in a franchise role on a journey in sales or
 *     followup. Gets the RICH page without inventory/grades.
 *   - Side / advisor (spouse, family, attorney, accountant,
 *     financial_advisor, other) — always the SLIM page.
 *   - No journey at all → SLIM (stray contact).
 *
 * Territory ownership is read from the journey's pipeline state, not
 * from territory_owners — the journey's TerritorySlug is the source
 * of truth.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Phone, MapPin, Calendar, Users } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";
import { capitalizeName, formatPhone } from "@/lib/format/contact";
import RichContactPage from "@/components/contact/RichContactPage";
import BackButton from "@/components/contact/BackButton";
import ContactEmailsPanel from "@/components/contact/ContactEmailsPanel";

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
  journey_id: string;
  pipeline_id: string;
  TerritorySlug: string | null;
  current_stage_id: string;
  entered_current_stage_at: string;
  is_active: boolean;
  pipelines: { slug: string; name: string } | null;
  pipeline_stages: { name: string } | null;
}

const FRANCHISE_ROLES = new Set(["primary", "co_primary", "business_partner"]);
const FRANCHISEE_PIPELINES = new Set(["runway", "onboarding"]);
const PROSPECT_PIPELINES = new Set(["sales", "followup"]);

export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ contactId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { contactId: rawId } = await params;
  const { message } = await searchParams;
  const supabase = createServerClient();

  const localId = await resolveContactId(rawId);
  if (!localId) notFound();
  if (localId !== rawId) redirect(`/contacts/${localId}${message ? `?message=${encodeURIComponent(message)}` : ""}`);
  const contactId = localId;

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, city, state, opportunity_source, ghl_contact_id, created_at")
    .eq("id", contactId)
    .maybeSingle();

  if (!contact) notFound();

  const [primaryJourneysRes, memberRowsRes, callRowsRes, callTypesRes] = await Promise.all([
    supabase.from("journeys").select("id, name, status, primary_contact_id, slug").eq("primary_contact_id", contactId),
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
  const memberships = (memberRowsRes.data ?? []) as MembershipRow[];

  // Build a unified journey map: journey_id → { journey, role }
  // Roles on the same journey collapse to the strongest (primary > co_primary > other).
  const roleRank = (r: string): number =>
    r === "primary" ? 3 : r === "co_primary" ? 2 : r === "business_partner" ? 1 : 0;
  const joined = new Map<string, { journey: JourneyRow; role: string }>();
  for (const j of primaryJourneys) joined.set(j.id, { journey: j, role: "primary" });
  for (const m of memberships) {
    const j = Array.isArray(m.journeys) ? m.journeys[0] : m.journeys;
    if (!j) continue;
    const existing = joined.get(m.journey_id);
    if (!existing || roleRank(m.role) > roleRank(existing.role)) {
      joined.set(m.journey_id, { journey: j, role: m.role });
    }
  }

  const allJourneyIds = [...joined.keys()];
  if (message && allJourneyIds.length > 0) {
    const firstJourney = joined.values().next().value?.journey as JourneyRow | undefined;
    if (firstJourney) {
      const journeyHref = firstJourney.slug ? `/journeys/${firstJourney.slug}` : `/journeys/${firstJourney.id}`;
      redirect(`${journeyHref}?message=${encodeURIComponent(message)}`);
    }
  }

  if (allJourneyIds.length === 0) {
    return renderSlim(contactId, contact, memberships, callRowsRes.data ?? [], callTypesRes.data ?? []);
  }

  // Pull active pipeline states for every journey this person touches.
  const { data: jpsRaw } = await supabase
    .from("journey_pipeline_state")
    .select(
      "journey_id, pipeline_id, TerritorySlug, current_stage_id, entered_current_stage_at, is_active, pipelines(slug, name), pipeline_stages(name)"
    )
    .in("journey_id", allJourneyIds)
    .eq("is_active", true);
  const jpsByJourney = new Map<string, PipelineStateRow[]>();
  for (const row of (jpsRaw ?? []) as unknown as PipelineStateRow[]) {
    if (!jpsByJourney.has(row.journey_id)) jpsByJourney.set(row.journey_id, []);
    jpsByJourney.get(row.journey_id)!.push(row);
  }

  // Classify each journey this person is on a franchise role for.
  interface JourneyClass {
    journey: JourneyRow;
    role: string;
    kind: "franchisee" | "prospect" | "none";
    states: PipelineStateRow[];
  }
  const classed: JourneyClass[] = [];
  for (const { journey, role } of joined.values()) {
    if (!FRANCHISE_ROLES.has(role)) continue; // skip side/advisor memberships
    const states = jpsByJourney.get(journey.id) ?? [];
    const slugs = new Set(states.map((s) => s.pipelines?.slug).filter((s): s is string => !!s));
    let kind: "franchisee" | "prospect" | "none" = "none";
    if ([...slugs].some((s) => FRANCHISEE_PIPELINES.has(s))) kind = "franchisee";
    else if ([...slugs].some((s) => PROSPECT_PIPELINES.has(s))) kind = "prospect";
    classed.push({ journey, role, kind, states });
  }

  const franchiseeMatch = classed.find((c) => c.kind === "franchisee");
  const prospectMatch = classed.find((c) => c.kind === "prospect");
  const activeMatch = franchiseeMatch ?? prospectMatch;

  if (!activeMatch) {
    // They're on journeys but only as side members (spouse/advisor) — slim.
    return renderSlim(contactId, contact, memberships, callRowsRes.data ?? [], callTypesRes.data ?? []);
  }

  // activeMatch.kind is narrowed by the find() + branch above — it's
  // never "none" at this point.
  const role: "prospect" | "franchisee" = activeMatch.kind === "franchisee" ? "franchisee" : "prospect";
  const activeJourney = activeMatch.journey;
  const statesRaw = activeMatch.states;

  // Territories for the franchisee rich view: every TerritorySlug on
  // this person's franchise-role runway/onboarding journeys. No join
  // against territory_owners — journey pipeline is the source of truth.
  let grades: { year: number; quarter: number; self_grade: number | null; john_grade: number | null }[] = [];
  let territoryInventory: TerritoryInventoryRow[] = [];
  if (role === "franchisee") {
    const slugSet = new Set<string>();
    for (const c of classed) {
      if (c.kind !== "franchisee") continue;
      for (const s of c.states) {
        if (s.TerritorySlug && FRANCHISEE_PIPELINES.has(s.pipelines?.slug ?? "")) {
          slugSet.add(s.TerritorySlug);
        }
      }
    }
    const slugs = [...slugSet];
    if (slugs.length > 0) {
      const [tRes, gRes] = await Promise.all([
        supabase.from("territories").select("TerritorySlug, Nickname").in("TerritorySlug", slugs),
        supabase
          .from("territory_owner_grades")
          .select("year, quarter, self_grade, john_grade, TerritorySlug")
          .in("TerritorySlug", slugs)
          .order("year", { ascending: false })
          .order("quarter", { ascending: false }),
      ]);
      const tRows = (tRes.data ?? []) as { TerritorySlug: string; Nickname: string }[];

      // Fetch performance KPIs from raw property data for each territory
      const perfResults = await Promise.all(
        slugs.map(async (slug) => {
          try {
            const base =
              process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : "http://localhost:3000";
            const res = await fetch(`${base}/frandev/api/territories/${slug}/performance?period=ytd`, {
              headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
            });
            if (res.ok) {
              const d = await res.json();
              return { slug, kpis: d.kpis ?? null };
            }
          } catch {
            /* skip */
          }
          return { slug, kpis: null };
        })
      );
      const kpiBySlug = new Map(perfResults.map((r) => [r.slug, r.kpis]));

      territoryInventory = tRows.map((t) => {
        const k = kpiBySlug.get(t.TerritorySlug);
        return {
          TerritorySlug: t.TerritorySlug,
          Nickname: t.Nickname,
          purchased_ytd: k?.purchasedInPeriod ?? 0,
          sold_ytd: k?.soldInPeriod ?? 0,
          active_deals: k?.activeInventory ?? 0,
          conv_rate: k?.conversionRate ?? null,
          avg_profit: k?.avgProfit ?? null,
        };
      });
      grades = (gRes.data ?? []) as typeof grades;
    }
  }

  const displayName =
    capitalizeName(`${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()) || contact.email || "Unknown";
  const primaryState = statesRaw[0];

  return (
    <RichContactPage
      contactId={contactId}
      displayName={displayName}
      role={role}
      contact={{
        email: contact.email,
        phone: contact.phone,
        city: contact.city,
        state: contact.state,
        opportunity_source: contact.opportunity_source,
      }}
      activeJourney={{
        id: activeJourney.id,
        name: activeJourney.name,
        slug: activeJourney.slug,
        status: activeJourney.status,
      }}
      memberships={memberships}
      territoryInventory={territoryInventory}
      grades={grades}
      currentStage={primaryState?.pipeline_stages?.name ?? null}
      currentPipelineSlug={primaryState?.pipelines?.slug ?? null}
    />
  );
}

interface TerritoryInventoryRow {
  TerritorySlug: string;
  Nickname: string;
  purchased_ytd: number;
  sold_ytd: number;
  active_deals: number;
  conv_rate: number | null;
  avg_profit: number | null;
}

// ─── slim fallback for side members / advisors / strays ──────────────

async function renderSlim(
  contactId: string,
  contact: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    opportunity_source: string | null;
  },
  memberRows: unknown[],
  callRows: unknown[],
  callTypes: unknown[]
) {
  const callTypeMap = new Map<string, string>();
  for (const ct of callTypes as { id: string; name: string }[]) callTypeMap.set(ct.id, ct.name);

  const memberships: { journey: JourneyRow; role: string; joinedAt: string }[] = [];
  for (const raw of memberRows as MembershipRow[]) {
    const j = Array.isArray(raw.journeys) ? raw.journeys[0] : raw.journeys;
    if (!j) continue;
    memberships.push({ journey: j, role: raw.role, joinedAt: raw.joined_at });
  }

  // Look up each journey's pipeline so we can label the row as
  // "Franchisee" / "Prospect" (when this person is in a franchise role)
  // instead of the internal "Primary" / "Co-primary" wording.
  const kindByJourney = new Map<string, "franchisee" | "prospect" | null>();
  if (memberships.length > 0) {
    const supabase = createServerClient();
    const journeyIds = memberships.map((m) => m.journey.id);
    const { data: jps } = await supabase
      .from("journey_pipeline_state")
      .select("journey_id, pipelines(slug)")
      .in("journey_id", journeyIds)
      .eq("is_active", true);
    const slugsByJourney = new Map<string, Set<string>>();
    for (const row of (jps ?? []) as unknown as { journey_id: string; pipelines: { slug: string } | null }[]) {
      if (!slugsByJourney.has(row.journey_id)) slugsByJourney.set(row.journey_id, new Set());
      if (row.pipelines?.slug) slugsByJourney.get(row.journey_id)!.add(row.pipelines.slug);
    }
    for (const jid of journeyIds) {
      const slugs = slugsByJourney.get(jid) ?? new Set<string>();
      if ([...slugs].some((s) => FRANCHISEE_PIPELINES.has(s))) kindByJourney.set(jid, "franchisee");
      else if ([...slugs].some((s) => PROSPECT_PIPELINES.has(s))) kindByJourney.set(jid, "prospect");
      else kindByJourney.set(jid, null);
    }
  }

  /** Label for the role pill on a journey row. Franchise roles render as
   *  "Franchisee" or "Prospect" per the journey's pipeline; side roles
   *  keep their human label. */
  const roleLabel = (journeyId: string, role: string): string => {
    if (FRANCHISE_ROLES.has(role)) {
      const kind = kindByJourney.get(journeyId);
      if (kind === "franchisee") return "Franchisee";
      if (kind === "prospect") return "Prospect";
    }
    return role.replace(/_/g, " ");
  };

  const calls = callRows as CallRow[];
  const displayName =
    capitalizeName(`${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()) || contact.email || "Unknown";

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
              <ContactEmailsPanel contactId={contactId} initialPrimaryEmail={contact.email} />
              {contact.phone && (
                <div>
                  <dt className="text-text-tertiary text-[10px] flex items-center gap-1">
                    <Phone size={10} /> Phone
                  </dt>
                  <dd className="text-text-primary">{formatPhone(contact.phone)}</dd>
                </div>
              )}
              {(contact.city || contact.state) && (
                <div>
                  <dt className="text-text-tertiary text-[10px] flex items-center gap-1">
                    <MapPin size={10} /> Location
                  </dt>
                  <dd className="text-text-primary">
                    {[capitalizeName(contact.city), contact.state?.toUpperCase()].filter(Boolean).join(", ")}
                  </dd>
                </div>
              )}
              {contact.opportunity_source && (
                <div>
                  <dt className="text-text-tertiary text-[10px]">Lead Source</dt>
                  <dd className="text-text-primary">{contact.opportunity_source}</dd>
                </div>
              )}
            </dl>
            <p className="mt-3 pt-3 border-t border-border-default text-[10px] text-text-tertiary">
              This contact isn&apos;t a franchisee or prospect. To edit extended profile fields, open a journey
              they&apos;re part of.
            </p>
          </div>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Users size={14} className="text-text-tertiary" />
              <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider">
                JOURNEYS ({memberships.length})
              </h3>
            </div>
            {memberships.length === 0 ? (
              <p className="text-caption text-text-tertiary">This contact is not part of any journey yet.</p>
            ) : (
              <div className="space-y-1">
                {memberships.map(({ journey, role, joinedAt }) => (
                  <Link
                    key={journey.id}
                    href={`/journeys/${journey.id}`}
                    className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-bg-hover transition-colors"
                  >
                    <span className="text-body-sm font-medium text-text-primary truncate flex-1">{journey.name}</span>
                    <span className="text-[10px] text-text-tertiary">{roleLabel(journey.id, role)}</span>
                    <span
                      className={`text-[10px] px-1.5 rounded ${journey.status === "active" ? "bg-success/10 text-success" : journey.status === "closed" ? "bg-text-tertiary/10 text-text-tertiary" : "bg-nah-blue/10 text-nah-blue"}`}
                    >
                      {journey.status}
                    </span>
                    <span className="text-[10px] text-text-tertiary w-20 text-right">
                      {new Date(joinedAt).toLocaleDateString()}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Calendar size={14} className="text-text-tertiary" />
              <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider">
                CALL HISTORY ({calls.length})
              </h3>
            </div>
            {calls.length === 0 ? (
              <p className="text-caption text-text-tertiary">No calls logged for this contact.</p>
            ) : (
              <div className="space-y-1">
                {calls.map((c) => {
                  const when = c.scheduled_at ?? c.started_at;
                  const typeName = c.call_type_id ? (callTypeMap.get(c.call_type_id) ?? "Call") : "Call";
                  return (
                    <Link
                      key={c.id}
                      href={`/calls/${c.id}`}
                      className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-bg-hover transition-colors"
                    >
                      <span className="text-body-sm font-medium text-text-primary truncate flex-1">{typeName}</span>
                      {c.duration_seconds ? (
                        <span className="text-[10px] text-text-tertiary">{Math.round(c.duration_seconds / 60)}m</span>
                      ) : null}
                      {c.grade && (
                        <span
                          className={`text-[10px] font-bold px-1 rounded ${c.grade === "A" ? "bg-success/10 text-success" : c.grade === "F" ? "bg-danger/10 text-danger" : "bg-nah-blue/10 text-nah-blue"}`}
                        >
                          {c.grade}
                        </span>
                      )}
                      <span
                        className={`text-[10px] px-1.5 rounded ${c.status === "completed" ? "bg-success/10 text-success" : c.status === "missed" ? "bg-danger/10 text-danger" : "bg-text-tertiary/10 text-text-tertiary"}`}
                      >
                        {c.status}
                      </span>
                      <span className="text-[10px] text-text-tertiary w-20 text-right">
                        {when ? new Date(when).toLocaleDateString() : "—"}
                      </span>
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
