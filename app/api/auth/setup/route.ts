/**
 * GET /api/auth/setup — one-time setup: delete and recreate the auth user
 * TEMPORARY — remove after login works
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

  // Step 1: Find and delete existing auth user
  try {
    const { data } = await supabase.auth.admin.listUsers({ perPage: 100 });
    const existing = data?.users?.find((u) => u.email === "corey@newagainhouses.com");
    if (existing) {
      await supabase.auth.admin.deleteUser(existing.id);
      steps.push(`Deleted existing auth user ${existing.id}`);
    } else {
      steps.push("No existing auth user found");
    }
  } catch (err) {
    steps.push(`Delete step: ${err instanceof Error ? err.message : "error"}`);
  }

  // Step 2: Create fresh auth user
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: "corey@newagainhouses.com",
      password: "Gunner147",
      email_confirm: true,
    });
    if (error) {
      steps.push(`Create failed: ${error.message}`);
    } else {
      steps.push(`Created auth user: ${data.user?.id}`);
    }
  } catch (err) {
    steps.push(`Create step: ${err instanceof Error ? err.message : "error"}`);
  }

  // Step 3: Verify login works
  try {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anonKey) {
      const anonClient = createClient(supabaseUrl, anonKey);
      const { error } = await anonClient.auth.signInWithPassword({
        email: "corey@newagainhouses.com",
        password: "Gunner147",
      });
      steps.push(error ? `Login test FAILED: ${error.message}` : "Login test PASSED");
    }
  } catch (err) {
    steps.push(`Login test: ${err instanceof Error ? err.message : "error"}`);
  }

  return NextResponse.json({ steps });
}
