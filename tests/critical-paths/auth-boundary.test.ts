/**
 * Auth boundary tests — verifies requireAuth rejects unauthenticated
 * requests and accepts authenticated ones.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase before importing the module under test
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

// Mock cookie reader
vi.mock("@/lib/auth/cookies", () => ({
  getAccessTokenFromCookies: vi.fn(() => null),
}));

import { requireAuth, getAuthUser } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { getAccessTokenFromCookies } from "@/lib/auth/cookies";

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  })),
};

beforeEach(() => {
  vi.clearAllMocks();
  (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);
  (getAccessTokenFromCookies as ReturnType<typeof vi.fn>).mockReturnValue(null);
});

describe("getAuthUser", () => {
  it("returns null when no token", async () => {
    const result = await getAuthUser(null);
    expect(result).toBeNull();
  });

  it("returns null when token is invalid", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid token" },
    });
    const result = await getAuthUser("invalid-token");
    expect(result).toBeNull();
  });

  it("returns null when user not found in app database", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { email: "unknown@example.com" } },
      error: null,
    });
    const singleMock = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: singleMock,
          })),
        })),
      })),
    });
    const result = await getAuthUser("valid-token");
    expect(result).toBeNull();
  });

  it("returns AuthUser when token and user are valid", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { email: "chad@newagainhouses.com" } },
      error: null,
    });
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: "user-123",
        email: "chad@newagainhouses.com",
        full_name: "Chad Arnold",
        role: "operator",
        ghl_user_id: "ghl-abc",
      },
      error: null,
    });
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: singleMock,
          })),
        })),
      })),
    });
    const result = await getAuthUser("valid-token");
    expect(result).toEqual({
      id: "user-123",
      email: "chad@newagainhouses.com",
      fullName: "Chad Arnold",
      role: "operator",
      ghlUserId: "ghl-abc",
    });
  });
});

describe("requireAuth", () => {
  it("returns 401 Response when no token in cookies or header", async () => {
    const request = new Request("http://localhost/api/test");
    const result = await requireAuth(request);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it("returns 401 Response when token is invalid", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid" },
    });
    const request = new Request("http://localhost/api/test", {
      headers: { Authorization: "Bearer bad-token" },
    });
    const result = await requireAuth(request);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it("returns AuthUser when authenticated via Authorization header", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { email: "matt@newagainhouses.com" } },
      error: null,
    });
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: "admin-456",
        email: "matt@newagainhouses.com",
        full_name: "Matt Lavinder",
        role: "admin",
        ghl_user_id: "ghl-xyz",
      },
      error: null,
    });
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: singleMock,
          })),
        })),
      })),
    });
    const request = new Request("http://localhost/api/test", {
      headers: { Authorization: "Bearer valid-token" },
    });
    const result = await requireAuth(request);
    expect(result).not.toBeInstanceOf(Response);
    expect((result as { id: string }).id).toBe("admin-456");
    expect((result as { role: string }).role).toBe("admin");
  });

  it("returns AuthUser when authenticated via cookie", async () => {
    (getAccessTokenFromCookies as ReturnType<typeof vi.fn>).mockReturnValue("cookie-token");
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { email: "chad@newagainhouses.com" } },
      error: null,
    });
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: "user-789",
        email: "chad@newagainhouses.com",
        full_name: "Chad Arnold",
        role: "operator",
        ghl_user_id: "ghl-def",
      },
      error: null,
    });
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: singleMock,
          })),
        })),
      })),
    });
    const request = new Request("http://localhost/api/test");
    const result = await requireAuth(request);
    expect(result).not.toBeInstanceOf(Response);
    expect((result as { id: string }).id).toBe("user-789");
  });
});
