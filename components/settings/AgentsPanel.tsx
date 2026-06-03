"use client";

import { apiFetch } from "@/lib/auth/api-fetch";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleDashed,
  Loader2,
  MessageSquareText,
  Play,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { AgentCategory, AgentTeamCard } from "@/lib/agents/agent-registry";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AgentsResponse = {
  categories?: AgentCategory[];
  agents?: AgentTeamCard[];
};

const FALLBACK_CATEGORIES: AgentCategory[] = [
  { key: "lead-management", label: "Lead Management", summary: "Prospect and rep support." },
  { key: "franchisee-management", label: "Franchisee Management", summary: "Onboarding, runway, and coaching." },
  { key: "site-development", label: "Site Development", summary: "Territory and market intelligence." },
  { key: "marketing", label: "Marketing", summary: "Demand and reactivation support." },
  { key: "operations", label: "Operations", summary: "Data, workflows, and reliability." },
  { key: "planned", label: "Planned", summary: "Future teammates." },
];

const statusStyle = {
  active: "bg-success/10 text-success border-success/20",
  paused: "bg-warning/10 text-warning border-warning/20",
  planned: "bg-bg-secondary text-text-tertiary border-border-default",
  "needs-review": "bg-nah-orange/10 text-nah-orange border-nah-orange/20",
};

const trustLabel = {
  "read-only": "Read-only",
  "drafts-only": "Drafts only",
  "approval-required": "Approval required",
  "manual-only": "Manual only",
};

const samplePrompts = [
  "What should I trust you to do today?",
  "What would make you more useful?",
  "Where are your biggest data gaps?",
];

function fallbackAgents(): AgentTeamCard[] {
  return [];
}

