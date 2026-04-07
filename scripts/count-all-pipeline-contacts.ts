const GHL_BASE_URL = "https://services.leadconnectorhq.com";

const PIPELINES = [
  { id: "u8cx33nKuYaRQUq3Pfys", name: "Active" },
  { id: "K8JZALl2QZyNdIAL8I1L", name: "Long-Term" },
  { id: "znmzzd8MwcwxUvPz4LMI", name: "New Franchise (old)" },
  { id: "ycJQWFkeFcYGtmf8lStE", name: "Onboarding" },
  { id: "icgSboIvYYLxGlgdMPlA", name: "Ray Heath" },
];

async function countOpps(pipelineId: string, statuses: string[]): Promise<Record<string, number>> {
  const apiKey = process.env.GHL_API_KEY!;
  const locationId = process.env.GHL_LOCATION_ID!;
  const counts: Record<string, number> = {};

  for (const status of statuses) {
    const contactIds = new Set<string>();
    let startAfter = "";

    while (true) {
      const body: Record<string, unknown> = { locationId, pipelineId, status, pageLimit: 100 };
      if (startAfter) body.startAfter = startAfter;

      const res = await fetch(`${GHL_BASE_URL}/opportunities/search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { opportunities: Array<{ contactId: string }>; meta?: { startAfter?: string } };
      const opps = data.opportunities ?? [];

      for (const o of opps) if (o.contactId) contactIds.add(o.contactId);
      if (opps.length < 100 || !data.meta?.startAfter) break;
      startAfter = data.meta.startAfter;
      await new Promise((r) => setTimeout(r, 150));
    }
    counts[status] = contactIds.size;
  }
  return counts;
}

async function main() {
  for (const p of PIPELINES) {
    const counts = await countOpps(p.id, ["open", "won", "lost", "abandoned"]);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`${p.name}: open=${counts.open} won=${counts.won} lost=${counts.lost} abandoned=${counts.abandoned} total=${total}`);
  }
}

main().catch(console.error);
