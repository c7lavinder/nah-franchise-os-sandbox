export const dynamic = "force-dynamic";

/**
 * GET /api/auth/create-user — one-time endpoint to create demo admin user
 * TEMPORARY — remove after user is created
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const steps: string[] = [];

  // Step 1: Create auth user
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: "admin@newagainhouses.com",
      password: "Demo123",
      email_confirm: true,
    });
    if (error) {
      if (error.message.includes("already been registered")) {
        steps.push("Auth user already exists — resetting password");
        // Find and update
        const { data: users } = await supabase.auth.admin.listUsers({ perPage: 100 });
        const existing = users?.users?.find((u) => u.email === "admin@newagainhouses.com");
        if (existing) {
          const { error: updateErr } = await supabase.auth.admin.updateUserById(existing.id, { password: "Demo123" });
          steps.push(updateErr ? `Password reset failed: ${updateErr.message}` : "Password reset OK");
        }
      } else {
        steps.push(`Auth create failed: ${error.message}`);
      }
    } else {
      steps.push(`Auth user created: ${data.user?.id}`);
    }
  } catch (err) {
    steps.push(`Auth error: ${err instanceof Error ? err.message : "unknown"}`);
  }

  // Step 2: Create app user row
  try {
    const { error } = await supabase
      .from("users")
      .upsert(
        {
          email: "admin@newagainhouses.com",
          full_name: "Demo Admin",
          role: "leadership",
          is_active: true,
        },
        { onConflict: "email" }
      );
    steps.push(error ? `App user failed: ${error.message}` : "App user created/updated");
  } catch (err) {
    steps.push(`App user error: ${err instanceof Error ? err.message : "unknown"}`);
  }

  // Step 3: Also reset Corey's password while we're at it
  try {
    const { data: users } = await supabase.auth.admin.listUsers({ perPage: 100 });
    const corey = users?.users?.find((u) => u.email === "corey@newagainhouses.com");
    if (corey) {
      const { error } = await supabase.auth.admin.updateUserById(corey.id, { password: "Gunner147" });
      steps.push(error ? `Corey password reset failed: ${error.message}` : "Corey password reset OK");
    } else {
      steps.push("Corey auth user not found");
    }
  } catch (err) {
    steps.push(`Corey reset error: ${err instanceof Error ? err.message : "unknown"}`);
  }

  return NextResponse.json({ steps });
}
