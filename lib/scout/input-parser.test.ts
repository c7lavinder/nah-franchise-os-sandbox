import { describe, expect, it } from "vitest";
import { parseJsonField } from "./input-parser";

describe("Scout input parser", () => {
  it("parses JSON string fields", () => {
    expect(parseJsonField<{ a: number }>('{"a":1}', { a: 0 })).toEqual({ a: 1 });
  });

  it("returns non-string values as-is", () => {
    const value = [{ field: "name" }];
    expect(parseJsonField(value, [])).toBe(value);
  });

  it("falls back for empty or invalid JSON", () => {
    expect(parseJsonField(undefined, ["fallback"])).toEqual(["fallback"]);
    expect(parseJsonField("not json", ["fallback"])).toEqual(["fallback"]);
  });
});
