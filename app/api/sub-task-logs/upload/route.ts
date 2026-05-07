export const dynamic = "force-dynamic";

/**
 * POST /api/sub-task-logs/upload
 * Uploads a file (screenshot, PDF, doc) to Supabase Storage.
 * Returns the signed URL for use as content_file_url on a log.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

const BUCKET = "log-attachments";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (10 MB max)" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const storagePath = `${randomUUID()}.${ext}`;

  const supabase = createServerClient();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload — create bucket on first use
  let uploadError = (
    await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    })
  ).error;

  if (uploadError?.message?.includes("not found") || uploadError?.message?.includes("Bucket")) {
    await supabase.storage.createBucket(BUCKET, { public: false });
    uploadError = (
      await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      })
    ).error;
  }

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // 1-year signed URL
  const { data: urlData } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60 * 24 * 365);
  const url = urlData?.signedUrl ?? storagePath;

  return NextResponse.json({ url, filename: file.name, size: file.size, success: true });
}
