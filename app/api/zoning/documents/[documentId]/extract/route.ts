export const dynamic = "force-dynamic";
export const maxDuration = 300; // ordinance extraction is a long single model call

/**
 * POST /api/zoning/documents/[documentId]/extract — run AI extraction of
 * district rules from a stored ordinance document (admin).
 *
 * Merge policy (lib/zoning/merge-extracted.ts): inserts new districts and
 * refreshes ones still ai_extracted; never touches verified/manual rows.
 * Everything written here lands as extraction_status = 'ai_extracted' and
 * must be verified before it gates any spend.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { extractZoningDistricts } from "@/lib/zoning/extract-districts";
import { planDistrictMerge, type ExistingDistrict } from "@/lib/zoning/merge-extracted";
import { rulesToRow } from "@/lib/zoning/db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const { documentId } = await params;

  const supabase = createServerClient();

  const { data: doc } = await supabase
    .from("zoning_documents")
    .select("id, jurisdiction_id, title, extracted_text, jurisdictions(name, state)")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (!doc.extracted_text) {
    return NextResponse.json(
      { error: "Document has no extracted text — re-upload a text-extractable file" },
      {
        status: 422,
      }
    );
  }

  const jurisdiction = doc.jurisdictions as unknown as { name: string; state: string | null } | null;
  const jurisdictionLabel = jurisdiction
    ? `${jurisdiction.name}${jurisdiction.state ? `, ${jurisdiction.state}` : ""}`
    : doc.title;

  const extracted = await extractZoningDistricts(doc.extracted_text, jurisdictionLabel);
  if (extracted.length === 0) {
    return NextResponse.json(
      { error: "Extraction returned no districts — extract manually or check the document text" },
      { status: 422 }
    );
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("zoning_districts")
    .select("id, code, extraction_status")
    .eq("jurisdiction_id", doc.jurisdiction_id);
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const plan = planDistrictMerge((existingRows ?? []) as ExistingDistrict[], extracted);

  if (plan.toInsert.length > 0) {
    const { error } = await supabase
      .from("zoning_districts")
      .insert(
        plan.toInsert.map((rules) =>
          rulesToRow(rules, doc.jurisdiction_id, { sourceDocumentId: doc.id, extractionStatus: "ai_extracted" })
        )
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (const { id, rules } of plan.toUpdate) {
    const { error } = await supabase
      .from("zoning_districts")
      .update({
        ...rulesToRow(rules, doc.jurisdiction_id, { sourceDocumentId: doc.id, extractionStatus: "ai_extracted" }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    extracted: extracted.length,
    inserted: plan.toInsert.length,
    updated: plan.toUpdate.length,
    skippedVerified: plan.skipped,
    reviewRequired: true,
  });
}
