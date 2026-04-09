"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Settings, User, Bell, Shield, Database, Zap, CheckCircle2, XCircle, ExternalLink, GitBranch, Calendar, Sliders, Phone } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import PipelineEditor from "@/components/settings/PipelineEditor";
import CronCalendar from "@/components/settings/CronCalendar";
import AppSettingsPanel from "@/components/settings/AppSettingsPanel";
import CallTypesRubricEditor from "@/components/settings/CallTypesRubricEditor";
import IntegrationsPanel from "@/components/settings/IntegrationsPanel";
import AgentsPanel from "@/components/settings/AgentsPanel";

interface SetupItem {
  label: string;
  done: boolean;
  detail: string;
}

interface IntegrationStatus {
  ghl: { connected: boolean; method: string; connectedAt: string | null };
  anthropic: { connected: boolean };
  whisper: { connected: boolean };
  health?: { customFieldsCached: number; pipelinesCached: number; knowledgeDocs: number; activeAlerts: number; totalUsers: number };
  setup?: { checklist: SetupItem[]; complete: number; total: number; ready: boolean };
}

type SettingsTab = "general" | "pipelines" | "call-types" | "cron" | "app-settings" | "integrations" | "agents";

export default function SettingsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  // Check for OAuth callback messages
  const crmStatus = searchParams.get("crm");
  const crmError = searchParams.get("error");

  useEffect(() => {
    fetch("/api/settings/integrations")
      .then((res) => res.json())
      .then((data: IntegrationStatus) => setIntegrations(data))
      .catch(() => {});
  }, []);

  const TABS: { key: SettingsTab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { key: "general", label: "General", icon: Settings },
    { key: "pipelines", label: "Pipeline Editor", icon: GitBranch },
    { key: "call-types", label: "Call Types & Rubrics", icon: Phone },
    { key: "cron", label: "Cron Calendar", icon: Calendar },
    { key: "app-settings", label: "App Settings", icon: Sliders },
    { key: "integrations", label: "Integrations", icon: Zap },
    { key: "agents", label: "Agents", icon: Database },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Settings size={20} className="text-nah-blue" />
        <h1 className="font-headline text-page-title text-text-primary">Settings</h1>
      </div>

      {/* Settings tabs */}
      <div className="flex border-b border-border-default mb-6">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-body-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-nah-orange text-nah-orange"
                  : "border-transparent text-text-tertiary hover:text-text-primary"
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "pipelines" ? (
        <PipelineEditor />
      ) : activeTab === "call-types" ? (
        <CallTypesRubricEditor />
      ) : activeTab === "cron" ? (
        <CronCalendar />
      ) : activeTab === "app-settings" ? (
        <AppSettingsPanel />
      ) : activeTab === "integrations" ? (
        <IntegrationsPanel />
      ) : activeTab === "agents" ? (
        <AgentsPanel />
      ) : (
      <div>

      {/* OAuth callback messages */}
      {crmStatus === "connected" && (
        <div className="mb-4 px-3 py-2 bg-success/10 border border-success/20 rounded-lg">
          <p className="text-body-sm text-success">GoHighLevel connected successfully.</p>
        </div>
      )}
      {crmError === "crm_auth_failed" && (
        <div className="mb-4 px-3 py-2 bg-danger/10 border border-danger/20 rounded-lg">
          <p className="text-body-sm text-danger">
            GHL connection failed. Check your GHL credentials and try again.
          </p>
        </div>
      )}

      {/* Setup Checklist */}
      {integrations?.setup && !integrations.setup.ready && (
        <div className="mb-6 p-4 bg-warning/5 border border-warning/20 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Settings size={16} className="text-warning" />
            <h2 className="text-h3 text-text-primary">Setup Checklist</h2>
            <span className="text-caption text-text-tertiary ml-auto">
              {integrations.setup.complete}/{integrations.setup.total} complete
            </span>
          </div>
          <div className="space-y-2">
            {integrations.setup.checklist.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                {item.done ? (
                  <CheckCircle2 size={14} className="text-success flex-shrink-0" />
                ) : (
                  <XCircle size={14} className="text-danger flex-shrink-0" />
                )}
                <span className={`text-body-sm ${item.done ? "text-text-secondary" : "text-text-primary font-medium"}`}>
                  {item.label}
                </span>
                <span className="text-caption text-text-tertiary ml-auto">{item.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {integrations?.setup?.ready && (
        <div className="mb-6 px-3 py-2 bg-success/10 border border-success/20 rounded-lg">
          <p className="text-body-sm text-success">All systems configured and ready.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <User size={16} className="text-text-secondary" />
            <h2 className="text-h3 text-text-primary">Profile</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-caption text-text-tertiary">Name</label>
              <p className="text-body text-text-primary">{user?.fullName ?? "—"}</p>
            </div>
            <div>
              <label className="text-caption text-text-tertiary">Email</label>
              <p className="text-body text-text-primary">{user?.email ?? "—"}</p>
            </div>
            <div>
              <label className="text-caption text-text-tertiary">Role</label>
              <p className="text-body text-text-primary">{user?.role === "leadership" ? "Admin" : (user?.role ?? "—")}</p>
            </div>
            <div>
              <label className="text-caption text-text-tertiary">GHL User ID</label>
              <p className="text-body text-text-primary">{user?.ghlUserId ?? "Not linked"}</p>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={16} className="text-text-secondary" />
            <h2 className="text-h3 text-text-primary">Notifications</h2>
            <span className="badge-info ml-auto">Coming Soon</span>
          </div>
          <p className="text-body-sm text-text-tertiary">
            Notification preferences will be configurable here. Includes alert
            thresholds, email notifications, and Slack integration.
          </p>
        </div>

        {/* Security */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-text-secondary" />
            <h2 className="text-h3 text-text-primary">Security</h2>
          </div>
          <button className="btn-secondary text-body-sm" disabled>
            Change Password
          </button>
          <p className="text-caption text-text-tertiary mt-2">
            Password changes are handled through Supabase Auth.
          </p>
        </div>

        {/* Integrations */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-text-secondary" />
            <h2 className="text-h3 text-text-primary">Integrations</h2>
          </div>
          <div className="space-y-3">
            {/* GoHighLevel */}
            <div className="p-3 rounded-md bg-bg-primary/50 border border-border-default">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database size={14} className="text-text-tertiary" />
                  <span className="text-body-sm text-text-primary font-medium">GoHighLevel</span>
                </div>
                {integrations?.ghl.connected ? (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-success" />
                    <span className="text-caption text-success">
                      {integrations.ghl.method === "oauth" ? "OAuth" : "API Key"}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <XCircle size={14} className="text-danger" />
                    <span className="text-caption text-danger">Not Connected</span>
                  </div>
                )}
              </div>
              {integrations?.ghl.connectedAt && (
                <p className="text-caption text-text-tertiary mt-1">
                  Connected {new Date(integrations.ghl.connectedAt).toLocaleDateString()}
                </p>
              )}
              {!integrations?.ghl.connected && (
                <a
                  href="/api/auth/crm"
                  className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-md bg-nah-orange text-white text-caption font-medium hover:bg-nah-orange/90 transition-colors"
                >
                  Connect GHL
                  <ExternalLink size={12} />
                </a>
              )}
              {integrations?.ghl.connected && integrations.ghl.method === "api_key" && (
                <a
                  href="/api/auth/crm"
                  className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-md bg-bg-tertiary text-text-secondary text-caption font-medium hover:bg-bg-hover transition-colors"
                >
                  Upgrade to OAuth
                  <ExternalLink size={12} />
                </a>
              )}
            </div>

            {/* Anthropic */}
            <div className="p-3 rounded-md bg-bg-primary/50 border border-border-default">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-scout-purple" />
                  <span className="text-body-sm text-text-primary font-medium">Anthropic (Scout AI)</span>
                </div>
                {integrations?.anthropic.connected ? (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-success" />
                    <span className="text-caption text-success">Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <XCircle size={14} className="text-danger" />
                    <span className="text-caption text-danger">No API Key</span>
                  </div>
                )}
              </div>
              {!integrations?.anthropic.connected && (
                <p className="text-caption text-text-tertiary mt-1">
                  Set ANTHROPIC_API_KEY in environment variables
                </p>
              )}
            </div>

            {/* Whisper */}
            <div className="p-3 rounded-md bg-bg-primary/50 border border-border-default">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-info" />
                  <span className="text-body-sm text-text-primary font-medium">Whisper (Voice Input)</span>
                </div>
                {integrations?.whisper.connected ? (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-success" />
                    <span className="text-caption text-success">Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <XCircle size={14} className="text-danger" />
                    <span className="text-caption text-danger">No API Key</span>
                  </div>
                )}
              </div>
              {!integrations?.whisper.connected && (
                <p className="text-caption text-text-tertiary mt-1">
                  Set OPENAI_API_KEY in environment variables
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
      )}
    </div>
  );
}
