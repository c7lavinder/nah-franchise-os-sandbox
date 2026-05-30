import { describe, expect, it } from "vitest";
import { applySelectedUploadContact, buildNewCallParticipants } from "./upload-mapping";
import type { ResolveResult } from "./resolve-participants";

function baseMatch(overrides: Partial<ResolveResult> = {}): ResolveResult {
  return {
    contact_id: null,
    TerritorySlug: null,
    journey_id: null,
    journey_pipeline_state_id: null,
    confidence: 0,
    reason: "no signals matched",
    participants: [],
    ...overrides,
  };
}

describe("applySelectedUploadContact", () => {
  it("uses manually selected prospect when transcript matching found no contact", () => {
    const match = applySelectedUploadContact(
      baseMatch(),
      "contact-1",
      {
        id: "contact-1",
        ghl_contact_id: "ghl-1",
        first_name: "Chintan",
        last_name: "Patel",
        email: "chintan@example.com",
      },
      {
        journey_id: "journey-1",
        journey_pipeline_state_id: "jps-1",
        TerritorySlug: null,
      }
    );

    expect(match.contact_id).toBe("contact-1");
    expect(match.journey_id).toBe("journey-1");
    expect(match.journey_pipeline_state_id).toBe("jps-1");
    expect(match.confidence).toBe(1);
    expect(match.reason).toBe("manually selected by uploader");
    expect(match.participants).toMatchObject([
      {
        contact_id: "contact-1",
        role: "prospect",
        display_name: "Chintan Patel",
        email: "chintan@example.com",
        journey_pipeline_state_id: "jps-1",
      },
    ]);
  });

  it("overrides an existing resolver contact match when uploader selected a prospect", () => {
    const match = applySelectedUploadContact(
      baseMatch({ contact_id: "resolved-contact", confidence: 0.9, reason: "matched contact by phone" }),
      "selected-contact",
      null,
      null
    );

    expect(match.contact_id).toBe("selected-contact");
    expect(match.confidence).toBe(1);
    expect(match.reason).toBe("manually selected by uploader");
  });
});

describe("buildNewCallParticipants", () => {
  it("dedupes by contact id before display name", () => {
    const rows = buildNewCallParticipants(
      "call-1",
      baseMatch({
        participants: [
          {
            contact_id: "contact-1",
            user_id: null,
            role: "prospect",
            display_name: "Chintan Patel",
            email: "c@example.com",
            phone: null,
            contact_ghl_id: "ghl-1",
            TerritorySlug: null,
            journey_id: "journey-1",
            journey_pipeline_state_id: "jps-1",
            match_method: "name",
          },
          {
            contact_id: "contact-1",
            user_id: null,
            role: "prospect",
            display_name: "C. Patel",
            email: "c@example.com",
            phone: null,
            contact_ghl_id: "ghl-1",
            TerritorySlug: null,
            journey_id: "journey-1",
            journey_pipeline_state_id: "jps-1",
            match_method: "name",
          },
        ],
      }),
      []
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ call_id: "call-1", contact_id: "contact-1" });
  });

  it("skips existing participants by contact id", () => {
    const rows = buildNewCallParticipants(
      "call-1",
      baseMatch({
        participants: [
          {
            contact_id: "contact-1",
            user_id: null,
            role: "prospect",
            display_name: "Chintan Patel",
            email: null,
            phone: null,
            contact_ghl_id: null,
            TerritorySlug: null,
            journey_id: null,
            journey_pipeline_state_id: null,
            match_method: "name",
          },
        ],
      }),
      [{ contact_id: "contact-1", user_id: null, display_name: "Older Name" }]
    );

    expect(rows).toEqual([]);
  });
});
