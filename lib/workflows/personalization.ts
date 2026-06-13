import { createServerClient } from "@/lib/supabase/server";
import { PROFILE_FIELDS } from "@/lib/profile/field-registry";

interface PersonalizeWorkflowTextInput {
  text: string | null | undefined;
  contactName: string | null;
  ghlContactId?: string | null;
}

const FIELD_TOKEN_RE = /\{\{\s*(journey\.name|contact\.[a-zA-Z_]+|profile\.[^}]+?|custom\.[^}]+?)\s*\}\}/g;

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

  const data = ghlContactId ? await loadWorkflowContactData(ghlContactId) : null;

  return output.replace(FIELD_TOKEN_RE, (_match, rawKey: string) => {
    const key = rawKey.trim();

    if (key === "journey.name" || key === "contact.name") return name;
    if (key === "contact.first_name") return stringifyFieldValue(data?.contact.first_name ?? firstName);
    if (key === "contact.last_name") return stringifyFieldValue(data?.contact.last_name);
    if (key === "contact.email") return stringifyFieldValue(data?.contact.email);
    if (key === "contact.phone") return stringifyFieldValue(data?.contact.phone);
    if (key === "contact.source") return stringifyFieldValue(data?.contact.opportunity_source ?? data?.contact.source);

    if (key.startsWith("profile.") || key.startsWith("custom.")) {
      const rawFieldName = key.includes(".") ? key.slice(key.indexOf(".") + 1).trim() : "";
      const fieldName = resolveProfileFieldName(rawFieldName);
      if (!fieldName) return "";
      return stringifyFieldValue(data?.profileFields[fieldName] ?? data?.contact[fieldName] ?? "");
    }

    return "";
  });
}

type ContactData = Record<string, string | number | boolean | null | undefined>;

async function loadWorkflowContactData(
  ghlContactId: string
): Promise<{ contact: ContactData; profileFields: Record<string, unknown> } | null> {
  const supabase = createServerClient();

  const { data: contact } = await supabase.from("contacts").select("*").eq("ghl_contact_id", ghlContactId).single();

  if (!contact) return null;

  const { data: rows } = await supabase
    .from("contact_profile_fields")
    .select("field_name, field_value")
    .eq("contact_id", contact.id);

  const profileFields: Record<string, unknown> = {};
  for (const row of rows ?? []) {
    profileFields[row.field_name] = parseFieldValue(row.field_value);
  }

  return { contact, profileFields };
}

function parseFieldValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function stringifyFieldValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function resolveProfileFieldName(rawFieldName: string): string | null {
  const normalized = rawFieldName.toLowerCase();
  for (const field of PROFILE_FIELDS) {
    if (field.name.toLowerCase() === normalized || field.label.toLowerCase() === normalized) {
      return field.name;
    }
  }
  return null;
}
