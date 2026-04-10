export const dynamic = "force-dynamic";

/**
 * GET /api/contacts/:contactId/pre-call-brief?callTypeId=X
 * Generates a pre-call brief for a rep via Scout.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";
import Anthropic from "@anthropic-ai/sdk";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId: rawId } = await params;
  const callTypeId = new URL(request.url).searchParams.get("callTypeId");
  const supabase = createServerClient();

  const localId = await resolveContactId(rawId);
  if (!localId) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  try {
    // Contact info
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name, last_name, email, phone, opportunity_source, city, state")
      .eq("id", localId)
      .single();

    // Pipeline state
    const { data: cps } = await supabase
      .from("contact_pipeline_state")
      .select("id, current_stage_id, entered_current_stage_at, pipeline_stages (name)")
      .eq("contact_id", localId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    const stageName = cps ? ((cps.pipeline_stages as unknown as { name: string })?.name ?? "Unknown") : "No pipeline";

    // Recent sub-task logs
    const { data: logs } = await supabase
      .from("contact_sub_task_logs")
      .select("content_text, content_type, created_at")
      .eq("contact_pipeline_state_id", cps?.id ?? "")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    // Recent messages
    const { data: msgs } = await supabase
      .from("contact_activity_messages")
      .select("body, created_at")
      .eq("contact_id", localId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    // Prior call grades
    const { data: priorGrades } = await supabase
      .from("call_grades")
      .select("overall_grade, overall_score, strengths, improvements, suggested_next_action")
      .in("call_id", (
        await supabase.from("calls").select("id").eq("contact_id", localId).is("deleted_at", null)
      ).data?.map((c) => c.id) ?? [])
      .order("created_at", { ascending: false })
      .limit(3);

    // KB context
    const { data: kbDocs } = await supabase
      .from("knowledge_documents")
      .select("title, content")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .limit(5);

    // Call type name
    let callTypeName = "";
    if (callTypeId) {
      const { data: ct } = await supabase.from("call_types").select("name").eq("id", callTypeId).single();
      callTypeName = ct?.name ?? "";
    }

    const contactName = `${contact?.first_name ?? ""} ${contact?.last_name ?? ""}`.trim() || "Unknown";
    const logsBlock = (logs ?? []).map((l) => `[${l.content_type}] ${l.content_text ?? ""}`.slice(0, 100)).join("\n");
    const msgsBlock = (msgs ?? []).map((m) => m.body.slice(0, 100)).join("\n");
    const gradesBlock = (priorGrades ?? []).map((g) =>
      `Grade: ${g.overall_grade} (${g.overall_score}) — ${g.suggested_next_action ?? ""}`
    ).join("\n");
    const kbBlock = (kbDocs ?? []).map((d) => `[${d.title}] ${d.content.slice(0, 200)}`).join("\n");

    // Check for fresh agent-generated context on today's call
    const today = new Date().toISOString().split("T")[0];
    const { data: todayCall } = await supabase
      .from("calls")
      .select("brief_context")
      .eq("contact_id", localId)
      .gte("scheduled_at", `${today}T00:00:00Z`)
      .lte("scheduled_at", `${today}T23:59:59Z`)
      .not("brief_context", "is", null)
      .limit(1)
      .maybeSingle();

    const freshContext = todayCall?.brief_context
      ? `\nFRESH CONTEXT (from this morning's research):\n${todayCall.brief_context}\n`
      : "";

    const prompt = `You are Scout, generating a pre-call brief for a New Again Houses franchise sales rep.

CONTACT: ${contactName}
Location: ${contact?.city ?? ""}${contact?.state ? `, ${contact.state}` : ""}
Source: ${contact?.opportunity_source ?? "Unknown"}
Current stage: ${stageName}
Call type: ${callTypeName || "General"}
${freshContext}

RECENT ACTIVITY (last 10 logs):
${logsBlock || "No recent logs."}

TEAM MESSAGES:
${msgsBlock || "No messages."}

PRIOR CALL GRADES:
${gradesBlock || "No prior grades."}

KNOWLEDGE BASE:
${kbBlock || "No KB documents."}

Generate a concise pre-call brief with:
1. Who is this prospect? (1-2 sentences)
2. Where are they in the pipeline? (current stage + key milestones)
3. What's been discussed recently? (key points from logs/messages)
4. 3 things the rep should focus on in this call

Keep it under 300 words. Be specific and actionable.`;

    const model = process.env.SCOUT_MODEL ?? "claude-sonnet-4-6-20250514";
    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const brief = response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ brief, contactName, stageName, callTypeName });
  } catch (err) {
    console.error("Pre-call brief error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
