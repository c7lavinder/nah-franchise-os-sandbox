export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

type MarketingPeriod = "T1" | "T3" | "T6" | "T12";

const PERIOD_MONTHS: Record<MarketingPeriod, number> = {
  T1: 1,
  T3: 3,
  T6: 6,
  T12: 12,
};

const PERIODS = new Set(Object.keys(PERIOD_MONTHS));

type ContactRow = {
  id: string;
  created_at: string;
  converted_at: string | null;
  is_converted_franchisee: boolean;
  opportunity_source: string | null;
  sub_source: string | null;
  LeadSource: string | null;
  source: string | null;
  scout_lead_score: number | null;
};

type SourceMetrics = {
  name: string;
  leads: number;
  convertedFranchisees: number;
  activePipeline: number;
  avgScoutScore: number | null;
  activeTerritories: number;
};

type PipelineSignal = {
  journeyId: string;
  contactId: string;
  pipelineName: string;
  pipelineSlug: string;
  stageName: string;
  enteredCurrentStageAt: string;
};

const PAID_NURTURE_CHANNELS = [
  {
    key: "google_ads",
    name: "Google Ads",
    matchers: ["google", "adwords", "google ads", "ppc", "paid search", "search ad"],
  },
  {
    key: "facebook_ads",
    name: "Facebook Ads",
    matchers: ["facebook", "fb", "meta", "instagram", "ig", "facebook ads", "social ad"],
  },
  {
    key: "nurture_email",
    name: "Nurture / Email",
    matchers: ["email", "nurture", "newsletter", "mailchimp", "constant contact", "drip", "workflow"],
  },
] as const;

const EXPECTED_CHANNELS = [
  "Google Ads",
  "Facebook Ads",
  "Nurture / Email",
  "Referral",
  "Organic SEO",
  "Events / Webinars",
  "Broker / Realtor",
  "Local Partnerships",
];

function getPeriod(rawPeriod: string | null): MarketingPeriod {
  const normalized = (rawPeriod ?? "T3").toUpperCase();
  return PERIODS.has(normalized) ? (normalized as MarketingPeriod) : "T3";
}

function getPeriodStart(period: MarketingPeriod) {
  const start = new Date();
  start.setMonth(start.getMonth() - PERIOD_MONTHS[period]);
  return start.toISOString();
}

