export const dynamic = "force-dynamic";

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
    const supabase = createServerClient();

    // Step 1: Resolve local contact ID (contactId may be GHL ID or local UUID)
    let localContactId: string | null = null;
    let ghlContactId: string | null = null;

    // Try as local UUID first
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(contactId)) {
      const { data: localRow } = await supabase
        .from("contacts")
        .select("id, ghl_contact_id")
        .eq("id", contactId)
        .single();
      if (localRow) {
        localContactId = localRow.id;
        ghlContactId = localRow.ghl_contact_id;
      }
    }

    // Try as GHL contact ID
    if (!localContactId) {
      const { data: ghlRow } = await supabase
        .from("contacts")
        .select("id, ghl_contact_id")
        .eq("ghl_contact_id", contactId)
        .single();
      if (ghlRow) {
        localContactId = ghlRow.id;
        ghlContactId = ghlRow.ghl_contact_id;
      }
    }

    // Step 2: Read from contact_profile_fields (primary source)
    const fieldValues: Record<string, string | null> = {};
    const fieldSources: Record<string, { source: string; updatedAt: string }> = {};

    if (localContactId) {
      const { data: profileRows } = await supabase
        .from("contact_profile_fields")
        .select("field_name, field_value, last_updated_by, last_updated_at")
        .eq("contact_id", localContactId);

      for (const row of profileRows ?? []) {
        try {
          fieldValues[row.field_name] = row.field_value != null
            ? (typeof row.field_value === "string" ? JSON.parse(row.field_value) : row.field_value)
            : null;
        } catch {
          fieldValues[row.field_name] = row.field_value as string;
        }
        fieldSources[row.field_name] = {
          source: row.last_updated_by,
          updatedAt: row.last_updated_at,
        };
      }
    }

    // Step 3: GHL fallback — fill in any fields not yet in Supabase
    let contactName = "";
    if (ghlContactId) {
      try {
        const contact = await ghl.getContact(ghlContactId);
        contactName = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim();
        const fieldMapping = await getFieldMapping();

        const idToName = new Map<string, string>();
        for (const [, mapping] of fieldMapping) {
          idToName.set(mapping.ghl_field_id, mapping.field_name);
        }

        for (const cf of contact.customFields) {
          const name = idToName.get(cf.id);
          if (name && !fieldValues[name] && cf.value) {
            fieldValues[name] = cf.value;
            fieldSources[name] = { source: "ghl_fallback", updatedAt: "" };
          }
        }
      } catch {
        // GHL fetch failed — continue with Supabase-only data
      }
    }

    // Step 4: Build profile organized by all 18 categories
    const profile: Record<string, Record<string, string | null>> = {};

    for (const field of PROFILE_FIELDS) {
      if (!profile[field.category]) {
        profile[field.category] = {};
      }
      profile[field.category][field.name] = fieldValues[field.name] ?? null;
    }

    return NextResponse.json({
      contactId,
      localContactId,
      contactName,
      profile,
      raw: fieldValues,
      sources: fieldSources,
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

    const supabase = createServerClient();

    // Resolve local contact ID
    let localContactId: string | null = null;
    let ghlContactId: string | null = null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (uuidRegex.test(contactId)) {
      const { data } = await supabase.from("contacts").select("id, ghl_contact_id").eq("id", contactId).single();
      if (data) { localContactId = data.id; ghlContactId = data.ghl_contact_id; }
    }
    if (!localContactId) {
      const { data } = await supabase.from("contacts").select("id, ghl_contact_id").eq("ghl_contact_id", contactId).single();
      if (data) { localContactId = data.id; ghlContactId = data.ghl_contact_id; }
    }

    // Step 1: Write to contact_profile_fields (Supabase — primary)
    const supabaseUpdated: string[] = [];
    if (localContactId) {
      const rows = Object.entries(body.fields).map(([fieldName, value]) => ({
        contact_id: localContactId!,
        field_name: fieldName,
        field_value: JSON.stringify(value),
        last_updated_by: "manual" as const,
        last_updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("contact_profile_fields")
        .upsert(rows, { onConflict: "contact_id,field_name" });

      if (!error) {
        supabaseUpdated.push(...Object.keys(body.fields));
      }
    }

    // Step 2: Write-through to GHL (secondary — for fields with GHL mappings)
    let ghlUpdated: string[] = [];
    if (ghlContactId) {
      const fieldMapping = await getFieldMapping();
      const customFields: { id: string; value: string }[] = [];

      for (const [fieldName, value] of Object.entries(body.fields)) {
        const mapping = fieldMapping.get(fieldName.toLowerCase());
        if (mapping) {
          customFields.push({ id: mapping.ghl_field_id, value });
        }
      }

      if (customFields.length > 0) {
        try {
          await ghl.updateContact(ghlContactId, { customFields });
          ghlUpdated = customFields.map((cf) => cf.id);
        } catch {
          // GHL write failed — Supabase is still updated
        }
      }
    }

    return NextResponse.json({
      contactId,
      supabaseUpdated,
      ghlUpdated: ghlUpdated.length,
    });
  } catch (err) {
    console.error("Profile update failed:", err);
    const msg = err instanceof Error ? err.message : "Failed to update profile";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
