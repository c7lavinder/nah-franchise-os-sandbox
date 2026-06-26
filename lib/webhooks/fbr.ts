import type { NormalizedLeadIntake } from "@/lib/webhooks/batchleads";

export type FbrPayload = Record<string, unknown>;

/**
 * Normalize a Franchise Business Review (FBR) lead payload into the canonical
 * /api/leads/intake shape. FBR field names vary by export/integration setup,
 * so we accept common aliases — mirrors the BatchLeads adapter.
 */
export function normalizeFbrPayload(payload: FbrPayload): NormalizedLeadIntake {
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
    city: pickString(payload, ["city", "City"]),
    state: pickString(payload, ["state", "State"]),
    source: "Franchise Business Review",
    subSource:
      pickString(payload, ["subSource", "sub_source", "referral_source", "Referral Source", "source", "Source"]) ??
      "FBR Lead",
    territoryInterest: pickString(payload, [
      "territoryInterest",
      "territory_interest",
      "market",
      "Market",
      "market_interest",
      "Market Interest",
    ]),
    customFields: collectCustomFields(payload),
  };
}

function pickString(payload: FbrPayload, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function splitName(payload: FbrPayload): { firstName: string; lastName: string } {
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

function collectCustomFields(payload: FbrPayload): Record<string, string> {
  const customFields: Record<string, string> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value == null) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      customFields[key] = String(value);
    }
  }

  return customFields;
}
