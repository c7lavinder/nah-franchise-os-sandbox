import { createServerClient } from "@/lib/supabase/server";

type MarketingFinding = {
  severity: "info" | "warning";
  message: string;
};

const LOOKBACK_DAYS = 90;
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

function canonicalChannelName(value: string | null | undefined) {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("google") || normalized.includes("adwords") || normalized.includes("paid search")) {
    return "Google Ads";
  }
  if (normalized.includes("facebook") || normalized.includes("meta") || normalized.includes("instagram")) {
    return "Facebook Ads";
  }
  if (normalized.includes("email") || normalized.includes("nurture") || normalized.includes("newsletter")) {
    return "Nurture / Email";
  }
  if (normalized.includes("referral") || normalized.includes("referred")) return "Referral";
  if (normalized.includes("organic") || normalized.includes("seo") || normalized.includes("website")) return "Organic SEO";
  if (normalized.includes("event") || normalized.includes("webinar")) return "Events / Webinars";
  if (normalized.includes("broker") || normalized.includes("realtor") || normalized.includes("agent")) return "Broker / Realtor";
  if (normalized.includes("partner")) return "Local Partnerships";
  return value?.trim() || "Unknown";
}

function lookbackStart() {
  const date = new Date();
  date.setDate(date.getDate() - LOOKBACK_DAYS);
  return date.toISOString();
}

export async function runMarketingIntelligence() {
  const supabase = createServerClient();
  const periodStart = lookbackStart();

  const [{ data: contacts, error: contactsError }, { data: leadChannels, error: channelsError }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, is_converted_franchisee, opportunity_source, sub_source, LeadSource, source, scout_lead_score")
      .gte("created_at", periodStart)
      .limit(5000),
    supabase
      .from("eos_territory_lead_channels")
      .select('"TerritorySlug", channel_name, is_active')
      .eq("is_active", true)
      .limit(5000),
  ]);

  if (contactsError) throw contactsError;
  if (channelsError) throw channelsError;

  const sourceCounts = new Map<string, number>();
  const activeChannels = new Map<string, Set<string>>();
  let convertedFranchisees = 0;
  let scoredContacts = 0;
  let scoreTotal = 0;

  for (const contact of contacts ?? []) {
    const source = canonicalChannelName(
      contact.opportunity_source ?? contact.sub_source ?? contact.LeadSource ?? contact.source
    );
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    if (contact.is_converted_franchisee) convertedFranchisees++;
    if (typeof contact.scout_lead_score === "number") {
      scoredContacts++;
      scoreTotal += contact.scout_lead_score;
    }
  }

  for (const channel of leadChannels ?? []) {
    const source = canonicalChannelName(channel.channel_name);
    const territories = activeChannels.get(source) ?? new Set<string>();
    if (channel.TerritorySlug) territories.add(channel.TerritorySlug);
    activeChannels.set(source, territories);
  }

  const findings: MarketingFinding[] = [];
  const missingChannels = EXPECTED_CHANNELS.filter((channel) => !activeChannels.has(channel));
  const activeWithoutLeads = [...activeChannels.entries()]
    .filter(([channel]) => (sourceCounts.get(channel) ?? 0) === 0)
    .map(([channel, territories]) => `${channel} (${territories.size} active territories)`);
  const leadsWithoutActiveChannel = [...sourceCounts.entries()]
    .filter(([source, count]) => source !== "Unknown" && count > 0 && !activeChannels.has(source))
    .map(([source, count]) => `${source} (${count} leads)`);

  if (missingChannels.length > 0) {
    findings.push({
      severity: "warning",
      message: `Missing active EOS channel coverage: ${missingChannels.slice(0, 5).join(", ")}.`,
    });
  }
  if (activeWithoutLeads.length > 0) {
    findings.push({
      severity: "warning",
      message: `Active lead channels with no ${LOOKBACK_DAYS}-day attributed leads: ${activeWithoutLeads.slice(0, 5).join(", ")}.`,
    });
  }
  if (leadsWithoutActiveChannel.length > 0) {
    findings.push({
      severity: "info",
      message: `Lead sources not mapped to active EOS channels: ${leadsWithoutActiveChannel.slice(0, 5).join(", ")}.`,
    });
  }

  const summary = {
    periodDays: LOOKBACK_DAYS,
    leads: contacts?.length ?? 0,
    convertedFranchisees,
    averageScoutScore: scoredContacts > 0 ? Math.round(scoreTotal / scoredContacts) : null,
    activeChannelCount: activeChannels.size,
    topSources: [...sourceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, leads]) => ({ name, leads })),
    findings,
  };

  await supabase.from("integration_logs").insert({
    integration_name: "marketing-intelligence",
    event_type: "marketing_channel_audit",
    status: "success",
    payload_summary: `${summary.leads} leads checked over ${LOOKBACK_DAYS} days; ${findings.length} findings.`,
  });

  return { success: true, summary };
}
