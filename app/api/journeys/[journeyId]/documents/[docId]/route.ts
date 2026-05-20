export const dynamic = "force-dynamic";

/**
 * DELETE /api/journeys/[journeyId]/documents/[docId] — Delete a document
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ journeyId: string; docId: string }> }
) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  const { journeyId, docId } = await params;

  const supabase = createServerClient();

  const { error } = await supabase.from("journey_documents").delete().eq("id", docId).eq("journey_id", journeyId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
