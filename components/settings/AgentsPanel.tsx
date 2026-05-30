"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useEffect } from "react";
import { Bot, Play, Loader2 } from "lucide-react";

interface AgentInfo {
  name: string;
  label: string;
  trigger: string;
  description?: string;
  enabled: boolean;
  runsMTD: number;
  suggestionsMTD: number;
  costEstMTD: string;
}

const AGENT_DEFS = [
  { name: "post-call", label: "Post-Call Agent", trigger: "Read.ai webhook (auto), Generate button (manual)" },
  { name: "contact-research", label: "Contact Research", trigger: "New contact, Research button, 30-day cron" },
  { name: "territory-market", label: "Territory Market", trigger: "Territory presented, Research button, 30-day cron" },
  { name: "pre-call-brief", label: "Pre-Call Brief", trigger: "Call scheduled, daily 7am cron" },
  { name: "reengagement-signal", label: "Re-engagement Signal", trigger: "Monthly cron (1st of month)" },
  { name: "journey-brief", label: "Journey Brief", trigger: "Stage change, call graded, property sync, nightly cron" },
  {
    name: "data-intelligence",
    label: "Data Intelligence",
    trigger: "Manual data coverage audit, future weekly cron",
    description: "Understands what data exists, where it is stored, and how Scout should retrieve it.",
  },
];

export default function AgentsPanel() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/settings/agents")
      .then((r) => r.json())
      .then((d) => setAgents(d.agents ?? []))
      .catch(() => {
        // Fallback: show static list with zero counts
        setAgents(
          AGENT_DEFS.map((a) => ({
            ...a,
            enabled: true,
            runsMTD: 0,
            suggestionsMTD: 0,
            costEstMTD: "$0.00",
          }))
        );
      })
      .finally(() => setLoading(false));
  }, []);

  async function toggleAgent(name: string, enabled: boolean) {
    setAgents((prev) => prev.map((a) => (a.name === name ? { ...a, enabled } : a)));
    try {
      await apiFetch("/api/settings/agents/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName: name, enabled }),
      });
    } catch {
      /* silent */
    }
  }

  async function triggerAgent(name: string) {
    setTriggering(name);
    try {
      // Map agent name to trigger endpoint
      const endpoints: Record<string, { url: string; method: string }> = {
        "post-call": { url: "/api/agents/post-call/run", method: "POST" },
        "contact-research": { url: "/api/cron/research-contacts", method: "GET" },
        "territory-market": { url: "/api/cron/research-territories", method: "GET" },
        "pre-call-brief": { url: "/api/cron/pre-call-briefs", method: "GET" },
        "reengagement-signal": { url: "/api/cron/reengagement-scan", method: "GET" },
        "journey-brief": { url: "/api/cron/generate-briefs", method: "POST" },
        "data-intelligence": { url: "/api/agents/data-intelligence/run", method: "POST" },
      };
      const ep = endpoints[name];
      if (ep) await fetch(ep.url, { method: ep.method });
    } catch {
      /* silent */
    }
    setTriggering(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-caption text-text-tertiary mb-4">
        All agents use claude-haiku-4-5. Cost is estimated at ~$0.002/run.
      </p>
      {agents.map((agent) => (
        <div key={agent.name} className="border border-border-default rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Bot size={18} className="text-scout-purple flex-shrink-0" />
            <div className="flex-1">
              <div className="text-body-sm font-medium text-text-primary">{agent.label}</div>
              <div className="text-caption text-text-tertiary">{agent.trigger}</div>
              {agent.description && <div className="text-caption text-text-secondary mt-1">{agent.description}</div>}
            </div>

            {/* Toggle */}
            <button
              onClick={() => toggleAgent(agent.name, !agent.enabled)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                agent.enabled ? "bg-green-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  agent.enabled ? "left-5" : "left-0.5"
                }`}
              />
            </button>

            {/* Manual trigger */}
            <button
              onClick={() => triggerAgent(agent.name)}
              disabled={triggering === agent.name || !agent.enabled}
              className="flex items-center gap-1 px-2 py-1 rounded text-caption font-medium bg-bg-secondary hover:bg-bg-hover disabled:opacity-50"
            >
              {triggering === agent.name ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              Run
            </button>
          </div>

          {/* Stats */}
          <div className="flex gap-6 mt-3 text-caption text-text-tertiary">
            <span>
              Runs MTD: <span className="text-text-primary font-medium">{agent.runsMTD}</span>
            </span>
            <span>
              Suggestions MTD: <span className="text-text-primary font-medium">{agent.suggestionsMTD}</span>
            </span>
            <span>
              Cost est.: <span className="text-text-primary font-medium">{agent.costEstMTD}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
