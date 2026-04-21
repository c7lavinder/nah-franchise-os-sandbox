import { describe, it, expect } from "vitest";
import { classifyCallType, type ClassifyInput } from "./classify-type";

function base(overrides: Partial<ClassifyInput> = {}): ClassifyInput {
  return {
    title: null,
    nah_emails: [],
    is_internal: false,
    has_external_participant: true,
    has_territory_owner: false,
    source: "read_ai",
    ...overrides,
  };
}

describe("classifyCallType", () => {
  it("returns team_call for an internal meeting with no external participants", () => {
    const r = classifyCallType(
      base({ is_internal: true, has_external_participant: false, nah_emails: ["matt@newagainhouses.com"] }),
    );
    expect(r.slug).toBe("team_call");
  });

  it("returns coaching_call when a territory owner is on the call", () => {
    const r = classifyCallType(
      base({ has_territory_owner: true, nah_emails: ["matt@newagainhouses.com"] }),
    );
    expect(r.slug).toBe("coaching_call");
  });

  it("coaching beats matt when both signals present (order check)", () => {
    const r = classifyCallType(
      base({
        has_territory_owner: true,
        nah_emails: ["matt@newagainhouses.com"],
        title: "Coaching sync",
      }),
    );
    expect(r.slug).toBe("coaching_call");
  });

  it("team_call beats matt_call when internal with no externals", () => {
    const r = classifyCallType(
      base({
        is_internal: true,
        has_external_participant: false,
        nah_emails: ["matt@newagainhouses.com"],
      }),
    );
    expect(r.slug).toBe("team_call");
  });

  it("returns matt_final_call when matt is on call and title has 'final'", () => {
    const r = classifyCallType(
      base({ nah_emails: ["matt@newagainhouses.com"], title: "Final Call with Prospect" }),
    );
    expect(r.slug).toBe("matt_final_call");
  });

  it("returns matt_final_call when title mentions 'award'", () => {
    const r = classifyCallType(
      base({ nah_emails: ["matt@newagainhouses.com"], title: "Award Discussion" }),
    );
    expect(r.slug).toBe("matt_final_call");
  });

  it("returns matt_call for matt host without final/award in title", () => {
    const r = classifyCallType(
      base({ nah_emails: ["matt@newagainhouses.com"], title: "Discovery Call" }),
    );
    expect(r.slug).toBe("matt_call");
  });

  it("returns sam_call for sam host", () => {
    const r = classifyCallType(base({ nah_emails: ["sam@newagainhouses.com"] }));
    expect(r.slug).toBe("sam_call");
  });

  it("returns mark_call for mark host via mark email", () => {
    const r = classifyCallType(base({ nah_emails: ["mark@newagainhouses.com"] }));
    expect(r.slug).toBe("mark_call");
  });

  it("returns mark_call for altacapital domain even without 'mark' in local part", () => {
    const r = classifyCallType(base({ nah_emails: ["lender@altacapitalmanagement.com"] }));
    expect(r.slug).toBe("mark_call");
  });

  it("returns intro_call for chad host", () => {
    const r = classifyCallType(base({ nah_emails: ["chad@newagainhouses.com"] }));
    expect(r.slug).toBe("intro_call");
  });

  it("returns intro_call for nora host", () => {
    const r = classifyCallType(base({ nah_emails: ["nora-frandev@newagainhouses.com"] }));
    expect(r.slug).toBe("intro_call");
  });

  it("uses ghl_calendar title regex as fallback when no email match", () => {
    const r = classifyCallType(
      base({ nah_emails: [], title: "Intro Call — John Doe", source: "ghl_calendar" }),
    );
    expect(r.slug).toBe("intro_call");
    expect(r.reason).toMatch(/title regex/);
  });

  it("ghl_calendar title regex picks matt_final when title has both keywords", () => {
    const r = classifyCallType(
      base({ nah_emails: [], title: "Matt Final Review", source: "ghl_calendar" }),
    );
    expect(r.slug).toBe("matt_final_call");
  });

  it("returns unclassified when no signals match", () => {
    const r = classifyCallType(base({ nah_emails: [], title: "Weekly check-in", source: "read_ai" }));
    expect(r.slug).toBe("unclassified");
    expect(r.reason).toMatch(/no signals matched/);
  });

  it("returns unclassified for ghl_calendar source when title has no keyword", () => {
    const r = classifyCallType(
      base({ nah_emails: [], title: "Something random", source: "ghl_calendar" }),
    );
    expect(r.slug).toBe("unclassified");
  });

  it("reason string is populated for every match", () => {
    const cases: ClassifyInput[] = [
      base({ is_internal: true, has_external_participant: false }),
      base({ has_territory_owner: true }),
      base({ nah_emails: ["matt@x.com"], title: "final" }),
      base({ nah_emails: ["sam@x.com"] }),
    ];
    for (const c of cases) {
      const r = classifyCallType(c);
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });
});
