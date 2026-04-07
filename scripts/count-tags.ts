const GHL = "https://services.leadconnectorhq.com";

async function main() {
  const apiKey = process.env.GHL_API_KEY!;
  const locationId = process.env.GHL_LOCATION_ID!;
  const tagCounts: Record<string, number> = {};
  let total = 0;
  let cursor: string | undefined;
  let page = 0;

  while (true) {
    page++;
    let url = `${GHL}/contacts/?locationId=${locationId}&limit=100`;
    if (cursor) url += `&startAfterId=${cursor}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
    });

    if (!res.ok) { console.error("API error:", res.status); break; }

    const data = await res.json() as { contacts: Array<{ tags?: string[] }>; meta?: { startAfterId?: string } };
    const contacts = data.contacts ?? [];
    total += contacts.length;

    for (const c of contacts) {
      for (const t of c.tags ?? []) {
        tagCounts[t] = (tagCounts[t] ?? 0) + 1;
      }
    }

    if (page % 10 === 0) process.stderr.write(`Page ${page} (${total} contacts)\n`);
    if (contacts.length < 100 || !data.meta?.startAfterId) break;
    cursor = data.meta.startAfterId;
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`Total contacts: ${total}`);
  console.log(`\nTag distribution:`);
  const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  for (const [tag, count] of sorted) {
    console.log(`  ${tag}: ${count}`);
  }
}

main().catch(console.error);
