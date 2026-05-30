import { describe, expect, it } from "vitest";
import { formatTranscript } from "./classifier";

describe("formatTranscript", () => {
  it("keeps short unknown interjections as separate speaker turns", () => {
    const formatted = formatTranscript({
      speaker_blocks: [
        { speaker: { name: "Ray Heath" }, words: "This is the main point about the system." },
        { speaker: { name: "UNKNOWN_SPEAKER" }, words: "Yes." },
        { speaker: { name: "Ray Heath" }, words: "Then we continue with the explanation." },
      ],
    });

    expect(formatted).toBe(
      [
        "Ray Heath: This is the main point about the system.",
        "Unknown: Yes.",
        "Ray Heath: Then we continue with the explanation.",
      ].join("\n\n")
    );
  });
});
