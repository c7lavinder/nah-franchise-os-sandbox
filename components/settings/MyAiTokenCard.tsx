"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, Key, RefreshCw, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/auth/api-fetch";

interface AiToken {
  id: string;
  token_prefix: string;
  scope: "AI_READ_ONLY";
  last_used_at: string | null;
  created_at: string;
}

export default function MyAiTokenCard() {
  const [token, setToken] = useState<AiToken | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchToken();
  }, []);

  async function fetchToken() {
    const res = await apiFetch("/api/settings/me/ai-token");
    if (!res.ok) return;
    const data = await res.json();
    setToken(data.token ?? null);
  }

  async function rotateToken() {
    setBusy(true);
    setCopied(false);
    const res = await apiFetch("/api/settings/me/ai-token", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setToken(data.token);
      setSecret(data.secret);
      setRevealed(false);
    }
    setBusy(false);
  }

  async function revokeToken() {
    setBusy(true);
    const res = await apiFetch("/api/settings/me/ai-token", { method: "DELETE" });
    if (res.ok) {
      setToken(null);
      setSecret(null);
      setRevealed(false);
      setCopied(false);
    }
    setBusy(false);
  }

  async function copyToken() {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const displayValue = secret
    ? revealed
      ? secret
      : "••••••••••••••••••••••••"
    : token
      ? `${token.token_prefix}...`
      : "No token";

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Key size={16} className="text-text-secondary" />
        <h2 className="text-h3 text-text-primary">AI Access Token</h2>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-caption text-text-tertiary">Scope</label>
          <p className="text-body text-text-primary">AI_READ_ONLY</p>
        </div>
        <div>
          <label className="text-caption text-text-tertiary">Token</label>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate rounded border border-border-default bg-bg-secondary px-2 py-1.5 text-xs text-text-secondary">
              {displayValue}
            </code>
            {secret && (
              <>
                <button
                  type="button"
                  onClick={() => setRevealed((value) => !value)}
                  className="p-1.5 text-text-tertiary hover:text-text-primary"
                  title={revealed ? "Hide token" : "Reveal token"}
                >
                  {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button
                  type="button"
                  onClick={copyToken}
                  className="p-1.5 text-text-tertiary hover:text-nah-blue"
                  title="Copy token"
                >
                  {copied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
                </button>
              </>
            )}
          </div>
        </div>
        {token?.last_used_at && (
          <div>
            <label className="text-caption text-text-tertiary">Last used</label>
            <p className="text-body text-text-primary">{new Date(token.last_used_at).toLocaleString()}</p>
          </div>
        )}
        {secret && (
          <p className="text-caption text-warning">
            Copy this now. For safety, the full token is only shown immediately after generation.
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" onClick={rotateToken} disabled={busy} className="btn-primary">
            <RefreshCw size={14} />
            {token ? "Rotate Token" : "Generate Token"}
          </button>
          {token && (
            <button type="button" onClick={revokeToken} disabled={busy} className="btn-secondary text-danger">
              <Trash2 size={14} />
              Revoke
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
