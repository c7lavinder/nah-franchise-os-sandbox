import { describe, expect, it } from "vitest";
import { normalizeBatchLeadsPayload } from "@/lib/webhooks/batchleads";

describe("BatchLeads webhook normalizer", () => {
  it("normalizes common BatchLeads-style fields into lead intake shape", () => {
    const normalized = normalizeBatchLeadsPayload({
      first_name: "Corey",
      last_name: "Lavinder",
      phone_number: "(865) 421-5344",
      email_address: "corey@example.com",
      property_city: "Knoxville",
      property_state: "TN",
      campaign: "Absentee Owners",
    });

    expect(normalized).toMatchObject({
      firstName: "Corey",
      lastName: "Lavinder",
      phone: "8654215344",
      email: "corey@example.com",
      city: "Knoxville",
      state: "TN",
      source: "BatchLeads",
      subSource: "Absentee Owners",
    });
  });

  it("falls back to full name and keeps primitive payload values as custom fields", () => {
    const normalized = normalizeBatchLeadsPayload({
      name: "Jane Prospect",
      Phone: "555-111-2222",
      "List Name": "Vacant Properties",
      motivation_score: 87,
    });

    expect(normalized).toMatchObject({
      firstName: "Jane",
      lastName: "Prospect",
      phone: "5551112222",
      source: "BatchLeads",
      subSource: "Vacant Properties",
    });
    expect(normalized.customFields).toMatchObject({
      name: "Jane Prospect",
      motivation_score: "87",
    });
  });
});
