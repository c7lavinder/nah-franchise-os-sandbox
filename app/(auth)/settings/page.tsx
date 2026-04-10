"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Settings, Users, GitBranch, Phone, Zap, Sliders, Bot,
  CheckCircle2, XCircle, ExternalLink, Database, Shield, Bell, User,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import PipelineEditor from "@/components/settings/PipelineEditor";
import AppSettingsPanel from "@/components/settings/AppSettingsPanel";
import CallTypesRubricEditor from "@/components/settings/CallTypesRubricEditor";
import IntegrationsPanel from "@/components/settings/IntegrationsPanel";
import AutomationPanel from "@/components/settings/AutomationPanel";
import UsersPanel from "@/components/settings/UsersPanel";
import LeadSourcesPanel from "@/components/settings/LeadSourcesPanel";

interface SetupItem {
  label: string;
  done: boolean;
  detail: string;
}

interface IntegrationStatus {
  ghl: { connected: boolean; method: string; connectedAt: string | null };
  anthropic: { connected: boolean };
  whisper: { connected: boolean };
  setup?: { checklist: SetupItem[]; complete: number; total: number; ready: boolean };
}

type SettingsTab = "general" | "users" | "pipelines" | "call-types" | "lead-sources" | "automation" | "app-settings" | "integrations";

export default function SettingsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

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
    { key: "users", label: "Users", icon: Users },
    { key: "pipelines", label: "Pipelines", icon: GitBranch },
    { key: "call-types", label: "Call Types", icon: Phone },
    { key: "lead-sources", label: "Lead Sources", icon: Database },
    { key: "automation", label: "Automation", icon: Bot },
    { key: "app-settings", label: "App Settings", icon: Sliders },
    { key: "integrations", label: "Integrations", icon: Zap },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Settings size={20} className="text-nah-blue" />
        <h1 className="font-headline text-page-title text-text-primary">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-default mb-6 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-body-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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

      {/* Tab content */}
      {activeTab === "users" ? (
        <UsersPanel />
      ) : activeTab === "pipelines" ? (
        <PipelineEditor />
      ) : activeTab === "call-types" ? (
        <CallTypesRubricEditor />
      ) : activeTab === "lead-sources" ? (
        <LeadSourcesPanel />
      ) : activeTab === "automation" ? (
        <AutomationPanel />
      ) : activeTab === "app-settings" ? (
        <AppSettingsPanel />
      ) : activeTab === "integrations" ? (
        <IntegrationsPanel />
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

        {/* Quick Integration Status — only render after data loads */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-text-secondary" />
            <h2 className="text-h3 text-text-primary">Integration Status</h2>
          </div>
          {!integrations ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-5 bg-bg-tertiary rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database size={14} className="text-text-tertiary" />
                    <span className="text-body-sm text-text-primary">GoHighLevel</span>
                  </div>
                  {integrations.ghl.connected ? (
                    <span className="flex items-center gap-1 text-caption text-success"><CheckCircle2 size={12} /> {integrations.ghl.method === "oauth" ? "OAuth" : "API Key"}</span>
                  ) : (
                    <span className="flex items-center gap-1 text-caption text-danger"><XCircle size={12} /> Not Connected</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-scout-purple" />
                    <span className="text-body-sm text-text-primary">Anthropic (Scout AI)</span>
                  </div>
                  {integrations.anthropic.connected ? (
                    <span className="flex items-center gap-1 text-caption text-success"><CheckCircle2 size={12} /> Connected</span>
                  ) : (
                    <span className="flex items-center gap-1 text-caption text-danger"><XCircle size={12} /> No API Key</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-info" />
                    <span className="text-body-sm text-text-primary">Whisper</span>
                  </div>
                  {integrations.whisper.connected ? (
                    <span className="flex items-center gap-1 text-caption text-success"><CheckCircle2 size={12} /> Connected</span>
                  ) : (
                    <span className="flex items-center gap-1 text-caption text-danger"><XCircle size={12} /> No API Key</span>
                  )}
                </div>
              </div>
              {!integrations.ghl.connected && (
                <a href="/api/auth/crm" className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-md bg-nah-orange text-white text-caption font-medium hover:bg-nah-orange/90 transition-colors">
                  Connect GHL <ExternalLink size={12} />
                </a>
              )}
            </>
          )}
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

        {/* Notifications */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={16} className="text-text-secondary" />
            <h2 className="text-h3 text-text-primary">Notifications</h2>
            <span className="badge-info ml-auto">Coming Soon</span>
          </div>
          <p className="text-body-sm text-text-tertiary">
            Alert thresholds, email, and Slack notifications will be configurable here.
          </p>
        </div>
      </div>
      </div>
      )}
    </div>
  );
}
