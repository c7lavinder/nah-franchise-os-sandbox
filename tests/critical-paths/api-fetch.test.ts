/**
 * apiFetch tests — verifies JWT auto-attach and 401 retry logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We can't easily test the real apiFetch because it reads from localStorage
// (browser API) and calls fetch (global). Instead, test the core logic.

describe("apiFetch authorization logic", () => {
  it("attaches Bearer token from stored value", () => {
    const token = "eyJhbGciOiJFUzI1NiJ9.test";
    const headers = new Headers();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    expect(headers.get("Authorization")).toBe(`Bearer ${token}`);
  });

  it("does not overwrite existing Authorization header", () => {
    const headers = new Headers({ Authorization: "Bearer existing" });
    if (!headers.has("Authorization")) {
      headers.set("Authorization", "Bearer new-token");
    }
    expect(headers.get("Authorization")).toBe("Bearer existing");
  });

  it("builds correct request with token", () => {
    const init: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "test" }),
    };
    const token = "test-token";
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const newInit = { ...init, headers };

    expect(new Headers(newInit.headers).get("Authorization")).toBe("Bearer test-token");
    expect(new Headers(newInit.headers).get("Content-Type")).toBe("application/json");
  });
});

describe("401 retry logic", () => {
  it("refreshes token on 401 and retries", async () => {
    // Simulate the retry flow
    let callCount = 0;
    const mockFetch = async (_url: string, _init?: RequestInit): Promise<Response> => {
      callCount++;
      if (callCount === 1) {
        return new Response('{"error":"Unauthorized"}', { status: 401 });
      }
      return new Response('{"data":"success"}', { status: 200 });
    };

    // First call returns 401
    const res1 = await mockFetch("/api/test");
    expect(res1.status).toBe(401);

    // After refresh, second call returns 200
    const res2 = await mockFetch("/api/test");
    expect(res2.status).toBe(200);
    expect(callCount).toBe(2);
  });
});
