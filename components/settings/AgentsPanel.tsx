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
  Save,
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

type CardPortrait = {
  skin: string;
  skinShadow: string;
  hair: string;
  hairShadow: string;
  shirt: string;
  trim: string;
  cap?: string;
  background: string;
  pattern: string;
  number: string;
  rating: string;
  stance: "front" | "angle";
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

const cardPortraits: Record<string, CardPortrait> = {
  "post-call": {
    skin: "#d8a16b",
    skinShadow: "#b87542",
    hair: "#2f2118",
    hairShadow: "#1b120d",
    shirt: "#0f78a8",
    trim: "#f59e0b",
    cap: "#0f78a8",
    background: "#dff4fb",
    pattern: "#9bd4ea",
    number: "01",
    rating: "92",
    stance: "front",
  },
  "contact-research": {
    skin: "#f0c7a2",
    skinShadow: "#d39a72",
    hair: "#24120d",
    hairShadow: "#120907",
    shirt: "#4f46e5",
    trim: "#a78bfa",
    background: "#e9e7ff",
    pattern: "#b7b3ff",
    number: "02",
    rating: "88",
    stance: "angle",
  },
  "pre-call-brief": {
    skin: "#c88455",
    skinShadow: "#9a5c34",
    hair: "#1f2937",
    hairShadow: "#111827",
    shirt: "#d97706",
    trim: "#fcd34d",
    cap: "#b45309",
    background: "#fff3d7",
    pattern: "#f2be63",
    number: "03",
    rating: "86",
    stance: "front",
  },
  "reengagement-signal": {
    skin: "#e8b891",
    skinShadow: "#c58158",
    hair: "#5f3b20",
    hairShadow: "#35200f",
    shirt: "#059669",
    trim: "#6ee7b7",
    background: "#dff8ed",
    pattern: "#8be0bb",
    number: "04",
    rating: "84",
    stance: "angle",
  },
  "journey-brief": {
    skin: "#f3d0b2",
    skinShadow: "#d79f79",
    hair: "#3b2a1a",
    hairShadow: "#21170e",
    shirt: "#1d4ed8",
    trim: "#93c5fd",
    background: "#e1edff",
    pattern: "#a7c8ff",
    number: "05",
    rating: "90",
    stance: "front",
  },
  "territory-market": {
    skin: "#b8754d",
    skinShadow: "#8d4e31",
    hair: "#111827",
    hairShadow: "#030712",
    shirt: "#4d7c0f",
    trim: "#bef264",
    cap: "#365314",
    background: "#eefbd8",
    pattern: "#bde67b",
    number: "06",
    rating: "87",
    stance: "angle",
  },
  "data-intelligence": {
    skin: "#e2ad81",
    skinShadow: "#b8754d",
    hair: "#4b5563",
    hairShadow: "#1f2937",
    shirt: "#334155",
    trim: "#67e8f9",
    background: "#e8f4f7",
    pattern: "#9fd5dc",
    number: "07",
    rating: "94",
    stance: "front",
  },
  "runway-pipeline-guardian": {
    skin: "#d49a73",
    skinShadow: "#a76543",
    hair: "#2a1710",
    hairShadow: "#120907",
    shirt: "#be123c",
    trim: "#fda4af",
    cap: "#881337",
    background: "#ffe2e7",
    pattern: "#f8a6b5",
    number: "08",
    rating: "91",
    stance: "front",
  },
  "marketing-intelligence": {
    skin: "#edc0a0",
    skinShadow: "#c88d65",
    hair: "#5b2333",
    hairShadow: "#33101d",
    shirt: "#c026d3",
    trim: "#f0abfc",
    background: "#fae8ff",
    pattern: "#e7a7f5",
    number: "09",
    rating: "79",
    stance: "angle",
  },
  "workflow-qa": {
    skin: "#c98f68",
    skinShadow: "#965b3c",
    hair: "#172554",
    hairShadow: "#0f172a",
    shirt: "#0891b2",
    trim: "#67e8f9",
    background: "#dff8ff",
    pattern: "#8edbec",
    number: "10",
    rating: "82",
    stance: "front",
  },
  "eos-sync": {
    skin: "#f1c19c",
    skinShadow: "#cd8c63",
    hair: "#6b3d18",
    hairShadow: "#3b210b",
    shirt: "#ca8a04",
    trim: "#fde68a",
    background: "#fff8d6",
    pattern: "#edd56b",
    number: "11",
    rating: "80",
    stance: "angle",
  },
};

function getCardPortrait(agent: AgentTeamCard): CardPortrait {
  return (
    cardPortraits[agent.name] ?? {
      skin: "#e2ad81",
      skinShadow: "#b8754d",
      hair: "#1f2937",
      hairShadow: "#111827",
      shirt: "#0f78a8",
      trim: "#f59e0b",
      background: "#eef7fb",
      pattern: "#b8dce8",
      number: "00",
      rating: "80",
      stance: "front",
    }
  );
}

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

function AgentBaseballPortrait({ agent, compact = false }: { agent: AgentTeamCard; compact?: boolean }) {
  const portrait = getCardPortrait(agent);
  const opacity = agent.status === "planned" ? 0.66 : 1;
  const idPrefix = `${agent.name}-${compact ? "compact" : "card"}`;
  const lean = portrait.stance === "angle" ? 5 : 0;

  return (
    <div
      className={`relative overflow-hidden rounded-md border border-white/70 shadow-inner ${
        compact ? "h-24 w-20" : "aspect-[5/4] w-full"
      }`}
      style={{ background: portrait.background }}
    >
      <svg viewBox="0 0 260 210" className="h-full w-full" role="img" aria-label={`${agent.label} portrait`}>
        <defs>
          <linearGradient id={`${idPrefix}-skin`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffe3c8" stopOpacity="0.42" />
            <stop offset="0.46" stopColor={portrait.skin} />
            <stop offset="1" stopColor={portrait.skinShadow} stopOpacity="0.82" />
          </linearGradient>
          <linearGradient id={`${idPrefix}-hair`} x1="0.2" y1="0" x2="0.75" y2="1">
            <stop offset="0" stopColor={portrait.hair} />
            <stop offset="1" stopColor={portrait.hairShadow} />
          </linearGradient>
          <linearGradient id={`${idPrefix}-jacket`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={portrait.trim} stopOpacity="0.32" />
            <stop offset="0.44" stopColor={portrait.shirt} />
            <stop offset="1" stopColor={portrait.shirt} stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id={`${idPrefix}-field`} cx="50%" cy="30%" r="74%">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.94" />
            <stop offset="0.56" stopColor={portrait.background} stopOpacity="0.72" />
            <stop offset="1" stopColor={portrait.pattern} stopOpacity="0.34" />
          </radialGradient>
          <linearGradient id={`${idPrefix}-sheen`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.72" />
            <stop offset="0.48" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="1" stopColor="#111827" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <rect width="260" height="210" fill={`url(#${idPrefix}-field)`} />
        <path d="M-18 171 C32 138 74 198 123 174 C178 147 215 160 278 129 L278 230 L-18 230 Z" fill={portrait.pattern} opacity="0.24" />
        <path d="M55 47 H205" stroke={portrait.pattern} strokeWidth="8" strokeLinecap="round" opacity="0.12" />
        <path d="M72 68 H188" stroke={portrait.pattern} strokeWidth="5" strokeLinecap="round" opacity="0.1" />

        <g opacity={opacity} transform={`translate(${lean} 0)`}>
          <ellipse cx="130" cy="198" rx="77" ry="14" fill="#0f172a" opacity="0.11" />
          <path d="M75 210 C80 174 101 150 126 147 H134 C160 150 181 174 186 210 Z" fill={`url(#${idPrefix}-jacket)`} />
          <path d="M104 154 L130 178 L156 154 L166 210 H94 Z" fill="#ffffff" opacity="0.96" />
          <path d="M94 158 L126 184 L101 210 H72 C77 184 84 168 94 158 Z" fill={`url(#${idPrefix}-jacket)`} />
          <path d="M166 158 L134 184 L159 210 H188 C183 184 176 168 166 158 Z" fill={`url(#${idPrefix}-jacket)`} />
          <path d="M113 137 C115 153 122 160 130 160 C138 160 145 153 147 137 Z" fill={portrait.skinShadow} opacity="0.78" />

          <ellipse cx="92" cy="110" rx="12" ry="17" fill={`url(#${idPrefix}-skin)`} />
          <ellipse cx="168" cy="110" rx="12" ry="17" fill={`url(#${idPrefix}-skin)`} />
          <path d="M86 93 C86 55 104 32 130 32 C156 32 174 55 174 93 V107 C174 138 156 158 130 158 C104 158 86 138 86 107 Z" fill={`url(#${idPrefix}-skin)`} />
          <path d="M86 95 C88 58 105 34 130 32 C155 32 174 56 174 96 C158 91 143 80 132 59 C119 78 103 91 86 95 Z" fill={`url(#${idPrefix}-hair)`} />
          <path d="M86 96 C101 91 118 78 132 58 C146 80 159 91 174 96 C171 64 154 36 130 36 C106 36 90 62 86 96 Z" fill={`url(#${idPrefix}-hair)`} opacity="0.88" />

          <path d="M100 102 C108 98 117 98 124 102" stroke={portrait.hairShadow} strokeWidth="4" strokeLinecap="round" opacity="0.72" />
          <path d="M137 102 C145 98 154 98 162 102" stroke={portrait.hairShadow} strokeWidth="4" strokeLinecap="round" opacity="0.72" />
          <ellipse cx="114" cy="116" rx="5.5" ry="7" fill="#263445" opacity="0.9" />
          <ellipse cx="148" cy="116" rx="5.5" ry="7" fill="#263445" opacity="0.9" />
          <circle cx="116" cy="113" r="1.6" fill="#fff" opacity="0.8" />
          <circle cx="150" cy="113" r="1.6" fill="#fff" opacity="0.8" />
          <path d="M131 116 C128 125 128 131 136 133" stroke={portrait.skinShadow} strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.46" />
          <path d="M115 141 C124 148 139 148 148 141" stroke="#6f3c25" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.54" />
          <path d="M102 129 C108 132 114 132 119 129" stroke={portrait.skinShadow} strokeWidth="2" strokeLinecap="round" opacity="0.18" />
          <path d="M158 129 C152 132 146 132 141 129" stroke={portrait.skinShadow} strokeWidth="2" strokeLinecap="round" opacity="0.18" />
        </g>
        <rect width="260" height="210" fill={`url(#${idPrefix}-sheen)`} opacity="0.34" />
      </svg>
      <div className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
        #{portrait.number}
      </div>
      <div className="absolute right-2 top-2 rounded bg-white/85 px-1.5 py-0.5 text-[10px] font-bold text-text-primary shadow">
        {portrait.rating}
      </div>
    </div>
  );
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
  const [trainingDrafts, setTrainingDrafts] = useState<Record<string, string>>({});
  const [trainingSaving, setTrainingSaving] = useState(false);
  const [trainingSavedAt, setTrainingSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/settings/agents")
      .then((r) => r.json())
      .then((data: AgentsResponse) => {
        setCategories(data.categories?.length ? data.categories : FALLBACK_CATEGORIES);
        setAgents(data.agents ?? []);
        setActiveAgentName((current) => current ?? data.agents?.[0]?.name ?? null);
        setTrainingDrafts(
          Object.fromEntries((data.agents ?? []).map((agent) => [agent.name, agent.trainingNotes ?? ""]))
        );
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
  const activeTrainingDraft = activeAgent ? trainingDrafts[activeAgent.name] ?? activeAgent.trainingNotes ?? "" : "";

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

  async function saveTrainingNotes() {
    if (!activeAgent || trainingSaving) return;

    setTrainingSaving(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/agents/${activeAgent.name}/training`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: activeTrainingDraft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Training save failed");

      setAgents((prev) =>
        prev.map((agent) =>
          agent.name === activeAgent.name
            ? {
                ...agent,
                trainingNotes: data.trainingNotes ?? activeTrainingDraft,
                trainingUpdatedAt: data.trainingUpdatedAt ?? new Date().toISOString(),
                trainingUpdatedBy: data.trainingUpdatedBy ?? "Current user",
              }
            : agent
        )
      );
      setTrainingSavedAt(new Date().toISOString());
    } catch (trainingError) {
      const messageText = trainingError instanceof Error ? trainingError.message : "Training save failed";
      setError(`${activeAgent.label} training could not be saved. ${messageText}`);
    } finally {
      setTrainingSaving(false);
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
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
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {categoryAgents.map((agent) => {
                    const selected = activeAgent?.name === agent.name;
                    const disabled = agent.status === "planned" || !agent.enabled;
                    const portrait = getCardPortrait(agent);

                    return (
                      <article
                        key={agent.name}
                        className={`group overflow-hidden rounded-lg border bg-white p-2 shadow-sm transition-all ${
                          selected
                            ? "border-nah-blue ring-2 ring-nah-blue/10"
                            : "border-border-default hover:-translate-y-0.5 hover:border-border-hover hover:shadow-md"
                        }`}
                      >
                        <div
                          className="rounded-md border border-border-default bg-bg-primary p-3"
                          style={{
                            backgroundImage: `linear-gradient(135deg, ${portrait.background}, #ffffff 52%, ${portrait.background})`,
                          }}
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="rounded bg-black px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                              FranDev AI
                            </div>
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusStyle[agent.status]}`}>
                              {agent.status.replace("-", " ")}
                            </span>
                          </div>

                          <button type="button" onClick={() => setActiveAgentName(agent.name)} className="block w-full">
                            <AgentBaseballPortrait agent={agent} />
                          </button>

                          <div className="mt-3 rounded-md bg-white/90 p-3 shadow-sm">
                            <button
                              type="button"
                              onClick={() => setActiveAgentName(agent.name)}
                              className="block min-w-0 text-left"
                            >
                              <h4 className="font-headline text-[22px] leading-tight text-text-primary">{agent.label}</h4>
                              <p className="mt-0.5 text-caption font-medium uppercase tracking-wide text-text-tertiary">
                                {agent.roleTitle}
                              </p>
                            </button>

                            <p className="mt-3 min-h-[40px] text-body-sm text-text-secondary">{agent.mission}</p>
                          </div>

                          <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-md border border-border-default bg-white text-center">
                            <div className="border-r border-border-default px-2 py-2">
                              <div className="text-[10px] font-bold uppercase tracking-wide text-text-tertiary">Runs</div>
                              <div className="text-body-sm font-black text-text-primary">{metricLabel(agent.runsMTD)}</div>
                            </div>
                            <div className="border-r border-border-default px-2 py-2">
                              <div className="text-[10px] font-bold uppercase tracking-wide text-text-tertiary">Sugs</div>
                              <div className="text-body-sm font-black text-text-primary">{metricLabel(agent.suggestionsMTD)}</div>
                            </div>
                            <div className="px-2 py-2">
                              <div className="text-[10px] font-bold uppercase tracking-wide text-text-tertiary">Trust</div>
                              <div className="truncate text-[11px] font-black text-text-primary">{trustLabel[agent.trustLevel]}</div>
                            </div>
                          </div>

                          <div className="mt-3 space-y-2 rounded-md border border-border-default bg-white/75 p-3 text-caption text-text-secondary">
                            <div className="flex items-start gap-2">
                              <Sparkles size={13} className="mt-0.5 flex-shrink-0 text-nah-orange" />
                              <span>{agent.trigger}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <ShieldCheck size={13} className="mt-0.5 flex-shrink-0 text-nah-blue" />
                              <span>{agent.guardrails[0]}</span>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveAgentName(agent.name)}
                              className="flex items-center gap-1.5 rounded-md border border-border-default bg-white px-3 py-2 text-caption font-bold text-text-primary hover:bg-bg-hover"
                            >
                              <MessageSquareText size={13} />
                              Ask
                            </button>
                            <button
                              type="button"
                              onClick={() => triggerAgent(agent)}
                              disabled={disabled || !agent.manualRun || triggering === agent.name}
                              className="flex items-center gap-1.5 rounded-md bg-nah-blue px-3 py-2 text-caption font-bold text-white hover:bg-nah-blue-hover disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {triggering === agent.name ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                              Run
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleAgent(agent.name, !agent.enabled)}
                              disabled={agent.status === "planned"}
                              aria-label={`${agent.enabled ? "Disable" : "Enable"} ${agent.label}`}
                              className={`relative ml-auto h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
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

                          <div className="mt-2 text-right text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
                            Last run: {formatDate(agent.lastRunAt)}
                          </div>
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
                <AgentBaseballPortrait agent={activeAgent} compact />
                <div>
                  <h3 className="text-card-title text-text-primary">{activeAgent.label}</h3>
                  <p className="text-caption text-text-tertiary">{activeAgent.roleTitle}</p>
                  <p className="mt-2 text-caption text-text-secondary">{activeAgent.description}</p>
                  {activeAgent.trainingUpdatedAt ? (
                    <p className="mt-2 text-[11px] font-medium text-text-tertiary">
                      Trained {formatDate(activeAgent.trainingUpdatedAt)}
                      {activeAgent.trainingUpdatedBy ? ` by ${activeAgent.trainingUpdatedBy}` : ""}
                    </p>
                  ) : null}
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
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wide text-text-tertiary">
                      <Sparkles size={13} />
                      Train this agent
                    </div>
                    <span className="text-[11px] text-text-tertiary">{activeTrainingDraft.length}/8000</span>
                  </div>
                  <p className="mt-2 text-caption text-text-secondary">
                    Add corrections, rules, examples, tone preferences, and things this agent should remember before it answers.
                  </p>
                  <textarea
                    value={activeTrainingDraft}
                    maxLength={8000}
                    onChange={(event) =>
                      activeAgent &&
                      setTrainingDrafts((prev) => ({ ...prev, [activeAgent.name]: event.target.value }))
                    }
                    placeholder={`Teach ${activeAgent.label} how to think. Example: When reviewing runway, always explain the MasterSuite evidence first.`}
                    className="mt-3 min-h-[130px] w-full resize-y rounded-md border border-border-default bg-bg-primary px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-nah-blue"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-text-tertiary">
                      {trainingSavedAt ? `Saved ${formatDate(trainingSavedAt)}` : "Saved notes are injected into this agent's chat context."}
                    </div>
                    <button
                      type="button"
                      onClick={saveTrainingNotes}
                      disabled={trainingSaving || activeTrainingDraft === (activeAgent.trainingNotes ?? "")}
                      className="flex items-center gap-1.5 rounded-md bg-nah-blue px-3 py-2 text-caption font-bold text-white hover:bg-nah-blue-hover disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {trainingSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      Save training
                    </button>
                  </div>
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
