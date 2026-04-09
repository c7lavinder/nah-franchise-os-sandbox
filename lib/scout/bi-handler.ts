/**
 * Scout Business Intelligence Handler
 *
 * Handles cross-contact queries about pipeline health, conversion patterns,
 * rep performance, objection frequencies, and other aggregate metrics.
 * Adjusts phrasing by user role.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";

interface BIContext {
  totalContacts: number;
  salesPipelineCounts: Record<string, number>;
  recentStageChanges: number;
  avgDaysInStage: number | null;
  topObjections: Array<{ field: string; count: number }>;
}

/**
 * Gather BI data from Supabase.
 */
async function gatherBIContext(): Promise<BIContext> {
  const supabase = createServerClient();

  // Total contacts
  const { count: totalContacts } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true });

  // Sales pipeline stage counts
  const { data: stageCounts } = await supabase
    .from("contact_pipeline_state")
    .select("current_stage_id, pipeline_stages (name)")
    .eq("is_active", true);

  const salesPipelineCounts: Record<string, number> = {};
  for (const row of stageCounts ?? []) {
    const stage = row.pipeline_stages as unknown as { name: string } | null;
    const name = stage?.name ?? "Unknown";
    salesPipelineCounts[name] = (salesPipelineCounts[name] ?? 0) + 1;
  }

  // Recent stage changes (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recentChanges } = await supabase
    .from("pipeline_stage_history")
    .select("id", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgo);

  // Average days in current stage
  const { data: stateRows } = await supabase
    .from("contact_pipeline_state")
    .select("entered_current_stage_at")
    .eq("is_active", true)
    .limit(100);

  let avgDays: number | null = null;
  if (stateRows && stateRows.length > 0) {
    const now = Date.now();
    const totalDays = stateRows.reduce((sum, r) => {
      const entered = new Date(r.entered_current_stage_at).getTime();
      return sum + (now - entered) / (1000 * 60 * 60 * 24);
    }, 0);
    avgDays = Math.round(totalDays / stateRows.length);
  }

  return {
    totalContacts: totalContacts ?? 0,
    salesPipelineCounts,
    recentStageChanges: recentChanges ?? 0,
    avgDaysInStage: avgDays,
    topObjections: [],
  };
}

const FOLLOW_UP_PROMPTS = [
  "Want to dig deeper into this?",
  "Want me to pull the specific contacts driving this pattern?",
  "Should we work through what to change?",
  "Want me to flag this across the active pipeline?",
];

/**
 * Handle a BI query and return Scout's response.
 */
export async function handleBIQuery(
  query: string,
  userRole: "admin" | "operator" | "specialist" | "member"
): Promise<string> {
  const biContext = await gatherBIContext();

  const roleFraming = {
    admin: "You are speaking to a franchise leadership team member. Be strategic, high-level, and data-driven.",
    operator: "You are speaking to the primary franchise development operator. Be tactical and action-oriented.",
    specialist: "You are speaking to a franchise development specialist. Focus on their area of responsibility.",
    member: "You are speaking to a team member. Provide helpful context at an appropriate level.",
  };

  const prompt = `You are Scout, the AI brain of the New Again Houses franchise sales platform.
${roleFraming[userRole]}

The user asked a business intelligence question. Answer with available data.

QUESTION: ${query}

AVAILABLE DATA:
- Total contacts in system: ${biContext.totalContacts}
- Pipeline stage distribution: ${JSON.stringify(biContext.salesPipelineCounts)}
- Stage changes (last 7 days): ${biContext.recentStageChanges}
- Average days in current stage: ${biContext.avgDaysInStage ?? "Unknown"}

RULES:
- Answer with specific numbers from the data
- If you don't have data to answer fully, say what you CAN answer and what data you'd need
- Keep it concise (3-5 sentences)
- End with one follow-up prompt from this list: ${JSON.stringify(FOLLOW_UP_PROMPTS)}
- Never make up data — only use what's provided above`;

  const model = process.env.SCOUT_MODEL ?? "claude-sonnet-4-5-20250514";
  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model,
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}
