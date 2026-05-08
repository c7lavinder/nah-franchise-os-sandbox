/**
 * Tests for Scout model router — verifies tier selection logic.
 */

import { describe, it, expect } from "vitest";
import { routeModel, SCOUT_MODELS } from "@/lib/scout/model-router";

function makeMessages(text: string, historyLength = 0) {
  const msgs: { role: "user" | "assistant"; content: string }[] = [];
  for (let i = 0; i < historyLength; i++) {
    msgs.push({ role: "user", content: "filler" });
    msgs.push({ role: "assistant", content: "response" });
  }
  msgs.push({ role: "user", content: text });
  return msgs;
}

describe("routeModel", () => {
  it("defaults to Haiku for simple questions", () => {
    const result = routeModel({
      messages: makeMessages("What stage is John in?"),
      userRole: "rep",
    });
    expect(result.tier).toBe("haiku");
    expect(result.model).toBe(SCOUT_MODELS.haiku);
  });

  it("escalates to Sonnet for analysis questions", () => {
    const result = routeModel({
      messages: makeMessages("Analyze my pipeline health"),
      userRole: "rep",
    });
    expect(result.tier).toBe("sonnet");
  });

  it("escalates to Opus for strategic planning", () => {
    const result = routeModel({
      messages: makeMessages("Design a marketing campaign for Q3"),
      userRole: "rep",
    });
    expect(result.tier).toBe("opus");
  });

  it("floors admin at Sonnet (never Haiku)", () => {
    const result = routeModel({
      messages: makeMessages("What stage is John in?"),
      userRole: "admin",
    });
    expect(result.tier).not.toBe("haiku");
    expect(result.model).toBe(SCOUT_MODELS.sonnet);
  });

  it("floors leadership at Sonnet", () => {
    const result = routeModel({
      messages: makeMessages("Who should I call today?"),
      userRole: "leadership",
    });
    expect(result.tier).not.toBe("haiku");
  });

  it("escalates long messages to Sonnet", () => {
    const longMsg = "a ".repeat(500); // 1000 chars
    const result = routeModel({
      messages: makeMessages(longMsg),
      userRole: "rep",
    });
    expect(result.tier).not.toBe("haiku");
  });

  it("escalates deep conversations to higher tier", () => {
    const result = routeModel({
      messages: makeMessages("next?", 20), // 20 prior turns = 40 messages
      userRole: "rep",
    });
    // >30 messages should hit at least Opus
    expect(["sonnet", "opus"]).toContain(result.tier);
  });

  it("returns a valid model ID", () => {
    const result = routeModel({
      messages: makeMessages("hello"),
      userRole: "rep",
    });
    expect(Object.values(SCOUT_MODELS)).toContain(result.model);
  });
});
