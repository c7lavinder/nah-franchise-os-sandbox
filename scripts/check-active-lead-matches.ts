import { readFileSync } from "fs";

const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const ACTIVE_STAGES = new Set([
  "New Lead", "Intro Call", "PTO Log In Invite Sent", "PTO Invite Accepted",
  "Matt Call", "Sam Call", "Mark Call",
  "FDD Review Call / Item 23 Received", "Territory Call/FA Info Gathering Request Sent",
  "Matt Final Call",
]);

interface ActiveLead { email: string; name: string; stage: string; phone: string; }

function loadActiveLeads(): ActiveLead[] {
  const raw = readFileSync("FT Updated 4.7 - Sheet1.csv", "utf-8");
  const lines = raw.split("\n");
  const header = lines[0].split(",");
  const stageIdx = header.indexOf("~sales_cycle_name");
  const emailIdx = header.indexOf("email");
  const fnIdx = header.indexOf("firstName");
  const lnIdx = header.indexOf("lastName");
  const phoneIdx = header.indexOf("phone");

  const leads: ActiveLead[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields: string[] = [];
    let current = ""; let inQ = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { fields.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    fields.push(current.trim());

    const stage = fields[stageIdx] ?? "";
    if (stage.length < 50 && !stage.includes("<") && ACTIVE_STAGES.has(stage)) {
      leads.push({
        email: (fields[emailIdx] ?? "").toLowerCase().trim(),
        name: ((fields[fnIdx] ?? "") + " " + (fields[lnIdx] ?? "")).trim(),
        stage,
        phone: fields[phoneIdx] ?? "",
      });
    }
  }
  return leads;
}

async function main() {
  const apiKey = process.env.GHL_API_KEY!;
  const locationId = process.env.GHL_LOCATION_ID!;

  const activeLeads = loadActiveLeads();
  console.log(`Found ${activeLeads.length} active sales leads in CSV\n`);

  // Build GHL email + phone lookup
  const ghlByEmail = new Map<string, string>();
  const ghlByPhone = new Map<string, string>();
  let cursor: { id: string; ts: number } | undefined;

  while (true) {
    let url = `${GHL_BASE_URL}/contacts/?locationId=${locationId}&limit=100`;
    if (cursor) url += `&startAfterId=${cursor.id}&startAfter=${cursor.ts}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
    });
    const data = await res.json() as { contacts: Array<{ id: string; email?: string; phone?: string }>; meta?: { startAfterId?: string; startAfter?: number } };
    for (const c of data.contacts ?? []) {
      if (c.email) ghlByEmail.set(c.email.toLowerCase().trim(), c.id);
      if (c.phone) ghlByPhone.set(c.phone.replace(/\D/g, ""), c.id);
    }
    if ((data.contacts?.length ?? 0) < 100 || !data.meta?.startAfterId) break;
    cursor = { id: data.meta.startAfterId, ts: data.meta.startAfter! };
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`GHL: ${ghlByEmail.size} emails, ${ghlByPhone.size} phones\n`);

  let matched = 0;
  let unmatched = 0;

  for (const lead of activeLeads) {
    const emailMatch = ghlByEmail.get(lead.email);
    const phoneDigits = lead.phone.replace(/\D/g, "");
    const phoneMatch = phoneDigits ? ghlByPhone.get(phoneDigits) : undefined;

    if (emailMatch) {
      matched++;
      console.log(`✅ ${lead.name.padEnd(25)} ${lead.stage.padEnd(45)} (email match)`);
    } else if (phoneMatch) {
      matched++;
      console.log(`✅ ${lead.name.padEnd(25)} ${lead.stage.padEnd(45)} (phone match, GHL ID: ${phoneMatch})`);
    } else {
      unmatched++;
      console.log(`❌ ${lead.name.padEnd(25)} ${lead.stage.padEnd(45)} email=${lead.email} phone=${lead.phone}`);
    }
  }

  console.log(`\nMatched: ${matched} / ${activeLeads.length}`);
  if (unmatched > 0) console.log(`Unmatched: ${unmatched} — these need manual investigation`);
}

main().catch(console.error);
