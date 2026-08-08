import { describe, expect, it } from "vitest";
import { calculateScore } from "@/lib/intelligence/scoring";
import { generateFlags } from "@/lib/intelligence/flags";
import type { CandidateIntelligence } from "@/lib/intelligence/types";

/**
 * The candidate scoring engine, pinned on the two faults that made the nightly refresh
 * pointless — both found on 2026-08-08 by running the calculators over real production rows.
 *
 * 1. **`scoreMomentum` threw on every candidate that had a flag.** `active_flags` holds
 *    OBJECTS (`{ text, severity, category, createdAt }`), and the function cast the column
 *    to `string[]` and called `.toLowerCase()` on each entry. **470 of 500 sampled
 *    production rows are object-shaped**, so it threw for ~94% of the book. Every caller
 *    wraps the update in try/catch, so nothing surfaced — scores just quietly stopped
 *    moving for anyone with a flag.
 *
 * 2. **One flag baked a live day counter into its stored text.** That made the flag set
 *    compare as "changed" for every candidate every night, so a no-op-skipping refresh
 *    would still have rewritten the entire table daily for a moving digit — and, because
 *    the refresh had never actually run, the number on every production row was frozen at
 *    its 2026-03-27 value and four months wrong.
 */

/** A profile with only the fields these two functions read. */
function profile(over: Partial<CandidateIntelligence> = {}): CandidateIntelligence {
  return {
    contact_id: "c1",
    created_at: new Date(Date.now() - 60 * 864e5).toISOString(),
    updated_at: new Date().toISOString(),
    active_flags: null,
    trainual_completion_pct: 0,
    trainual_last_activity: null,
    current_score: 0,
    score_financial: 0,
    score_operational: 0,
    score_engagement: 0,
    score_momentum: 0,
    ...over,
  } as unknown as CandidateIntelligence;
}

/** The real stored shape, as written by generateFlags + updateCandidateFlags. */
const flag = (text: string, severity = "warning", category = "process") => ({
  text,
  severity,
  category,
  createdAt: "2026-03-27T05:54:36.567Z",
});

describe("calculateScore — active_flags is an array of objects, not strings", () => {
  it("does not throw when flags are stored in their real object shape", () => {
    const p = profile({
      active_flags: [
        flag("PFS not received — cannot verify financial readiness"),
        flag("Spouse support status unknown — Chad should ask on next call", "info"),
      ] as unknown as CandidateIntelligence["active_flags"],
    });

    expect(
      () => calculateScore(p),
      "calculateScore threw on object-shaped active_flags. That is the real stored shape for " +
        "470 of 500 production rows, and because every caller catches, the failure is silent — " +
        "scores simply stop updating."
    ).not.toThrow();
  });

  it("still reads a stall flag out of the object shape", () => {
    const clean = calculateScore(profile({ active_flags: [] as never }));
    const stalled = calculateScore(
      profile({
        active_flags: [flag("Lead has stalled in Discovery for 14 days")] as never,
      })
    );

    expect(
      stalled.momentum,
      "A stall flag did not reduce momentum. If the text is not being read out of the object, " +
        "the filter silently matches nothing and every candidate scores as 'progressing on pace'."
    ).toBeLessThan(clean.momentum);
  });

  it("treats several stall flags as worse than one", () => {
    const one = calculateScore(profile({ active_flags: [flag("stalled in stage")] as never }));
    const many = calculateScore(
      profile({ active_flags: [flag("stalled in stage"), flag("stale — no touch in 30 days")] as never })
    );
    expect(many.momentum).toBeLessThanOrEqual(one.momentum);
  });

  it("accepts the older plain-string shape too, in case any row still holds it", () => {
    expect(() => calculateScore(profile({ active_flags: ["Lead has stalled"] as never }))).not.toThrow();
  });

  it("survives junk in the column rather than taking the nightly job down with it", () => {
    for (const junk of [null, undefined, "not an array", 42, [null], [{}]]) {
      expect(
        () => calculateScore(profile({ active_flags: junk as never })),
        `junk: ${JSON.stringify(junk)}`
      ).not.toThrow();
    }
  });
});

describe("generateFlags — stable text, so a nightly refresh has something to compare", () => {
  it("does not put a live day counter in the PTO flag", () => {
    const p = profile({ created_at: new Date(Date.now() - 47 * 864e5).toISOString() });
    const pto = generateFlags(p).find((f) => f.text.includes("PTO not started"));

    expect(pto, "The PTO-not-started flag should still fire 47 days after creation.").toBeDefined();
    expect(
      pto!.text,
      "The flag text embeds a day count again. A stored counter is only true on the day it is " +
        "written, and it makes every candidate compare as changed every night — which is the " +
        "write storm the bounded refresh exists to avoid."
    ).not.toMatch(/\d+\s*days since created/);
  });

  it("produces identical text for the same profile at different ages", () => {
    const at10 = generateFlags(profile({ created_at: new Date(Date.now() - 10 * 864e5).toISOString() }));
    const at400 = generateFlags(profile({ created_at: new Date(Date.now() - 400 * 864e5).toISOString() }));

    const texts = (fs: { text: string }[]) => fs.map((f) => f.text).sort();
    expect(
      texts(at10),
      "The flag TEXT changed purely because time passed. Only createdAt may differ between runs; " +
        "anything else forces a rewrite of the whole book every night."
    ).toEqual(texts(at400));
  });

  it("still withholds the PTO flag before the 5-day threshold", () => {
    const fresh = generateFlags(profile({ created_at: new Date(Date.now() - 2 * 864e5).toISOString() }));
    expect(fresh.find((f) => f.text.includes("PTO not started"))).toBeUndefined();
  });
});
