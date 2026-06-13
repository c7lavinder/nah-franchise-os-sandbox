export const dynamic = "force-dynamic";

/**
 * GET /api/workflows/data-fields
 *
 * Returns fields that workflow text can insert as personalization tokens.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { CATEGORY_META, PROFILE_FIELDS } from "@/lib/profile/field-registry";

const STANDARD_FIELDS = [
  { token: "{{journey.name}}", label: "Journey Name", group: "Journey", type: "text" },
  { token: "{{contact.name}}", label: "Contact Full Name", group: "Contact", type: "text" },
  { token: "{{contact.first_name}}", label: "Contact First Name", group: "Contact", type: "text" },
  { token: "{{contact.last_name}}", label: "Contact Last Name", group: "Contact", type: "text" },
  { token: "{{contact.email}}", label: "Contact Email", group: "Contact", type: "text" },
  { token: "{{contact.phone}}", label: "Contact Phone", group: "Contact", type: "text" },
  { token: "{{contact.source}}", label: "Contact Source", group: "Contact", type: "text" },
];

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const profileFields = PROFILE_FIELDS.filter((field) => field.name.trim().length > 0).map((field) => ({
    token: `{{profile.${field.name}}}`,
    label: field.label,
    group: CATEGORY_META[field.category]?.label ?? "Profile",
    type: field.dataType,
  }));

  return NextResponse.json({ fields: [...STANDARD_FIELDS, ...profileFields] });
}
