import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import type { GHLContact } from "@/types/ghl";

interface PersonalizeWorkflowTextInput {
  text: string | null | undefined;
  contactName: string | null;
  ghlContactId?: string | null;
}

const FIELD_TOKEN_RE = /\{\{\s*(journey\.name|contact\.[a-zA-Z_]+|custom\.[^}]+?)\s*\}\}/g;

export async function personalizeWorkflowText({
  text,
  contactName,
  ghlContactId,
}: PersonalizeWorkflowTextInput): Promise<string> {
  if (!text) return "";

  const name = contactName ?? "there";
  const firstName = name.split(" ")[0] || name;

  let output = text
    .replace(/\[Name\]/g, name)
    .replace(/\[FirstName\]/g, firstName)
    .replace(/\[name\]/g, name)
    .replace(/\[firstName\]/g, firstName)
    .replace(/\{\{\s*client\.firstName\s*\}\}/g, firstName);

  if (!FIELD_TOKEN_RE.test(output)) return output;
  FIELD_TOKEN_RE.lastIndex = 0;

  const contact = ghlContactId ? await loadContact(ghlContactId) : null;
  const customFieldMap = /\{\{\s*custom\./.test(output) ? await loadCustomFieldMap() : new Map<string, string>();

  return output.replace(FIELD_TOKEN_RE, (_match, rawKey: string) => {
    const key = rawKey.trim();

    if (key === "journey.name" || key === "contact.name") return name;
    if (key === "contact.first_name") return contact?.firstName ?? firstName;
    if (key === "contact.last_name") return contact?.lastName ?? "";
    if (key === "contact.email") return contact?.email ?? "";
    if (key === "contact.phone") return contact?.phone ?? "";
    if (key === "contact.source") return contact?.source ?? "";
    if (key === "contact.tags") return (contact?.tags ?? []).join(", ");

    if (key.startsWith("custom.")) {
      const fieldName = key.slice("custom.".length).trim().toLowerCase();
      const fieldId = customFieldMap.get(fieldName);
      if (!fieldId) return "";
      const customField = contact?.customFields?.find((field) => field.id === fieldId);
      return String(customField?.value ?? "");
    }

    return "";
  });
}

async function loadContact(ghlContactId: string): Promise<GHLContact | null> {
  try {
    return await ghl.getContact(ghlContactId);
  } catch {
    return null;
  }
}

async function loadCustomFieldMap(): Promise<Map<string, string>> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("ghl_custom_fields")
    .select("field_name, ghl_field_id")
    .eq("entity_type", "contact");

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.field_name && row.ghl_field_id) {
      map.set(String(row.field_name).toLowerCase(), String(row.ghl_field_id));
    }
  }
  return map;
}
