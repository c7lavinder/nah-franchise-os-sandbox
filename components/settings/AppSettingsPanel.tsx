"use client";

/**
 * AppSettingsPanel — pipeline thresholds and GHL sync configuration.
 * Reads/writes pipeline_app_settings (id=1).
 */

import { useState, useEffect } from "react";
import { Loader2, Save, AlertTriangle, Sliders } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

interface AppSettings {
  time_in_stage_yellow_days: number;
  time_in_stage_red_days: number;
  ghl_sync_enabled: boolean;
  ghl_sync_queue_alert_threshold: number;
}

export default function AppSettingsPanel() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === "leadership";
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  useEffect(() => {
    fetch("/api/settings/app-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.settings) setSettings(d.settings); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/settings/app-settings", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ ...settings, userId: user?.id }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
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
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-8">
        <p className="text-body-sm text-text-tertiary">App settings not configured. Insert a row into pipeline_app_settings with id=1.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      {!isAdmin && (
        <div className="mb-4 px-3 py-2 bg-warning/10 border border-warning/20 rounded-lg flex items-center gap-2">
          <AlertTriangle size={14} className="text-warning" />
          <span className="text-body-sm text-warning font-medium">Admin access required to edit settings</span>
        </div>
      )}

      <div className="space-y-5">
        {/* Time-in-stage thresholds */}
        <div>
          <h3 className="text-overline text-text-tertiary tracking-wider mb-3">TIME-IN-STAGE THRESHOLDS</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-caption text-text-tertiary mb-1">
                Yellow / At Risk (days)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={settings.time_in_stage_yellow_days}
                onChange={(e) => setSettings({ ...settings, time_in_stage_yellow_days: parseInt(e.target.value) || 5 })}
                disabled={!isAdmin}
                className="w-24 bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-caption text-text-tertiary mb-1">
                Red / Losing (days)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={settings.time_in_stage_red_days}
                onChange={(e) => setSettings({ ...settings, time_in_stage_red_days: parseInt(e.target.value) || 10 })}
                disabled={!isAdmin}
                className="w-24 bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* GHL Sync */}
        <div>
          <h3 className="text-overline text-text-tertiary tracking-wider mb-3">GHL SYNC</h3>

          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.ghl_sync_enabled}
                onChange={(e) => setSettings({ ...settings, ghl_sync_enabled: e.target.checked })}
                disabled={!isAdmin}
                className="w-4 h-4 rounded border-border-default text-nah-blue"
              />
              <span className="text-body-sm text-text-primary">GHL sync enabled</span>
            </label>

            <div>
              <label className="block text-caption text-text-tertiary mb-1">
                Sync queue alert threshold
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={settings.ghl_sync_queue_alert_threshold}
                onChange={(e) => setSettings({ ...settings, ghl_sync_queue_alert_threshold: parseInt(e.target.value) || 50 })}
                disabled={!isAdmin}
                className="w-24 bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary disabled:opacity-50"
              />
              <p className="text-[10px] text-text-tertiary mt-1">Alert when queue exceeds this many pending items</p>
            </div>
          </div>
        </div>
      </div>

      {/* Save */}
      {isAdmin && (
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="btn-primary px-4 py-2 text-body-sm flex items-center gap-1"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Settings
          </button>
          {saved && <span className="text-caption text-success">Saved</span>}
          {error && <span className="text-caption text-danger">{error}</span>}
        </div>
      )}
    </div>
  );
}
