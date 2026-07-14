export const dynamic = "force-dynamic";

/**
 * POST /api/zoning/jurisdictions/[jurisdictionId]/documents — upload an
 *      ordinance/plan document (admin). Multipart form: file, doc_type,
 *      title?, source_url?, effective_date? Text is extracted on upload;
 *      district extraction is a separate explicit step (see
 *      /api/zoning/documents/[documentId]/extract).
 * GET  /api/zoning/jurisdictions/[jurisdictionId]/documents — list documents
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { extractText } from "@/lib/documents/extract";

const BUCKET = "zoning-documents";
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB — full ordinances run large

const DOC_TYPES = [
  "zoning_ordinance",
  "subdivision_regulations",
  "comprehensive_plan",
  "zoning_map",
  "fee_schedule",
  "other",
];

export async function POST(request: NextRequest, { params }: { params: Promise<{ jurisdictionId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const { jurisdictionId } = await params;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (50 MB max)" }, { status: 400 });

  const docTypeRaw = (formData.get("doc_type") as string) ?? "zoning_ordinance";
  const docType = DOC_TYPES.includes(docTypeRaw) ? docTypeRaw : "other";
  const title = ((formData.get("title") as string) || file.name).trim();
  const sourceUrl = ((formData.get("source_url") as string) || "").trim() || null;
  const effectiveDate = ((formData.get("effective_date") as string) || "").trim() || null;

  const supabase = createServerClient();

  const { data: jurisdiction } = await supabase
    .from("jurisdictions")
    .select("id, name")
    .eq("id", jurisdictionId)
    .maybeSingle();
  if (!jurisdiction) return NextResponse.json({ error: "Jurisdiction not found" }, { status: 404 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const storagePath = `${jurisdictionId}/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

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
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const extractedText = await extractText(buffer, ext);

  const { data: doc, error } = await supabase
    .from("zoning_documents")
    .insert({
      jurisdiction_id: jurisdictionId,
      doc_type: docType,
      title,
      source_url: sourceUrl,
      storage_path: storagePath,
      effective_date: effectiveDate,
      retrieved_at: new Date().toISOString(),
      extracted_text: extractedText,
    })
    .select("id, jurisdiction_id, doc_type, title, source_url, effective_date, retrieved_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    {
      document: doc,
      textExtracted: Boolean(extractedText),
      textLength: extractedText?.length ?? 0,
    },
    { status: 201 }
  );
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ jurisdictionId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  const { jurisdictionId } = await params;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("zoning_documents")
    .select("id, jurisdiction_id, doc_type, title, source_url, effective_date, retrieved_at, created_at")
    .eq("jurisdiction_id", jurisdictionId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] });
}
