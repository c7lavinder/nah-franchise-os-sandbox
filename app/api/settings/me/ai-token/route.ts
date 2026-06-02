export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAiApiTokenSecret, hashAiApiToken, tokenPrefix } from "@/lib/ai-api-tokens";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("ai_api_tokens")
    .select("id, user_id, token_prefix, scope, last_used_at, created_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token: data ?? null });
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const supabase = createServerClient();
  const secret = createAiApiTokenSecret();
  const prefix = tokenPrefix(secret);

  const { error: revokeError } = await supabase
    .from("ai_api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("revoked_at", null);

  if (revokeError) return NextResponse.json({ error: revokeError.message }, { status: 500 });

  const { data: token, error: insertError } = await supabase
    .from("ai_api_tokens")
    .insert({
      user_id: user.id,
      created_by_user_id: user.id,
      token_hash: hashAiApiToken(secret),
      token_prefix: prefix,
      scope: "AI_READ_ONLY",
    })
    .select("id, user_id, token_prefix, scope, last_used_at, created_at")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await supabase.from("ai_api_activity").insert({
    token_id: token.id,
    user_id: user.id,
    token_prefix: prefix,
    endpoint: "/api/settings/me/ai-token",
    resource: "token.rotated",
    method: "POST",
    status_code: 200,
    request_params: { rotatedBy: user.email },
  });

  return NextResponse.json({ token, secret });
}

export async function DELETE(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const supabase = createServerClient();
  const { data: activeTokens, error: findError } = await supabase
    .from("ai_api_tokens")
    .select("id, token_prefix")
    .eq("user_id", user.id)
    .is("revoked_at", null);

  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });

  const { error } = await supabase
    .from("ai_api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("revoked_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (activeTokens?.length) {
    await supabase.from("ai_api_activity").insert(
      activeTokens.map((token) => ({
        token_id: token.id,
        user_id: user.id,
        token_prefix: token.token_prefix,
        endpoint: "/api/settings/me/ai-token",
        resource: "token.revoked.self",
        method: "DELETE",
        status_code: 200,
        request_params: { revokedBy: user.email },
      }))
    );
  }

  return NextResponse.json({ success: true, revokedCount: activeTokens?.length ?? 0 });
}
