export const dynamic = "force-dynamic";

/**
 * POST /api/calls/:callId/actions/generate-single
 *
 * Generate a single action item from a natural language instruction.
 * Unlike the full post-call agent, this is triggered by the AI bar.
 * Context-aware: includes transcript, pipeline position, feedback, and — for
 * partnership journeys (Kevin + Kylie Kremer, spouses, etc) — the partner list
 * so Scout can pick the correct target_contact_name per action.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";
import { stripFences } from "@/lib/agents/post-call/call-claude";
import { retrieveFeedback } from "@/lib/agents/post-call/feedback-retrieval";

const MODEL = "claude-sonnet-4-5-20250514";

interface PartnerRow {
  contact_id: string;
  name: string;
  role: "primary" | "co_primary";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;
  const { instruction } = (await request.json()) as { instruction: string };

  if (!instruction?.trim()) {
    return NextResponse.json({ error: "Instruction required" }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: call } = await supabase
    .from("calls")
    .select("id, contact_id, call_type_id, title, started_at")
    .eq("id", callId)
    .single();
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  let contactName = "Unknown";
  if (call.contact_id) {
    const { data: c } = await supabase.from("contacts").select("first_name, last_name").eq("id", call.contact_id).single();
    if (c) contactName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unknown";
  }

  let callTypeSlug: string | null = null;
  if (call.call_type_id) {
    const { data: ct } = await supabase.from("call_types").select("slug").eq("id", call.call_type_id).single();
    if (ct) callTypeSlug = ct.slug;
  }

  const { data: transcriptRow } = await supabase
    .from("call_transcripts")
    .select("full_text")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const transcript = transcriptRow?.full_text ?? "";

  const { data: existingActions } = await supabase
    .from("call_action_items")
    .select("category, title")
    .eq("call_id", callId)
    .eq("status", "pending");
  const existingList = (existingActions ?? []).map((a) => `${a.category}: ${a.title}`).join("\n");

  const feedback = await retrieveFeedback({ callTypeSlug, contactId: call.contact_id });

  // Partnership context — present only when journey has 2+ primaries.
  const { journeyId, partners } = await loadJourneyPartners(supabase, call.contact_id);
  const partnerBlock = buildPartnerBlock(partners);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  const client = new Anthropic({ apiKey });

  const trimmedTranscript = transcript.length > 4000
    ? "...\n" + transcript.slice(-4000)
    : transcript;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: "You are Scout, an AI assistant for NAH Franchise OS. Generate exactly one action item from the user's instruction. Use the transcript and context to pre-fill all fields accurately.",
      messages: [{
        role: "user",
        content: `Generate one action item based on this instruction: "${instruction}"

Contact: ${contactName}
Call: ${call.title ?? "Unknown"}
Date: ${call.started_at ?? "Unknown"}

## Existing actions (do NOT duplicate):
${existingList || "None yet"}

## Transcript (for context):
${trimmedTranscript || "No transcript available"}

${feedback.promptBlock}

${partnerBlock}

Return a JSON object with: category (apt|comms|task|note|pipeline|data), title, description, why, contact_name, target_contact_name (required if partnership block is present — the exact partner name from above), assigned_to_name, ghl_action (bool), source ("manual"), metadata (with all relevant fields for the category — comms needs comms_channel, comms_body, etc.).

Return only valid JSON. No markdown fences.`,
      }],
    });

    const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
    if (!text) return NextResponse.json({ error: "No response from Scout" }, { status: 500 });

    const action = JSON.parse(stripFences(text)) as {
      category?: string;
      title?: string;
      description?: string;
      why?: string;
      contact_name?: string;
      target_contact_name?: string;
      assigned_to_name?: string;
      metadata?: Record<string, unknown>;
      ghl_action?: boolean;
    };

    const resolvedContactId =
      resolvePartnerNameToId(action.target_contact_name, partners) ?? call.contact_id;

    const { data: row } = await supabase.from("call_action_items").insert({
      call_id: callId,
      contact_id: resolvedContactId,
      journey_id: journeyId,
      category: action.category ?? "task",
      title: action.title ?? instruction,
      description: action.description ?? null,
      why: action.why ?? null,
      contact_name: action.contact_name ?? contactName,
      assigned_to_name: action.assigned_to_name ?? "Chad Arnold",
      metadata: action.metadata ?? null,
      source: "manual",
      ghl_action: action.ghl_action ?? false,
      status: "pending",
    }).select("id").single();

    return NextResponse.json({ success: true, actionId: row?.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function loadJourneyPartners(
  supabase: ReturnType<typeof createServerClient>,
  callContactId: string | null,
): Promise<{ journeyId: string | null; partners: PartnerRow[] }> {
  if (!callContactId) return { journeyId: null, partners: [] };

  let journeyId: string | null = null;
  const { data: journeyAsPrimary } = await supabase
    .from("journeys")
    .select("id")
    .eq("primary_contact_id", callContactId)
    .maybeSingle();
  journeyId = journeyAsPrimary?.id ?? null;

  if (!journeyId) {
    const { data: membership } = await supabase
      .from("journey_contacts")
      .select("journey_id")
      .eq("contact_id", callContactId)
      .is("left_at", null)
      .in("role", ["primary", "co_primary"])
      .maybeSingle();
    journeyId = membership?.journey_id ?? null;
  }

  if (!journeyId) return { journeyId: null, partners: [] };

  const { data: members } = await supabase
    .from("journey_contacts")
    .select("contact_id, role, contacts ( first_name, last_name )")
    .eq("journey_id", journeyId)
    .is("left_at", null)
    .in("role", ["primary", "co_primary"]);

  const partners: PartnerRow[] = [];
  for (const m of members ?? []) {
    if (!m.contact_id) continue;
    const c = Array.isArray(m.contacts) ? m.contacts[0] : m.contacts;
    const first = ((c as { first_name: string } | null)?.first_name ?? "").trim();
    const last = ((c as { last_name: string } | null)?.last_name ?? "").trim();
    const name = `${first} ${last}`.trim();
    if (!name) continue;
    partners.push({
      contact_id: m.contact_id,
      name,
      role: (m.role as "primary" | "co_primary") ?? "primary",
    });
  }
  return { journeyId, partners };
}

function buildPartnerBlock(partners: PartnerRow[]): string {
  if (partners.length < 2) return "";
  const lines = [
    "## PARTNERSHIP JOURNEY — REQUIRED",
    "This journey has multiple co-primary partners. Pick `target_contact_name` from this list:",
  ];
  for (const p of partners) {
    const role = p.role === "co_primary" ? "Co-primary" : "Primary";
    lines.push(`- ${p.name} (${role})`);
  }
  lines.push(
    "If the action topic belongs to one partner's domain, pick that partner.",
    "If it applies to both, pick the first partner listed.",
    "Never leave target_contact_name blank here.",
  );
  return lines.join("\n");
}

function resolvePartnerNameToId(
  name: string | undefined,
  partners: PartnerRow[],
): string | null {
  if (!name || partners.length === 0) return null;
  const lc = name.trim().toLowerCase();
  for (const p of partners) {
    const nameLc = p.name.toLowerCase();
    if (nameLc === lc) return p.contact_id;
    const [first, ...rest] = p.name.split(" ");
    const last = rest.join(" ");
    if (first && first.toLowerCase() === lc) return p.contact_id;
    if (last && last.toLowerCase() === lc) return p.contact_id;
  }
  return null;
}
