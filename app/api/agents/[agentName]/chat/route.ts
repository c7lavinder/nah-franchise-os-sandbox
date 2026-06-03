export const dynamic = "force-dynamic";

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { getAgentByName } from "@/lib/agents/agent-registry";

const MODEL = "claude-haiku-4-5-20251001";

type AgentChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AgentChatRequest = {
  message: string;
  history?: AgentChatMessage[];
};

function clip(text: string, max = 4000) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ agentName: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { agentName } = await params;
  const agent = getAgentByName(agentName);
  if (!agent) return NextResponse.json({ error: "Unknown agent" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as AgentChatRequest;
  if (!body.message?.trim()) return NextResponse.json({ error: "Missing message" }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Agent chat is not configured" }, { status: 500 });
  }

  const supabase = createServerClient();
  const { data: recentRuns } = await supabase
    .from("integration_logs")
    .select("created_at, status, payload_summary, error_message")
    .eq("integration_name", agent.name)
    .order("created_at", { ascending: false })
    .limit(5);

  const system = `You are ${agent.label}, an AI teammate inside the FranDev operating system.

Your job in this chat is to help a non-technical operator understand, trust, and improve this specific agent.
Do not execute actions, send messages, change CRM records, change workflow rules, or claim that you changed production.
If the user asks for a behavior change, write a clear improvement recommendation and explain what data, guardrails, and approval would be needed.
Keep answers practical, plain-English, and business-focused.

Agent:
- Key: ${agent.name}
- Role: ${agent.roleTitle}
- Department: ${agent.category}
- Mission: ${agent.mission}
- What it does: ${agent.description}
- Trigger: ${agent.trigger}
- Uses: ${agent.uses.join("; ")}
- How it works: ${agent.howItWorks.join(" -> ")}
- Data sources: ${agent.dataSources.join("; ")}
- Guardrails: ${agent.guardrails.join("; ")}
- Can do: ${agent.canDo.join("; ")}
- Cannot do: ${agent.cannotDo.join("; ")}
- Trust level: ${agent.trustLevel}
- Cost estimate: ${agent.costPerRunEstimate}

Recent activity:
${(recentRuns ?? [])
  .map(
    (run) =>
      `- ${run.created_at}: ${run.status}${run.error_message ? `, error: ${clip(run.error_message, 220)}` : ""}${
        run.payload_summary ? `, summary: ${clip(run.payload_summary, 220)}` : ""
      }`
  )
  .join("\n") || "- No recent activity found."}`;

  const history = (body.history ?? []).slice(-8).map((message) => ({
    role: message.role,
    content: clip(message.content, 3000),
  }));

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 900,
    system,
    messages: [...history, { role: "user", content: clip(body.message.trim(), 4000) }],
  });

  const text = response.content.find((item) => item.type === "text")?.text ?? "I could not generate a response.";

  return NextResponse.json({ message: text });
}
