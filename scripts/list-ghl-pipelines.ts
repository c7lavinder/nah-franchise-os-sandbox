const GHL_BASE_URL = "https://services.leadconnectorhq.com";

async function main() {
  const apiKey = process.env.GHL_API_KEY!;
  const locationId = process.env.GHL_LOCATION_ID!;

  const res = await fetch(`${GHL_BASE_URL}/opportunities/pipelines?locationId=${locationId}`, {
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
  });
  const data = await res.json() as { pipelines: Array<{ id: string; name: string; stages: Array<{ id: string; name: string }> }> };

  for (const p of data.pipelines ?? []) {
    console.log(`Pipeline: ${p.name} (ID: ${p.id})`);
    for (const s of p.stages ?? []) {
      console.log(`  Stage: ${s.name} (ID: ${s.id})`);
    }
  }

  // Count opportunities per pipeline
  for (const p of data.pipelines ?? []) {
    const oppRes = await fetch(`${GHL_BASE_URL}/opportunities/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
      body: JSON.stringify({ locationId, pipelineId: p.id, pageLimit: 1 }),
    });
    const oppData = await oppRes.json() as { meta?: { total?: number } };
    console.log(`\n  Total opportunities in "${p.name}": ${oppData.meta?.total ?? "unknown"}`);
  }
}

main().catch(console.error);
