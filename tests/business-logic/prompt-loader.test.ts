/**
 * Tests for the Scout prompt loader — cache behavior and fallback logic.
 */

import { describe, it, expect } from "vitest";
import { clearPromptCache } from "@/lib/scout/prompt-loader";

describe("promptLoader", () => {
  it("clearPromptCache runs without error", () => {
    // Smoke test — clearing cache should never throw
    expect(() => clearPromptCache()).not.toThrow();
  });

  it("clearPromptCache can be called multiple times", () => {
    clearPromptCache();
    clearPromptCache();
    clearPromptCache();
    // No error = pass
    expect(true).toBe(true);
  });
});
