/**
 * GET /api/contacts/[contactId]/profile — read all custom fields for candidate profile
 * PUT /api/contacts/[contactId]/profile — update custom fields on a contact
 *
 * Translates between human-readable field names and GHL field IDs
 * using the ghl_custom_fields cache table.
 */

import { NextRequest, NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import { PROFILE_FIELDS } from "@/lib/profile/field-registry";

interface GHLFieldMapping {
  field_key: string;
  field_name: string;
  ghl_field_id: string;
}

/** Load the GHL field ID mapping from Supabase cache */
async function getFieldMapping(): Promise<Map<string, GHLFieldMapping>> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("ghl_custom_fields")
    .select("field_key, field_name, ghl_field_id")
    .eq("entity_type", "contact");

  const map = new Map<string, GHLFieldMapping>();
  if (data) {
    for (const row of data) {
      // Index by both field_name and field_key for flexible lookup
      map.set(row.field_name.toLowerCase(), row);
      map.set(row.field_key.toLowerCase(), row);
    }
  }
  return map;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const { contactId } = await params;
    const contact = await ghl.getContact(contactId);
    const fieldMapping = await getFieldMapping();

    // Build a name→value map from the contact's custom fields
    const fieldValues: Record<string, string | null> = {};

    // Also build a GHL ID → name reverse map
    const idToName = new Map<string, string>();
    for (const [, mapping] of fieldMapping) {
      idToName.set(mapping.ghl_field_id, mapping.field_name);
    }

    // Extract values from the contact's customFields array
    for (const cf of contact.customFields) {
      const name = idToName.get(cf.id);
      if (name) {
        fieldValues[name] = cf.value || null;
      }
    }

    // Build the profile response organized by category
    const profile: Record<string, Record<string, string | null>> = {};

    for (const field of PROFILE_FIELDS) {
      if (!profile[field.category]) {
        profile[field.category] = {};
      }
      profile[field.category][field.name] = fieldValues[field.name] ?? null;
    }

    return NextResponse.json({
      contactId,
      contactName: `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim(),
      profile,
      raw: fieldValues,
    });
  } catch (err) {
    console.error("Profile fetch failed:", err);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 502 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const { contactId } = await params;
    const body = await request.json() as { fields: Record<string, string> };

    if (!body.fields || typeof body.fields !== "object") {
      return NextResponse.json({ error: "fields object is required" }, { status: 400 });
    }

    const fieldMapping = await getFieldMapping();
    const customFields: { id: string; value: string }[] = [];

    for (const [fieldName, value] of Object.entries(body.fields)) {
      const mapping = fieldMapping.get(fieldName.toLowerCase());
      if (mapping) {
        customFields.push({ id: mapping.ghl_field_id, value });
      }
    }

    if (customFields.length === 0) {
      return NextResponse.json(
        { error: "No valid field mappings found. Run setup script to populate ghl_custom_fields." },
        { status: 400 }
      );
    }

    const updated = await ghl.updateContact(contactId, { customFields });

    return NextResponse.json({
      contactId,
      updated: Object.keys(body.fields),
      contact: updated,
    });
  } catch (err) {
    console.error("Profile update failed:", err);
    const msg = err instanceof Error ? err.message : "Failed to update profile";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
