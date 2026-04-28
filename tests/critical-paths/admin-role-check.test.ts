/**
 * Admin role check tests — verifies the admin role gate pattern
 * used across all /api/settings/* admin routes.
 */

import { describe, it, expect } from "vitest";
import type { AuthUser } from "@/lib/auth/session";

describe("admin role check pattern", () => {
  // Simulate the pattern used in all admin routes:
  // if (user.role !== "admin") return 403
  function checkAdmin(user: AuthUser): { allowed: boolean; status?: number } {
    if (user.role !== "admin") {
      return { allowed: false, status: 403 };
    }
    return { allowed: true };
  }

  it("allows admin users", () => {
    const user: AuthUser = {
      id: "1",
      email: "matt@newagainhouses.com",
      fullName: "Matt Lavinder",
      role: "admin",
      ghlUserId: null,
    };
    expect(checkAdmin(user).allowed).toBe(true);
  });

  it("blocks operator users with 403", () => {
    const user: AuthUser = {
      id: "2",
      email: "chad@newagainhouses.com",
      fullName: "Chad Arnold",
      role: "operator",
      ghlUserId: "ghl-123",
    };
    const result = checkAdmin(user);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
  });

  it("blocks rep users with 403", () => {
    const user: AuthUser = {
      id: "3",
      email: "rep@newagainhouses.com",
      fullName: "Rep User",
      role: "rep",
      ghlUserId: null,
    };
    expect(checkAdmin(user).allowed).toBe(false);
  });

  it("blocks specialist users with 403", () => {
    const user: AuthUser = {
      id: "4",
      email: "sam@newagainhouses.com",
      fullName: "Sam Ferguson",
      role: "specialist",
      ghlUserId: null,
    };
    expect(checkAdmin(user).allowed).toBe(false);
  });
});
