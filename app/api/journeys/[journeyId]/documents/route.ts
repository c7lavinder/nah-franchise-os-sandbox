export const dynamic = "force-dynamic";

/**
 * POST /api/journeys/[journeyId]/documents — Upload a document (PFS, Zorakle, franchise agreement, etc.)
 * GET  /api/journeys/[journeyId]/documents — List all documents for a journey
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { extractText, extractFieldsWithAI } from "@/lib/documents/extract";
import { embedExternalResearch } from "@/lib/rag/embedder";

const BUCKET = "journey-documents";
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

const DOC_TYPE_LABELS: Record<string, string> = {
  pfs: "Personal Financial Statement",
  zorakle: "Zorakle Personality Profile",
  franchise_agreement: "Franchise Agreement",
  other: "Document",
};

/** Map doc_type to the profile fields we try to extract */
const EXTRACTION_FIELDS: Record<string, { field: string; label: string }[]> = {
  pfs: [
    { field: "net_worth_estimated", label: "Estimated Net Worth" },
    { field: "liquid_capital_available", label: "Liquid Capital" },
    { field: "total_investable_assets", label: "Total Investable Assets" },
    { field: "annual_household_income", label: "Annual Household Income" },
    { field: "real_estate_holdings", label: "Real Estate Holdings" },
    { field: "retirement_accounts", label: "Retirement Accounts" },
    { field: "monthly_fixed_expenses", label: "Monthly Fixed Expenses" },
    { field: "credit_score_range", label: "Credit Score Range" },
  ],
  zorakle: [
    { field: "zorakle_fit_score", label: "Zorakle Fit Score" },
    { field: "zorakle_values_type", label: "Values Type" },
    { field: "zorakle_work_style", label: "Work Style" },
    { field: "disc_type", label: "DISC Type" },
    { field: "d_score", label: "D Score" },
    { field: "i_score", label: "I Score" },
    { field: "s_score", label: "S Score" },
    { field: "c_score", label: "C Score" },
    { field: "risk_tolerance", label: "Risk Tolerance" },
    { field: "decision_making_style", label: "Decision Making Style" },
  ],
  franchise_agreement: [{ field: "llc_name", label: "LLC Name" }],
  other: [],
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ journeyId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  const { journeyId } = await params;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const docType = (formData.get("doc_type") as string) ?? "other";
  const contactId = formData.get("contact_id") as string | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (20 MB max)" }, { status: 400 });

  const validTypes = ["pfs", "zorakle", "franchise_agreement", "other"];
  const safeType = validTypes.includes(docType) ? docType : "other";

  const supabase = createServerClient();

  // Verify journey exists
  const { data: journey } = await supabase
    .from("journeys")
    .select("id, primary_contact_id")
    .eq("id", journeyId)
    .maybeSingle();
  if (!journey) return NextResponse.json({ error: "Journey not found" }, { status: 404 });

  // Upload to storage
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const storagePath = `${journeyId}/${randomUUID()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

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

  // Signed URL (1 year)
  const { data: urlData } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60 * 24 * 365);
  const fileUrl = urlData?.signedUrl ?? storagePath;

  // Extract text from all supported file types (PDF, XLSX, DOCX, TXT, CSV)
  const extractedText = await extractText(buffer, ext);

  // Determine which profile fields this doc type maps to
  const extractionFields = EXTRACTION_FIELDS[safeType] ?? [];

  // Use AI to extract field values from the document text
  let suggestedFields: Record<string, string | null> | null = null;
  if (extractedText && extractionFields.length > 0) {
    const docTypeLabel = DOC_TYPE_LABELS[safeType] ?? "document";
    const aiFields = await extractFieldsWithAI(extractedText, docTypeLabel, extractionFields);
    if (Object.keys(aiFields).length > 0) {
      suggestedFields = {};
      for (const f of extractionFields) {
        suggestedFields[f.field] = aiFields[f.field] ?? null;
      }
    } else {
      suggestedFields = Object.fromEntries(extractionFields.map((f) => [f.field, null]));
    }
  } else if (extractionFields.length > 0) {
    suggestedFields = Object.fromEntries(extractionFields.map((f) => [f.field, null]));
  }

  const displayName = DOC_TYPE_LABELS[safeType] ?? file.name;
  const resolvedContactId = contactId || journey.primary_contact_id;

  // Insert record
  const { data: doc, error } = await supabase
    .from("journey_documents")
    .insert({
      journey_id: journeyId,
      contact_id: resolvedContactId,
      uploaded_by: user.id,
      doc_type: safeType,
      display_name: displayName,
      file_url: fileUrl,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      extracted_text: extractedText,
      suggested_fields: suggestedFields,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Embed extracted text into the search index so search_documents can find it
  let embeddingResult: { chunksEmbedded: number } | null = null;
  if (extractedText && resolvedContactId) {
    try {
      embeddingResult = await embedExternalResearch(resolvedContactId, extractedText, safeType, {
        contactName: undefined, // Will be looked up inside embedExternalResearch
        documentTitle: displayName,
        documentType: DOC_TYPE_LABELS[safeType] ?? "Document",
      });
    } catch (err) {
      console.error(`Failed to embed document ${doc.id}:`, err);
      // Non-blocking — document is saved, embedding can be retried via repair endpoint
    }
  }

  // Auto-save AI-extracted fields to contact profile (non-null values only)
  const autoSavedFields: string[] = [];
  if (suggestedFields && resolvedContactId) {
    const fieldsToSave = Object.fromEntries(
      Object.entries(suggestedFields).filter(([, v]) => v !== null && String(v).trim().length > 0)
    );
    if (Object.keys(fieldsToSave).length > 0) {
      // Write each field to contact_profile_fields
      for (const [fieldName, value] of Object.entries(fieldsToSave)) {
        const { error: pfErr } = await supabase.from("contact_profile_fields").upsert(
          {
            contact_id: resolvedContactId,
            field_name: fieldName,
            field_value: value,
            last_updated_by: "ai",
            last_updated_at: new Date().toISOString(),
          },
          { onConflict: "contact_id,field_name" }
        );
        if (!pfErr) autoSavedFields.push(fieldName);
      }
    }
  }

  return NextResponse.json({
    document: doc,
    extractionFields,
    autoSavedFields,
    chunksEmbedded: embeddingResult?.chunksEmbedded ?? 0,
    success: true,
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ journeyId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  const { journeyId } = await params;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("journey_documents")
    .select("*")
    .eq("journey_id", journeyId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] });
}