function formatDate(value: string | null) {
  if (!value) return "No recent run";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function metricLabel(value: number) {
  return Number.isFinite(value) ? value.toLocaleString() : "0";
}

export default function AgentsPanel() {
  const [categories, setCategories] = useState<AgentCategory[]>(FALLBACK_CATEGORIES);
  const [agents, setAgents] = useState<AgentTeamCard[]>(fallbackAgents);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [activeAgentName, setActiveAgentName] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [chatting, setChatting] = useState(false);
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/settings/agents")
      .then((r) => r.json())
      .then((data: AgentsResponse) => {
        setCategories(data.categories?.length ? data.categories : FALLBACK_CATEGORIES);
        setAgents(data.agents ?? []);
        setActiveAgentName((current) => current ?? data.agents?.[0]?.name ?? null);
      })
      .catch(() => {
        setError("Agent registry could not load. Try refreshing after checking app auth or data access.");
        setAgents(fallbackAgents());
      })
      .finally(() => setLoading(false));
  }, []);

  const activeAgent = useMemo(
    () => agents.find((agent) => agent.name === activeAgentName) ?? agents[0] ?? null,
    [activeAgentName, agents]
  );

  const activeMessages = activeAgent ? chatHistory[activeAgent.name] ?? [] : [];

  async function toggleAgent(name: string, enabled: boolean) {
    setAgents((prev) => prev.map((agent) => (agent.name === name ? { ...agent, enabled } : agent)));
    try {
      await apiFetch("/api/settings/agents/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName: name, enabled }),
      });
    } catch {
      setAgents((prev) => prev.map((agent) => (agent.name === name ? { ...agent, enabled: !enabled } : agent)));
    }
  }

  async function triggerAgent(agent: AgentTeamCard) {
    if (!agent.manualRun || agent.status === "planned") return;

    setTriggering(agent.name);
    try {
      const response = await apiFetch(agent.manualRun.url, {
        method: agent.manualRun.method,
        headers: agent.manualRun.body ? { "Content-Type": "application/json" } : undefined,
        body: agent.manualRun.body ? JSON.stringify(agent.manualRun.body) : undefined,
      });
      if (!response.ok) throw new Error("Run failed");
    } catch {
      setError(`${agent.label} could not run. Check the agent logs before trying again.`);
    } finally {
      setTriggering(null);
    }
  }

  async function sendChat(message?: string) {
    const prompt = (message ?? chatDraft).trim();
    if (!activeAgent || !prompt || chatting) return;

    const prior = chatHistory[activeAgent.name] ?? [];
    const nextMessages: ChatMessage[] = [...prior, { role: "user", content: prompt }];
    setChatDraft("");
    setChatHistory((prev) => ({ ...prev, [activeAgent.name]: nextMessages }));
    setChatting(true);

    try {
      const response = await apiFetch(`/api/agents/${activeAgent.name}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, history: prior.slice(-8) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Agent chat failed");
      setChatHistory((prev) => ({
        ...prev,
        [activeAgent.name]: [...nextMessages, { role: "assistant", content: data.message ?? "No response." }],
      }));
    } catch (chatError) {
      const messageText = chatError instanceof Error ? chatError.message : "Agent chat failed";
      setChatHistory((prev) => ({
        ...prev,
        [activeAgent.name]: [
          ...nextMessages,
          {
            role: "assistant",
            content: `I cannot answer from the agent brain right now. ${messageText}`,
          },
        ],
      }));
    } finally {
      setChatting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border-default bg-bg-secondary py-16">
        <Loader2 size={20} className="animate-spin text-nah-blue" />
      </div>
    );
  }

  const activeCount = agents.filter((agent) => agent.status === "active").length;
  const guardedCount = agents.filter((agent) => agent.trustLevel === "approval-required" || agent.trustLevel === "manual-only").length;
  const plannedCount = agents.filter((agent) => agent.status === "planned").length;

  return (
    <div className="space-y-6">
      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/10 px-4 py-3 text-body-sm text-text-secondary">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-warning" />
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border-default bg-bg-secondary p-4">
          <div className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wide text-text-tertiary">
            <CheckCircle2 size={14} className="text-success" />
            Live agents
          </div>
          <div className="mt-2 text-2xl font-semibold text-text-primary">{activeCount}</div>
        </div>
        <div className="rounded-lg border border-border-default bg-bg-secondary p-4">
          <div className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wide text-text-tertiary">
            <ShieldCheck size={14} className="text-nah-orange" />
            Guarded agents
          </div>
          <div className="mt-2 text-2xl font-semibold text-text-primary">{guardedCount}</div>
        </div>
        <div className="rounded-lg border border-border-default bg-bg-secondary p-4">
          <div className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wide text-text-tertiary">
            <CircleDashed size={14} className="text-text-tertiary" />
            Planned agents
          </div>
          <div className="mt-2 text-2xl font-semibold text-text-primary">{plannedCount}</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          {categories.map((category) => {
            const categoryAgents = agents.filter((agent) => agent.category === category.key);
            if (!categoryAgents.length) return null;

            return (
              <section key={category.key} className="space-y-3">
                <div>
                  <h3 className="font-headline text-card-title text-text-primary">{category.label}</h3>
                  <p className="text-body-sm text-text-tertiary">{category.summary}</p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {categoryAgents.map((agent) => {
                    const selected = activeAgent?.name === agent.name;
                    const disabled = agent.status === "planned" || !agent.enabled;

                    return (
                      <article
                        key={agent.name}
                        className={`rounded-lg border bg-bg-primary p-4 transition-colors ${
                          selected ? "border-nah-blue shadow-sm" : "border-border-default hover:border-border-hover"
                        }`}
                      >
                        <div className={`mb-4 rounded-lg bg-gradient-to-br ${agent.portrait.background} p-3`}>
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => setActiveAgentName(agent.name)}
                              className="flex min-w-0 flex-1 items-center gap-3 text-left"
                            >
                              <div
                                className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${agent.portrait.accent} text-sm font-semibold text-white shadow-sm`}
                              >
                                {agent.portrait.initials}
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-card-title text-text-primary">{agent.label}</h4>
                                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusStyle[agent.status]}`}>
                                    {agent.status.replace("-", " ")}
                                  </span>
                                </div>
                                <p className="text-caption text-text-tertiary">{agent.roleTitle}</p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleAgent(agent.name, !agent.enabled)}
                              disabled={agent.status === "planned"}
                              aria-label={`${agent.enabled ? "Disable" : "Enable"} ${agent.label}`}
                              className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                agent.enabled ? "bg-success" : "bg-bg-tertiary"
                              }`}
                            >
                              <span
                                className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                                  agent.enabled ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        <p className="text-body-sm text-text-secondary">{agent.mission}</p>

                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-md bg-bg-secondary px-2 py-2">
                            <div className="text-caption text-text-tertiary">Runs</div>
                            <div className="text-body-sm font-semibold text-text-primary">{metricLabel(agent.runsMTD)}</div>
                          </div>
                          <div className="rounded-md bg-bg-secondary px-2 py-2">
                            <div className="text-caption text-text-tertiary">Suggestions</div>
                            <div className="text-body-sm font-semibold text-text-primary">{metricLabel(agent.suggestionsMTD)}</div>
                          </div>
                          <div className="rounded-md bg-bg-secondary px-2 py-2">
                            <div className="text-caption text-text-tertiary">Cost</div>
                            <div className="text-body-sm font-semibold text-text-primary">{agent.costEstMTD}</div>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2 text-caption text-text-secondary">
                          <div className="flex items-start gap-2">
                            <Sparkles size={13} className="mt-0.5 flex-shrink-0 text-nah-orange" />
                            <span>{agent.trigger}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <ShieldCheck size={13} className="mt-0.5 flex-shrink-0 text-nah-blue" />
                            <span>{trustLabel[agent.trustLevel]} · {agent.guardrails[0]}</span>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveAgentName(agent.name)}
                            className="flex items-center gap-1.5 rounded-md border border-border-default bg-bg-secondary px-3 py-2 text-caption font-medium text-text-primary hover:bg-bg-hover"
                          >
                            <MessageSquareText size={13} />
                            Ask
                          </button>
                          <button
                            type="button"
                            onClick={() => triggerAgent(agent)}
                            disabled={disabled || !agent.manualRun || triggering === agent.name}
                            className="flex items-center gap-1.5 rounded-md bg-nah-blue px-3 py-2 text-caption font-medium text-white hover:bg-nah-blue-hover disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {triggering === agent.name ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                            Run
                          </button>
                          <span className="text-caption text-text-tertiary">{formatDate(agent.lastRunAt)}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <aside className="sticky top-4 h-fit rounded-lg border border-border-default bg-bg-primary p-4">
          {activeAgent ? (
            <>
              <div className="flex items-start gap-3 border-b border-border-default pb-4">
                <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${activeAgent.portrait.accent} text-sm font-semibold text-white`}>
                  {activeAgent.portrait.initials}
                </div>
                <div>
                  <h3 className="text-card-title text-text-primary">{activeAgent.label}</h3>
                  <p className="text-caption text-text-tertiary">{activeAgent.roleTitle}</p>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-overline tracking-wider text-text-tertiary">Can do</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {activeAgent.canDo.map((item) => (
                      <span key={item} className="rounded-md bg-success/10 px-2 py-1 text-caption text-success">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-overline tracking-wider text-text-tertiary">Approval boundaries</div>
                  <ul className="mt-2 space-y-1.5 text-caption text-text-secondary">
                    {activeAgent.cannotDo.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-nah-orange" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border border-border-default bg-bg-secondary p-3">
                  <div className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wide text-text-tertiary">
                    <Bot size={13} />
                    Ask this agent
                  </div>
                  <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                    {activeMessages.length ? (
                      activeMessages.map((message, index) => (
                        <div
                          key={`${message.role}-${index}`}
                          className={`rounded-md px-3 py-2 text-body-sm ${
                            message.role === "user"
                              ? "ml-6 bg-nah-blue text-white"
                              : "mr-6 border border-border-default bg-bg-primary text-text-secondary"
                          }`}
                        >
                          {message.content}
                        </div>
                      ))
                    ) : (
                      <div className="space-y-2">
                        {samplePrompts.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => sendChat(prompt)}
                            className="block w-full rounded-md border border-border-default bg-bg-primary px-3 py-2 text-left text-caption text-text-secondary hover:border-nah-blue/40 hover:text-text-primary"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    )}
                    {chatting ? (
                      <div className="mr-6 flex items-center gap-2 rounded-md border border-border-default bg-bg-primary px-3 py-2 text-caption text-text-tertiary">
                        <Loader2 size={13} className="animate-spin" />
                        Thinking
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <textarea
                      value={chatDraft}
                      onChange={(event) => setChatDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          sendChat();
                        }
                      }}
                      placeholder={`Ask ${activeAgent.label}...`}
                      className="min-h-[44px] flex-1 resize-none rounded-md border border-border-default bg-bg-primary px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-nah-blue"
                    />
                    <button
                      type="button"
                      onClick={() => sendChat()}
                      disabled={!chatDraft.trim() || chatting}
                      aria-label="Send agent question"
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-nah-blue text-white hover:bg-nah-blue-hover disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-body-sm text-text-tertiary">No agents loaded.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
