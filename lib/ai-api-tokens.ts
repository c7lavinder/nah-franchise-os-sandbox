import crypto from "crypto";
import type { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export interface AiApiTokenRecord {
  id: string;
  user_id: string;
  token_prefix: string;
  scope: "AI_READ_ONLY";
  user: {
    id: string;
    email: string;
    full_name: string;
    role: string;
  };
}

export function createAiApiTokenSecret(): string {
  return `fdai_${crypto.randomBytes(32).toString("base64url")}`;
}

export function hashAiApiToken(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export function tokenPrefix(secret: string): string {
  return secret.slice(0, 12);
}

export function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function validateAiApiToken(secret: string): Promise<AiApiTokenRecord | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("ai_api_tokens")
    .select("id, user_id, token_prefix, scope, user:users!ai_api_tokens_user_id_fkey(id, email, full_name, role)")
    .eq("token_hash", hashAiApiToken(secret))
    .is("revoked_at", null)
    .eq("scope", "AI_READ_ONLY")
    .maybeSingle();

  if (error || !data) return null;
  const user = Array.isArray((data as any).user) ? (data as any).user[0] : (data as any).user;
  if (!user) return null;
  return { ...(data as any), user } as AiApiTokenRecord;
}

export async function logAiApiActivity(args: {
  tokenId: string | null;
  userId: string | null;
  tokenPrefix: string | null;
  endpoint: string;
  resource: string;
  method?: string;
  statusCode?: number;
  requestParams?: Record<string, unknown>;
  userAgent?: string | null;
}) {
  const supabase = createServerClient();
  await supabase.from("ai_api_activity").insert({
    token_id: args.tokenId,
    user_id: args.userId,
    token_prefix: args.tokenPrefix,
    endpoint: args.endpoint,
    resource: args.resource,
    method: args.method ?? "GET",
    status_code: args.statusCode ?? 200,
    request_params: args.requestParams ?? {},
    user_agent: args.userAgent ?? null,
  });
}
