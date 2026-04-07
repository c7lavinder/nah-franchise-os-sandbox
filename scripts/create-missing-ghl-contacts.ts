/**
 * Creates the 7 missing active leads in GHL so the backfill can place them
 * at their correct Sales pipeline stage.
 */

const GHL_BASE_URL = "https://services.leadconnectorhq.com";

const MISSING_LEADS = [
  { firstName: "Ajiboye", lastName: "Babalola", email: "phayi4boye@gmail.com", phone: "+12027104153", city: "Upper Marlboro", state: "MD", postalCode: "20772" },
  { firstName: "Jacob", lastName: "Phillips", email: "jacob@houstonmail.net", phone: "+17132045802", city: "Pearland", state: "TX", postalCode: "77584" },
  { firstName: "Maxwell", lastName: "Furiasse", email: "Maxdfuriasse@gmail.com", phone: "+17086121147", city: "Palos hills", state: "IL", postalCode: "60465" },
  { firstName: "Tim", lastName: "Arnold", email: "timarn@gmail.com", phone: "+13178479804", city: "Carmel", state: "IN", postalCode: "46033" },
  { firstName: "William", lastName: "Scott", email: "will@wescotthomes.net", phone: "+15704705896", city: "Holmdel", state: "NJ", postalCode: "" },
  { firstName: "Jesse", lastName: "Green", email: "greenj254@gmail.com", phone: "+18107106195", city: "Lexington", state: "MI", postalCode: "48450" },
  { firstName: "Ramon", lastName: "Ayala", email: "raymet9090@gmail.com", phone: "+19049278870", city: "Deltona", state: "FL", postalCode: "32738" },
];

async function main() {
  const apiKey = process.env.GHL_API_KEY!;
  const locationId = process.env.GHL_LOCATION_ID!;

  console.log(`Creating ${MISSING_LEADS.length} contacts in GHL...\n`);

  for (const lead of MISSING_LEADS) {
    const res = await fetch(`${GHL_BASE_URL}/contacts/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
      body: JSON.stringify({
        locationId,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        city: lead.city,
        state: lead.state,
        postalCode: lead.postalCode,
        source: "Paid Ad",
        tags: ["ct-import"],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`❌ ${lead.firstName} ${lead.lastName}: ${res.status} — ${body}`);
      continue;
    }

    const data = await res.json() as { contact?: { id: string } };
    console.log(`✅ ${lead.firstName} ${lead.lastName} → GHL ID: ${data.contact?.id}`);

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\nDone. Re-run the backfill script and all 19 should match.");
}

main().catch(console.error);
