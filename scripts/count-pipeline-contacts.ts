const GHL_BASE_URL = "https://services.leadconnectorhq.com";

const PIPELINES = [
  { id: "u8cx33nKuYaRQUq3Pfys", name: "NAH Franchise Sales - Active" },
  { id: "K8JZALl2QZyNdIAL8I1L", name: "NAH Franchise Sales - Long-Term" },
];

async function countOpps(pipelineId: string): Promise<{ total: number; contactIds: Set<string> }> {
  const apiKey = process.env.GHL_API_KEY!;
  const locationId = process.env.GHL_LOCATION_ID!;
  const contactIds = new Set<string>();
  let page = 0;
  let startAfter = "";

  while (true) {
    page++;
    const body: Record<string, unknown> = { locationId, pipelineId, pageLimit: 100 };
    if (startAfter) body.startAfter = startAfter;

    const res = await fetch(`${GHL_BASE_URL}/opportunities/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
      body: JSON.stringify(body),
    });
    const data = await res.json() as { opportunities: Array<{ id: string; contactId: string; status: string }>; meta?: { nextPageUrl?: string; startAfter?: string; total?: number } };
    const opps = data.opportunities ?? [];

    for (const o of opps) {
      if (o.contactId) contactIds.add(o.contactId);
    }

    console.log(`  Page ${page}: ${opps.length} opps (unique contacts so far: ${contactIds.size})`);

    if (opps.length < 100 || !data.meta?.startAfter) break;
    startAfter = data.meta.startAfter;
    await new Promise((r) => setTimeout(r, 200));
  }

  return { total: contactIds.size, contactIds };
}

async function main() {
  console.log("Counting contacts per NAH pipeline...\n");

  const allContactIds = new Set<string>();

  for (const p of PIPELINES) {
    console.log(`${p.name}:`);
    const result = await countOpps(p.id);
    console.log(`  → ${result.total} unique contacts\n`);
    for (const id of result.contactIds) allContactIds.add(id);
  }

  console.log(`Total unique contacts across both pipelines: ${allContactIds.size}`);
}

main().catch(console.error);
