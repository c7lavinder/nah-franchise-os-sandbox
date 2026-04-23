import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envRaw = fs.readFileSync(path.resolve("/Users/vieiraproject/Desktop/nah-franchise-os-sandbox/.env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!);

interface Contact { id: string; first_name: string | null; last_name: string | null; email: string | null }

async function loadAll(): Promise<Contact[]> {
  const PAGE = 1000;
  const out: Contact[] = [];
  let offset = 0;
  while (true) {
    const { data } = await s.from("contacts").select("id, first_name, last_name, email").range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    out.push(...(data as Contact[]));
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

(async () => {
  const all = await loadAll();
  const full = (c: Contact): string => `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();

  const patterns: Array<[string, RegExp]> = [
    ["parens",            /[()]/],
    ["straight quotes",   /['"]/],
    ["curly quotes",      /[“”‘’]/],
    ["ampersand",         /&/],
    ["slash",             /\//],
    ["comma",             /,/],
    ["word 'and'/'or'",   /\b(and|or)\b/i],
    ["'aka'",             /\baka\b/i],
    ["'goes by'/'called'",/\b(goes by|called)\b/i],
    ["'nickname'",        /nickname/i],
    ["hash #",            /#/],
    ["asterisk *",        /\*/],
    ["plus +",            /\+/],
    ["dash between words",/\w+\s-\s\w+/],
  ];

  for (const [label, re] of patterns) {
    const hits = all.filter((c) => re.test(full(c)));
    if (hits.length === 0) continue;
    console.log(`\n── ${label} — ${hits.length}`);
    for (const c of hits.slice(0, 60)) {
      console.log(`  ${c.id.slice(0, 8)}  ${full(c).padEnd(45)}  email=${c.email ?? "null"}`);
    }
    if (hits.length > 60) console.log(`  ... +${hits.length - 60} more`);
  }
})();
