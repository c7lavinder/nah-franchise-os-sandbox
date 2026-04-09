import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { count: contactCount } = await sb.from("contacts").select("id", { count: "exact", head: true });
  console.log("Contacts:", contactCount);

  const { count: cpfCount } = await sb.from("contact_profile_fields").select("id", { count: "exact", head: true });
  console.log("Profile field rows:", cpfCount);

  const { data: ghlFields } = await sb
    .from("ghl_custom_fields")
    .select("field_name, field_key, ghl_field_id")
    .eq("entity_type", "contact")
    .limit(100);
  console.log("GHL custom field mappings:", ghlFields?.length ?? 0);
  if (ghlFields) {
    for (const f of ghlFields) {
      console.log(`  ${f.field_key} -> ${f.field_name} (${f.ghl_field_id})`);
    }
  }

  // Check if tables exist in production
  const { error: cpfError } = await sb.from("contact_profile_fields").select("id").limit(1);
  console.log("\ncontact_profile_fields table:", cpfError ? `ERROR: ${cpfError.message}` : "EXISTS");

  const { error: embError } = await sb.from("embeddings").select("id").limit(1);
  console.log("embeddings table:", embError ? `ERROR: ${embError.message}` : "EXISTS");
}

main().catch(console.error);
