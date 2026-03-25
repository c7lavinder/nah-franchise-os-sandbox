/**
 * POST /api/auth/reset-pw — admin password reset via service key
 * TEMPORARY — remove after first login works
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const { email, password } = await request.json() as { email: string; password: string };

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // List users to find the ID
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 50 });

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const user = listData?.users?.find((u) => u.email === email);

  if (!user) {
    // User doesn't exist in auth — create them
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) {
      return NextResponse.json({ error: createError.message, action: "create_failed" }, { status: 500 });
    }
    return NextResponse.json({ success: true, action: "created", userId: newUser?.user?.id });
  }

  // User exists — update password
  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { password });

  if (updateError) {
    return NextResponse.json({ error: updateError.message, action: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, action: "password_reset", userId: user.id });
}
