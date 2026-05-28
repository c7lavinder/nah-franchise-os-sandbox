import { describe, expect, it } from "vitest";
import { contactIdFilter } from "./contact-utils";

describe("Scout contact utilities", () => {
  it("does not compare non-UUID GHL ids against the UUID id column", () => {
    expect(contactIdFilter("abc123")).toBe("ghl_contact_id.eq.abc123");
  });

  it("matches UUID ids against both GHL contact id and Supabase id", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    expect(contactIdFilter(id)).toBe(`ghl_contact_id.eq.${id},id.eq.${id}`);
  });
});
