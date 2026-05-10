/**
 * Post-drop sanity: columns contacts.territory + contacts.TerritorySlug
 * should be gone after 20260422700000_drop_contact_territory_columns.sql.
 */

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
  const { error: territoryErr } = await supabase.from("contacts").select("territory").limit(1);
  const { error: slugErr } = await supabase.from("contacts").select("TerritorySlug").limit(1);
  console.log(
    territoryErr
      ? `contacts.territory: gone (${territoryErr.message.slice(0, 70)})`
      : "contacts.territory: STILL PRESENT"
  );
  console.log(
    slugErr ? `contacts.TerritorySlug: gone (${slugErr.message.slice(0, 70)})` : "contacts.TerritorySlug: STILL PRESENT"
  );

  const { count, error } = await supabase.from("contacts").select("id", { count: "exact", head: true });
  console.log(error ? `contacts table read ERR: ${error.message}` : `contacts table read: ${count} rows, still intact`);
}

void main();
