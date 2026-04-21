import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envRaw = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

async function main() {
  const contactId = process.argv[2];
  if (!contactId) { console.error("usage: ... <contactId>"); process.exit(1); }

  const { data: related } = await supabase
    .from("contact_related_people")
    .select("role, label, contact_id, linked_contact_id")
    .eq("contact_id", contactId);
  console.log("contact_related_people (old model, linked from this contact):", related);

  const { data: reverseRelated } = await supabase
    .from("contact_related_people")
    .select("role, label, contact_id, linked_contact_id")
    .eq("linked_contact_id", contactId);
  console.log("contact_related_people (old model, this contact is the linked side):", reverseRelated);

  const { data: journeyMemberships } = await supabase
    .from("journey_contacts")
    .select("journey_id, role, joined_at, left_at, journeys(name, status)")
    .eq("contact_id", contactId);
  console.log("journey_contacts memberships (new model):", journeyMemberships);
}
void main();
