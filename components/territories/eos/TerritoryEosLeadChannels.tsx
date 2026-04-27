"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState } from "react";
import type { EosTerritoryLeadChannel } from "@/types/database";

interface Props {
  msSlug: string;
  channels: EosTerritoryLeadChannel[];
  onUpdate: () => void;
}

const CHANNEL_HEADERS = [
  "Bulk Lists",
  "Lead Mining",
  "Listed Auctions",
  "Referral Partners",
  "Digital Prospect Now",
  "Vacants",
];

const CHANNEL_CHECKBOXES = [
  "High Equity", "Absentee Owners", "Probates", "Evictions",
  "City Citations", "Distressed Rentals", "Divorces", "Social Platforms",
  "Birddogs", "Agent Listed", "FSBO", "Foreclosures",
  "Brokered Auctions", "Wholesalers", "Agents Industry Network", "Homelight",
  "Asset Managers", "Facebook Ads", "Google Ads", "Google Retargeting",
  "Organic Search", "Google Map Pack", "Google Business", "Facebook",
  "Instagram", "TikTok", "YouTube", "Google Business Profile",
  "Other Social Media",
];

export default function TerritoryEosLeadChannels({ msSlug, channels, onUpdate }: Props) {
  const [local, setLocal] = useState<EosTerritoryLeadChannel[]>(channels);

  const channelMap = new Map(local.map((ch) => [ch.channel_name, ch]));

  async function toggle(channel: EosTerritoryLeadChannel) {
    setLocal((prev) =>
      prev.map((c) => (c.id === channel.id ? { ...c, is_active: !c.is_active } : c))
    );
    await apiFetch(`/api/territories/${msSlug}/eos/lead-channels/${channel.id}`, {
      method: "POST",
    }).catch(() => {
      setLocal((prev) =>
        prev.map((c) => (c.id === channel.id ? { ...c, is_active: channel.is_active } : c))
      );
    });
    onUpdate();
  }

  function renderCell(name: string) {
    const ch = channelMap.get(name);
    if (!ch) return <div key={name} />;
    return (
      <label
        key={ch.id}
        className="flex items-center gap-1.5 px-1 py-1 cursor-pointer hover:bg-bg-secondary rounded transition-colors"
      >
        <input
          type="checkbox"
          checked={ch.is_active}
          onChange={() => toggle(ch)}
          className="h-3.5 w-3.5 rounded border-border-primary text-nah-blue focus:ring-nah-blue/30"
        />
        <span className={`text-[11px] leading-tight ${ch.is_active ? "text-text-primary" : "text-text-tertiary"}`}>
          {ch.channel_name}
        </span>
      </label>
    );
  }

  return (
    <div>
      <h3 className="text-body-sm font-semibold text-text-primary mb-3">Lead Channels</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "4px" }}>
        {/* Header row — 6 label cells with underline */}
        {CHANNEL_HEADERS.map((label) => (
          <div key={label} className="text-center py-px my-3">
            <span className="block border-b border-current w-[calc(100%-15px)] mx-auto opacity-60 text-[11px] text-text-secondary pb-0.5">
              {label}
            </span>
          </div>
        ))}

        {/* Checkbox cells */}
        {CHANNEL_CHECKBOXES.map((name) => renderCell(name))}
      </div>
    </div>
  );
}
