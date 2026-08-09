export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/[contactId]/merge
 *
 * Marks the contactId in the path as a duplicate of the keepContactId in the body.
 *
 * ⚠ The MERGE ITSELF lives in lib/contacts/merge.ts — extracted 2026-08-09 so this
 * route and MasterSuite's replay (`merge_contact`) run the SAME code. The walkthrough's
 * Merge ×2 asked for an extraction, not a port: 3 of the first 5 merges orphaned a
 * journey while the logic lived only here, and a second copy would drift the same way.
 * This file now only authenticates, parses, and translates the outcome to HTTP.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { mergeContact } from "@/lib/contacts/merge";

interface MergeBody {
  keepContactId: string;
  reason?: string;
}

export async function POST(request: NextRequest, { params }: { params: { contactId: string } }) {
  // Gate FIRST — before the body is read or any row is touched. `requireAuth`
  // returns a Response on 401 rather than throwing, so the caller must check.
  // Not admin-only on purpose: the Merge button in LeadDetailView is shown to
  // every signed-in role (unlike Delete, which is gated to admin/operator), so
  // an admin check here would silently break a button people use today. Whether
  // merging SHOULD be admin-only is a separate call — see the session notes.
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const body = (await request.json()) as MergeBody;
  if (!body.keepContactId) {
    return NextResponse.json({ error: "keepContactId is required" }, { status: 400 });
  }

  const result = await mergeContact(params.contactId, body.keepContactId, body.reason);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: result.success,
    duplicate: result.duplicate,
    keeper: result.keeper,
    steps: result.steps,
  });
}
