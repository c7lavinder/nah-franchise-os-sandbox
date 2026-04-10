"use client";

/**
 * AppSettingsPanel — pipeline thresholds, GHL sync, Scout model config,
 * notification preferences, and system health.
 */

import { useState, useEffect } from "react";
import { Loader2, Save, AlertTriangle, Sliders, Brain, Bell, Database, Activity } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useToast } from "@/components/ui/Toast";

interface AppSettings {
  time_in_stage_yellow_days: number;
  time_in_stage_red_days: number;
  ghl_sync_enabled: boolean;
  ghl_sync_queue_alert_threshold: number;
}

interface SystemHealth {
  totalContacts: number;
  totalTerritories: number;
  activeUsers: number;
  kbDocuments: number;
  pendingSuggestions: number;
}

export default function AppSettingsPanel({ variant }: { variant?: "data" | "full" } = {}) {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "leadership";
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scoutModel = process.env.NEXT_PUBLIC_SCOUT_MODEL ?? "claude-sonnet-4-6-20250514";
  const agentModel = "claude-haiku-4-5-20251001";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/app-settings").then((r) => r.ok ? r.json() : null),
      fetch("/api/settings/health").then((r) => r.ok ? r.json() : null),
    ])
      .then(([settingsData, healthData]) => {
        if (settingsData?.settings) setSettings(settingsData.settings);
        if (healthData) setHealth(healthData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/app-settings", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ ...settings, userId: user?.id }),
      });
      if (res.ok) {
        toast("Settings saved");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save");
      }
    } catch {
      setError("Network error");
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-text-tertiary" /></div>;
  }

  // "data" variant: only Pipeline Thresholds + GHL Sync (used in Data Management tab)
  if (variant === "data") {
    return (
      <div className="space-y-6">
        {!isAdmin && (
          <div className="px-3 py-2 bg-warning/10 border border-warning/20 rounded-lg flex items-center gap-2">
            <AlertTriangle size={14} className="text-warning" />
            <span className="text-body-sm text-warning font-medium">Admin access required to edit</span>
          </div>
        )}

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Sliders size={16} className="text-text-secondary" />
            <h3 className="text-h3 text-text-primary">Pipeline Thresholds</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-caption text-text-tertiary mb-1">Yellow / At Risk (days)</label>
              <input type="number" min={1} max={30} value={settings?.time_in_stage_yellow_days ?? 5}
                onChange={(e) => settings && setSettings({ ...settings, time_in_stage_yellow_days: parseInt(e.target.value) || 5 })}
                disabled={!isAdmin} className="w-24 bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary disabled:opacity-50" />
              <p className="text-[10px] text-text-tertiary mt-1">Contacts idle this many days turn yellow</p>
            </div>
            <div>
              <label className="block text-caption text-text-tertiary mb-1">Red / Losing (days)</label>
              <input type="number" min={1} max={60} value={settings?.time_in_stage_red_days ?? 10}
                onChange={(e) => settings && setSettings({ ...settings, time_in_stage_red_days: parseInt(e.target.value) || 10 })}
                disabled={!isAdmin} className="w-24 bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary disabled:opacity-50" />
              <p className="text-[10px] text-text-tertiary mt-1">Contacts idle this many days turn red</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Database size={16} className="text-text-secondary" />
            <h3 className="text-h3 text-text-primary">GHL Sync</h3>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={settings?.ghl_sync_enabled ?? false}
                onChange={(e) => settings && setSettings({ ...settings, ghl_sync_enabled: e.target.checked })}
                disabled={!isAdmin} className="w-4 h-4 rounded border-border-default text-nah-blue" />
              <span className="text-body-sm text-text-primary">Stage write-back enabled</span>
            </label>
            <div>
              <label className="block text-caption text-text-tertiary mb-1">Queue alert threshold</label>
              <input type="number" min={1} max={1000} value={settings?.ghl_sync_queue_alert_threshold ?? 50}
                onChange={(e) => settings && setSettings({ ...settings, ghl_sync_queue_alert_threshold: parseInt(e.target.value) || 50 })}
                disabled={!isAdmin} className="w-24 bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary disabled:opacity-50" />
            </div>
          </div>
        </div>

        {isAdmin && settings && (
          <div className="flex items-center gap-3">
            <button onClick={() => void handleSave()} disabled={saving} className="btn-primary px-4 py-2 text-body-sm flex items-center gap-1">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Settings
            </button>
            {error && <span className="text-caption text-danger">{error}</span>}
          </div>
        )}
      </div>
    );
  }

  // Full variant (legacy — no longer used from settings page but kept for compatibility)
  return null;
}

function HealthRow({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border-default last:border-0">
      <span className="text-body-sm text-text-secondary">{label}</span>
      <span className={`text-body-sm font-medium ${warn ? "text-warning" : "text-text-primary"}`}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}
