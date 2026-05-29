/**
 * Tests for the Scout prompt loader — cache behavior and fallback logic.
 */

import { describe, it, expect } from "vitest";
import {
  clearPromptCache,
  createPromptBlockMetadata,
  createPromptVersion,
  loadPromptSectionWithMetadata,
} from "@/lib/scout/prompt-loader";

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

  it("returns code-only metadata for scout_rules without touching the DB", async () => {
    const loaded = await loadPromptSectionWithMetadata("scout_rules", "ABSOLUTE RULES");

    expect(loaded.value).toBe("ABSOLUTE RULES");
    expect(loaded.metadata.key).toBe("scout_rules");
    expect(loaded.metadata.source).toBe("code");
    expect(loaded.metadata.version).toMatch(/^code:/);
    expect(loaded.metadata.charCount).toBe("ABSOLUTE RULES".length);
  });

  it("creates stable composite prompt versions from block metadata", () => {
    const blocks = [
      createPromptBlockMetadata("identity", "Scout", "code"),
      createPromptBlockMetadata("rules", "Draft only", "code"),
    ];

    expect(createPromptVersion(blocks)).toBe(createPromptVersion(blocks));
  });
});
