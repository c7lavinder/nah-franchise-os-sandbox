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
    expect(resolveSupabaseTable("frandev_contact", known)).toBe("contacts");
    expect(resolveSupabaseTable("frandev_territory", known)).toBe("territories");
    // -y -> -ies, and the explicit override for a Latin plural the pluralizer cannot reach.
    expect(resolveSupabaseTable("frandev_rubric_criterion", known)).toBe("rubric_criteria");
  });

  it("returns null rather than guessing when there is no Supabase source", () => {
    // Tables MasterSuite owns outright must resolve to nothing, not to a near-miss.
    expect(resolveSupabaseTable("frandev_native_write", known)).toBeNull();
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
