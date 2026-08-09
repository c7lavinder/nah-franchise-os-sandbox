import { describe, it, expect } from "vitest";
import { resolveSupabaseTable, pascalToSnake, SUPABASE_TABLES } from "@/lib/mastersuite/push-frandev";

/**
 * The outbound push is convention-driven: it lists the `frandev_*` tables on the MasterSuite
 * side and finds each one's Supabase source by NAME. Nothing declares the pairing, so a table
 * whose name does not pluralize the way the resolver expects is silently reported as
 * `no_supabase_source` and simply never syncs — a table that looks present on both sides and
 * is permanently empty on one of them.
 *
 * These pin the two conventions a new mirror table depends on. They are cheap because the
 * resolver is pure; the engine around it needs a live schema and is not covered here.
 */
describe("push-frandev table name resolution", () => {
  const known = new Set(SUPABASE_TABLES);

  it("resolves frandev_note to the notes table", () => {
    // The reason `notes` is in SUPABASE_TABLES at all. Without the entry this returns null
    // and the notes mirror never receives a row.
    expect(resolveSupabaseTable("frandev_note", known)).toBe("notes");
  });

  it("lists notes in SUPABASE_TABLES", () => {
    expect(known.has("notes")).toBe(true);
  });

  it("still resolves the shapes the existing mirror relies on", () => {
    // Regression cover for the resolver itself: a change to the pluralizer that fixed one
    // table by breaking these would otherwise show up only as empty tables in production.
    expect(resolveSupabaseTable("frandev_journey", known)).toBe("journeys");
    expect(resolveSupabaseTable("frandev_note", known)).toBe("notes");
    expect(resolveSupabaseTable("frandev_territory", known)).toBe("territories");
  });

  it("returns null rather than guessing when there is no Supabase source", () => {
    // Tables MasterSuite owns outright must resolve to nothing, not to a near-miss.
    expect(resolveSupabaseTable("frandev_native_write", known)).toBeNull();
  });

  it("no longer feeds the calls domain (domain-4 cutover, 2026-08-09)", () => {
    // MasterSuite writes these natively now. If any of them reappears in
    // SUPABASE_TABLES, the nightly push resumes upserting Supabase's frozen
    // copies over live native rows — the exact clobber the cutover removed.
    for (const retired of [
      "calls",
      "call_grades",
      "call_transcripts",
      "call_types",
      "rubrics",
      "rubric_criteria",
      "read_ai_sessions",
      "transcript_jobs",
      "knowledge_documents",
    ]) {
      expect(known.has(retired)).toBe(false);
    }
    expect(resolveSupabaseTable("frandev_call", known)).toBeNull();
    expect(resolveSupabaseTable("frandev_rubric_criterion", known)).toBeNull();
  });

  it("no longer feeds the mirror-only domain-5 tables (domain-5 cutover, 2026-08-09)", () => {
    // These tables' native writers do NOT journal (runway derivation, the four
    // agents, research profile fields) — a re-added entry means the nightly
    // push clobbers live native rows with Supabase's trailing copies.
    for (const retired of [
      "contacts",
      "journey_pipeline_state",
      "contact_profile_fields",
      "contact_journals",
      "contact_scores",
      "notifications",
      "candidate_intelligence",
      "candidate_score_history",
      "data_update_suggestions",
      "eos_contact_goals",
    ]) {
      expect(known.has(retired)).toBe(false);
    }
    expect(resolveSupabaseTable("frandev_contact", known)).toBeNull();
    expect(resolveSupabaseTable("frandev_journey_pipeline_state", known)).toBeNull();
    // The dual-write-consistent family stays until the sandbox write surfaces retire.
    expect(resolveSupabaseTable("frandev_journey", known)).toBe("journeys");
    expect(resolveSupabaseTable("frandev_task", known)).toBe("tasks");
  });

  it("maps the notes columns MasterSuite spells in PascalCase", () => {
    // The mapper tries an exact match first and falls back to this. AuthorEmail is the one
    // that has to travel; TerritorySlug matches exactly on both sides and never reaches here.
    expect(pascalToSnake("AuthorEmail")).toBe("author_email");
    expect(pascalToSnake("JourneyId")).toBe("journey_id");
    expect(pascalToSnake("DeletedAt")).toBe("deleted_at");
    expect(pascalToSnake("Body")).toBe("body");
  });
});
