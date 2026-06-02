export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { createAiApiTokenSecret, hashAiApiToken, tokenPrefix } from "@/lib/ai-api-tokens";

export async function POST(request: NextRequest, { params }: { params: { userId: string } }) {
  const admin = await requireAuth(request);
  if (admin instanceof Response) return admin;
  if (admin.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = createServerClient();
  const { data: targetUser, error: userError } = await supabase
    .from("users")
    .select("id, email, full_name")
    .eq("id", params.userId)
    .maybeSingle();

  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const secret = createAiApiTokenSecret();
  const prefix = tokenPrefix(secret);

  const { error: revokeError } = await supabase
    .from("ai_api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", params.userId)
    .is("revoked_at", null);

  if (revokeError) return NextResponse.json({ error: revokeError.message }, { status: 500 });

  const { data: token, error: insertError } = await supabase
    .from("ai_api_tokens")
    .insert({
      user_id: params.userId,
      created_by_user_id: admin.id,
      token_hash: hashAiApiToken(secret),
      token_prefix: prefix,
      scope: "AI_READ_ONLY",
    })
    .select("id, user_id, token_prefix, scope, last_used_at, created_at")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await supabase.from("ai_api_activity").insert({
    token_id: token.id,
    user_id: params.userId,
    token_prefix: prefix,
    endpoint: "/api/settings/users/[userId]/ai-token",
    resource: "token.generated",
    method: "POST",
    status_code: 200,
    request_params: { generatedBy: admin.email, targetUser: targetUser.email },
  });

  return NextResponse.json({ token, secret });
}

export async function DELETE(request: NextRequest, { params }: { params: { userId: string } }) {
  const admin = await requireAuth(request);
  if (admin instanceof Response) return admin;
  if (admin.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = createServerClient();
  const { data: activeTokens, error: findError } = await supabase
    .from("ai_api_tokens")
    .select("id, token_prefix")
    .eq("user_id", params.userId)
    .is("revoked_at", null);

  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });

  const { error } = await supabase
    .from("ai_api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", params.userId)
    .is("revoked_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (activeTokens?.length) {
    await supabase.from("ai_api_activity").insert(
      activeTokens.map((token) => ({
        token_id: token.id,
        user_id: params.userId,
        token_prefix: token.token_prefix,
        endpoint: "/api/settings/users/[userId]/ai-token",
        resource: "token.revoked",
        method: "DELETE",
        status_code: 200,
        request_params: { revokedBy: admin.email },
      }))
    );
  }

  return NextResponse.json({ success: true, revokedCount: activeTokens?.length ?? 0 });
}
