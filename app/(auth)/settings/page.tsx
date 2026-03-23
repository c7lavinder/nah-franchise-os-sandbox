"use client";

import { Settings, User, Bell, Shield, Database, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

/** Settings page — user profile and app configuration */
export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Settings size={20} className="text-nah-orange" />
        <h1 className="text-h1 text-text-primary">Settings</h1>
      </div>

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
              <p className="text-body text-text-primary capitalize">{user?.role ?? "—"}</p>
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
            Password changes are handled through Supabase Auth. Full password
            management coming in Phase 1.
          </p>
        </div>

        {/* Integrations */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-text-secondary" />
            <h2 className="text-h3 text-text-primary">Integrations</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded-md bg-bg-primary/50 border border-border-default">
              <div className="flex items-center gap-2">
                <Database size={14} className="text-text-tertiary" />
                <span className="text-body-sm text-text-primary">GoHighLevel</span>
              </div>
              <span className="badge-warning">Not Connected</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-md bg-bg-primary/50 border border-border-default">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-text-tertiary" />
                <span className="text-body-sm text-text-primary">Anthropic (Scout AI)</span>
              </div>
              <span className="badge-warning">Not Connected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