function sourceFields(contact: ContactRow) {
  return [contact.opportunity_source, contact.sub_source, contact.LeadSource, contact.source]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function normalizedSourceText(contact: ContactRow) {
  return sourceFields(contact).join(" ").toLowerCase();
}

function primarySource(contact: ContactRow) {
  return sourceFields(contact)[0] ?? "Unknown";
}

function canonicalChannelName(value: string) {
  const normalized = value.toLowerCase();
  for (const channel of PAID_NURTURE_CHANNELS) {
    if (channel.matchers.some((matcher) => normalized.includes(matcher))) return channel.name;
  }
  if (normalized.includes("referral") || normalized.includes("referred")) return "Referral";
  if (normalized.includes("organic") || normalized.includes("seo") || normalized.includes("website"))
    return "Organic SEO";
  if (normalized.includes("event") || normalized.includes("webinar")) return "Events / Webinars";
  if (normalized.includes("broker") || normalized.includes("realtor") || normalized.includes("agent"))
    return "Broker / Realtor";
  if (normalized.includes("partner")) return "Local Partnerships";
  return value.trim() || "Unknown";
}

function buildMetrics(
  contacts: ContactRow[],
  activeJourneyIdsByContact: Map<string, Set<string>>
): Omit<SourceMetrics, "name" | "activeTerritories"> {
  const convertedFranchisees = contacts.filter((contact) => contact.is_converted_franchisee).length;
  const activePipeline = new Set(contacts.flatMap((contact) => [...(activeJourneyIdsByContact.get(contact.id) ?? [])]))
    .size;
  const scores = contacts
    .map((contact) => contact.scout_lead_score)
    .filter((score): score is number => typeof score === "number");

  return {
    leads: contacts.length,
    convertedFranchisees,
    activePipeline,
    avgScoutScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
  };
}

async function fetchAllContacts(periodStart: string): Promise<ContactRow[]> {
  const supabase = createServerClient();
  const pageSize = 1000;
  const rows: ContactRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("contacts")
      .select(
        "id, created_at, converted_at, is_converted_franchisee, opportunity_source, sub_source, LeadSource, source, scout_lead_score"
      )
      .gte("created_at", periodStart)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    rows.push(...((data ?? []) as ContactRow[]));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

async function fetchContactsByIds(contactIds: string[]): Promise<ContactRow[]> {
  if (contactIds.length === 0) return [];

  const supabase = createServerClient();
  const rows: ContactRow[] = [];
  const chunkSize = 500;

  for (let index = 0; index < contactIds.length; index += chunkSize) {
    const { data, error } = await supabase
      .from("contacts")
      .select(
        "id, created_at, converted_at, is_converted_franchisee, opportunity_source, sub_source, LeadSource, source, scout_lead_score"
      )
      .in("id", contactIds.slice(index, index + chunkSize));

    if (error) throw error;
    rows.push(...((data ?? []) as ContactRow[]));
  }

  return rows;
}

async function fetchPipelineSignals() {
  const supabase = createServerClient();
  const [{ data: pipelines, error: pipelinesError }, { data: stages, error: stagesError }] = await Promise.all([
    supabase.from("pipelines").select("id, name, slug"),
    supabase.from("pipeline_stages").select("id, name"),
  ]);

  if (pipelinesError) throw pipelinesError;
  if (stagesError) throw stagesError;

  // Paged — there are 3k+ active states and an unpaged select silently caps at
  // 1000, which under-reported every pipeline-derived number on this page
  // (found 2026-07-09 when the MasterSuite-native port disagreed).
  const states: {
    journey_id: string;
    pipeline_id: string;
    current_stage_id: string;
    entered_current_stage_at: string;
  }[] = [];
  for (let fromRow = 0; ; fromRow += 1000) {
    const { data, error: statesError } = await supabase
      .from("journey_pipeline_state")
      .select("journey_id, pipeline_id, current_stage_id, entered_current_stage_at")
      .eq("is_active", true)
      .range(fromRow, fromRow + 999);
    if (statesError) throw statesError;
    states.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const journeyIds = Array.from(new Set((states ?? []).map((state) => state.journey_id).filter(Boolean)));
  if (journeyIds.length === 0) return [];

  const pipelineById = new Map((pipelines ?? []).map((pipeline) => [pipeline.id, pipeline]));
  const stageById = new Map((stages ?? []).map((stage) => [stage.id, stage]));
  const contactIdsByJourney = new Map<string, Set<string>>();
  // 300 journeys/chunk keeps the journey_contacts response safely under the
  // same 1000-row cap even when journeys carry several members.
  const chunkSize = 300;

  for (let index = 0; index < journeyIds.length; index += chunkSize) {
    const chunk = journeyIds.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from("journey_contacts")
      .select("journey_id, contact_id")
      .in("journey_id", chunk)
      .is("left_at", null);

    if (error) throw error;
    for (const row of data ?? []) {
      const contacts = contactIdsByJourney.get(row.journey_id) ?? new Set<string>();
      if (row.contact_id) contacts.add(row.contact_id);
      contactIdsByJourney.set(row.journey_id, contacts);
    }
  }

  return (states ?? []).flatMap((state): PipelineSignal[] => {
    const pipeline = pipelineById.get(state.pipeline_id);
    const stage = stageById.get(state.current_stage_id);
    const contactIds = [...(contactIdsByJourney.get(state.journey_id) ?? [])];

    return contactIds.map((contactId) => ({
      journeyId: state.journey_id,
      contactId,
      pipelineName: pipeline?.name ?? "Unknown",
      pipelineSlug: pipeline?.slug ?? "unknown",
      stageName: stage?.name ?? "Unknown",
      enteredCurrentStageAt: state.entered_current_stage_at,
    }));
  });
}

async function fetchActiveTerritoriesByChannel() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("eos_territory_lead_channels")
    .select("TerritorySlug, channel_name, is_active")
    .eq("is_active", true);

  if (error) throw error;

  const activeChannels = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const name = canonicalChannelName(row.channel_name);
    const territories = activeChannels.get(name) ?? new Set<string>();
    territories.add(row.TerritorySlug);
    activeChannels.set(name, territories);
  }

  return activeChannels;
}

function buildSourceRows(
  contacts: ContactRow[],
  activeJourneyIdsByContact: Map<string, Set<string>>,
  activeTerritoriesByChannel: Map<string, Set<string>>
): SourceMetrics[] {
  const bySource = new Map<string, ContactRow[]>();

  for (const contact of contacts) {
    const name = canonicalChannelName(primarySource(contact));
    bySource.set(name, [...(bySource.get(name) ?? []), contact]);
  }

  for (const channelName of activeTerritoriesByChannel.keys()) {
    if (!bySource.has(channelName)) bySource.set(channelName, []);
  }

  return Array.from(bySource.entries())
    .map(([name, sourceContacts]) => ({
      name,
      ...buildMetrics(sourceContacts, activeJourneyIdsByContact),
      activeTerritories: activeTerritoriesByChannel.get(name)?.size ?? 0,
    }))
    .sort((a, b) => b.leads - a.leads || b.activeTerritories - a.activeTerritories || a.name.localeCompare(b.name));
}

function isNurtureSignal(signal: PipelineSignal) {
  const text = `${signal.pipelineSlug} ${signal.pipelineName} ${signal.stageName}`.toLowerCase();
  return text.includes("nurture") || text.includes("follow");
}

function buildSuggestedTests(
  sourceRows: SourceMetrics[],
  missingChannels: string[],
  activeChannels: { name: string; activeTerritories: number; periodLeads: number }[]
) {
  const suggestions: string[] = [];

  for (const missing of missingChannels.slice(0, 3)) {
    suggestions.push(`Validate ${missing} as a small territory test before adding it as an active EOS lead channel.`);
  }

  for (const channel of activeChannels.filter((item) => item.periodLeads === 0).slice(0, 3)) {
    suggestions.push(
      `Audit ${channel.name}: active in ${channel.activeTerritories} territor${channel.activeTerritories === 1 ? "y" : "ies"} but no period leads are attributed.`
    );
  }

  for (const source of sourceRows.filter((row) => row.leads > 0 && row.activeTerritories === 0).slice(0, 3)) {
    suggestions.push(
      `Review ${source.name}: leads exist in CRM attribution, but no active EOS territory channel is mapped.`
    );
  }

  return Array.from(new Set(suggestions)).slice(0, 6);
}

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const period = getPeriod(request.nextUrl.searchParams.get("period"));
    const periodStart = getPeriodStart(period);

    const [contacts, pipelineSignals, activeTerritoriesByChannel] = await Promise.all([
      fetchAllContacts(periodStart),
      fetchPipelineSignals(),
      fetchActiveTerritoriesByChannel(),
    ]);

    const activeJourneyIdsByContact = new Map<string, Set<string>>();
    for (const signal of pipelineSignals) {
      const journeys = activeJourneyIdsByContact.get(signal.contactId) ?? new Set<string>();
      journeys.add(signal.journeyId);
      activeJourneyIdsByContact.set(signal.contactId, journeys);
    }

    const nurtureContactIds = new Set(
      pipelineSignals
        .filter((signal) => isNurtureSignal(signal) && new Date(signal.enteredCurrentStageAt) >= new Date(periodStart))
        .map((signal) => signal.contactId)
    );
    const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
    const missingNurtureContactIds = [...nurtureContactIds].filter((contactId) => !contactById.has(contactId));
    for (const contact of await fetchContactsByIds(missingNurtureContactIds)) {
      contactById.set(contact.id, contact);
    }
    const nurtureContacts = [...nurtureContactIds]
      .map((contactId) => contactById.get(contactId))
      .filter((contact): contact is ContactRow => Boolean(contact));

    const channelCards = PAID_NURTURE_CHANNELS.map((channel) => {
      const channelContacts =
        channel.key === "nurture_email"
          ? nurtureContacts
          : contacts.filter((contact) =>
              channel.matchers.some((matcher) => normalizedSourceText(contact).includes(matcher))
            );

      return {
        key: channel.key,
        name: channel.name,
        ...buildMetrics(channelContacts, activeJourneyIdsByContact),
        spend: null,
        cac: null,
        dataStatus: "spend_not_connected",
        dataStatusLabel: "Spend not connected",
      };
    });

    const sourceRows = buildSourceRows(contacts, activeJourneyIdsByContact, activeTerritoriesByChannel);
    const activeChannels = Array.from(activeTerritoriesByChannel.entries())
      .map(([name, territories]) => ({
        name,
        activeTerritories: territories.size,
        periodLeads: sourceRows.find((row) => row.name === name)?.leads ?? 0,
      }))
      .sort((a, b) => b.activeTerritories - a.activeTerritories || b.periodLeads - a.periodLeads);
    const activeChannelNames = new Set(activeChannels.map((channel) => channel.name));
    const missingChannels = EXPECTED_CHANNELS.filter((channel) => !activeChannelNames.has(channel));

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      period,
      periodStart,
      periodOptions: [
        { value: "T1", label: "T1", months: 1 },
        { value: "T3", label: "T3", months: 3 },
        { value: "T6", label: "T6", months: 6 },
        { value: "T12", label: "T12", months: 12 },
      ],
      totals: {
        leads: contacts.length,
        convertedFranchisees: contacts.filter((contact) => contact.is_converted_franchisee).length,
        activePipeline: new Set(contacts.flatMap((contact) => [...(activeJourneyIdsByContact.get(contact.id) ?? [])]))
          .size,
      },
      channelCards,
      sourceRows,
      opportunityMap: {
        activeChannels,
        missingChannels,
        suggestedNextTests: buildSuggestedTests(sourceRows, missingChannels, activeChannels),
      },
    });
  } catch (err) {
    console.error("Marketing report fetch failed:", err);
    return NextResponse.json({ error: "Failed to load marketing reporting data" }, { status: 502 });
  }
}
