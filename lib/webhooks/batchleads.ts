export type BatchLeadsPayload = Record<string, unknown>;

export type NormalizedLeadIntake = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  source: string;
  subSource?: string;
  territoryInterest?: string;
  customFields: Record<string, string>;
};

export function normalizeBatchLeadsPayload(payload: BatchLeadsPayload): NormalizedLeadIntake {
  const firstName =
    pickString(payload, ["firstName", "first_name", "firstname", "FirstName", "First Name"]) ??
    splitName(payload).firstName;
  const lastName =
    pickString(payload, ["lastName", "last_name", "lastname", "LastName", "Last Name"]) ?? splitName(payload).lastName;

  return {
    firstName: firstName || "Unknown",
    lastName: lastName || "Lead",
    email: pickString(payload, ["email", "Email", "email_address", "Email Address"]),
    phone: normalizePhone(
      pickString(payload, ["phone", "Phone", "phone_number", "Phone Number", "mobile", "Mobile", "cell", "Cell"])
    ),
    city: pickString(payload, ["city", "City", "property_city", "Property City"]),
    state: pickString(payload, ["state", "State", "property_state", "Property State"]),
    source: "BatchLeads",
    subSource:
      pickString(payload, ["campaign", "Campaign", "list_name", "List Name", "source", "Source"]) ?? "Push to CRM",
    territoryInterest: pickString(payload, ["territoryInterest", "territory_interest", "market", "Market"]),
    customFields: collectCustomFields(payload),
  };
}

function pickString(payload: BatchLeadsPayload, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function splitName(payload: BatchLeadsPayload): { firstName: string; lastName: string } {
  const fullName = pickString(payload, ["name", "Name", "fullName", "full_name", "Full Name", "contact_name"]);
  if (!fullName) return { firstName: "", lastName: "" };

  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function normalizePhone(phone: string | undefined): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  return digits || phone;
}

function collectCustomFields(payload: BatchLeadsPayload): Record<string, string> {
  const customFields: Record<string, string> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value == null) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      customFields[key] = String(value);
    }
  }

  return customFields;
}
