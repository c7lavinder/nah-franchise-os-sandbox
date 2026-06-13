export const dynamic = "force-dynamic";

/**
 * GET /api/workflows/data-fields
 *
 * Returns fields that workflow text can insert as personalization tokens.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

const STANDARD_FIELDS = [
  { token: "{{journey.name}}", label: "Journey Name", group: "Journey", type: "text" },
  { token: "{{contact.name}}", label: "Contact Full Name", group: "Contact", type: "text" },
  { token: "{{contact.first_name}}", label: "Contact First Name", group: "Contact", type: "text" },
  { token: "{{contact.last_name}}", label: "Contact Last Name", group: "Contact", type: "text" },
  { token: "{{contact.email}}", label: "Contact Email", group: "Contact", type: "text" },
  { token: "{{contact.phone}}", label: "Contact Phone", group: "Contact", type: "text" },
  { token: "{{contact.source}}", label: "Contact Source", group: "Contact", type: "text" },
  { token: "{{contact.tags}}", label: "Contact Tags", group: "Contact", type: "text" },
];

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("ghl_custom_fields")
    .select("field_name, field_type, entity_type")
    .eq("entity_type", "contact")
    .order("field_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const customFields = (data ?? [])
    .filter((field) => typeof field.field_name === "string" && field.field_name.trim().length > 0)
    .map((field) => ({
      token: `{{custom.${field.field_name}}}`,
      label: field.field_name,
      group: "Custom Fields",
      type: field.field_type ?? "text",
    }));

  return NextResponse.json({ fields: [...STANDARD_FIELDS, ...customFields] });
}
