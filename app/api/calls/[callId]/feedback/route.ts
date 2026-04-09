/**
 * Suggestion Feedback API
 *
 * POST /api/calls/:callId/feedback — Log feedback for a suggestion card
 *
 * Body: {
 *   suggestionType: "profile_update" | "next_step" | "coaching_edit" | "rubric_edit",
 *   repId: string,
 *   contactId?: string,
 *   originalValue: any,
 *   acceptedValue?: any,
 *   outcome: "accepted" | "edited" | "skipped"
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { logSuggestionFeedback } from "@/lib/learning/feedback-logger";
import { setContactProfileField } from "@/lib/profile/profile-fields";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;

  let body: {
    suggestionType: "profile_update" | "next_step" | "coaching_edit" | "rubric_edit";
    repId: string;
    contactId?: string;
    originalValue: unknown;
    acceptedValue?: unknown;
    outcome: "accepted" | "edited" | "skipped";
    fieldName?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.suggestionType || !body.repId || !body.outcome) {
    return NextResponse.json(
      { error: "Missing required fields: suggestionType, repId, outcome" },
      { status: 400 }
    );
  }

  try {
    // Log the feedback
    const feedbackId = await logSuggestionFeedback({
      suggestionType: body.suggestionType,
      callId,
      contactId: body.contactId,
      repId: body.repId,
      originalValue: body.originalValue,
      acceptedValue: body.acceptedValue,
      outcome: body.outcome,
    });

    // If accepted/edited profile update, push to contact_profile_fields
    if (
      body.suggestionType === "profile_update" &&
      body.outcome !== "skipped" &&
      body.contactId &&
      body.fieldName
    ) {
      const valueToWrite =
        body.outcome === "edited" ? body.acceptedValue : body.originalValue;
      await setContactProfileField(
        body.contactId,
        body.fieldName,
        valueToWrite,
        "ai"
      );
    }

    return NextResponse.json({ success: true, feedbackId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
