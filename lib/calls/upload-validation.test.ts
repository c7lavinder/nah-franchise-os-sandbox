import { describe, expect, it } from "vitest";
import { getUploadExtension, isRecordingExtension, resolveUploadKind } from "./upload-validation";

describe("call upload validation helpers", () => {
  it("normalizes upload extensions", () => {
    expect(getUploadExtension("Call Recording.MP3")).toBe("mp3");
  });

  it("detects transcript uploads by explicit type or txt extension", () => {
    expect(resolveUploadKind("transcript", "notes.pdf")).toBe("transcript");
    expect(resolveUploadKind(null, "notes.txt")).toBe("transcript");
  });

  it("detects supported recording uploads", () => {
    expect(resolveUploadKind("recording", "clip.bin")).toBe("recording");
    expect(resolveUploadKind(null, "clip.webm")).toBe("recording");
    expect(isRecordingExtension("WAV")).toBe(true);
  });

  it("rejects unsupported uploads", () => {
    expect(resolveUploadKind(null, "deck.pdf")).toBeNull();
  });
});
