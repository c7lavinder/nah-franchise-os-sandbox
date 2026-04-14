"use client";

import { useState } from "react";
import type { EosTerritoryLeadChannel } from "@/types/database";

interface Props {
  msSlug: string;
  channels: EosTerritoryLeadChannel[];
  onUpdate: () => void;
}

const CHANNEL_GROUPS: { label: string; channels: string[] }[] = [
  {
    label: "Prospecting",
    channels: [
      "Bulk Lists", "Lead Mining", "Vacants", "High Equity", "Absentee Owners",
      "Probates", "Evictions", "City Citations", "Distressed Rentals", "Divorces",
      "Birddogs", "FSBO", "Foreclosures", "Listed Auctions",
    ],
  },
  {
    label: "Networking",
    channels: [
      "Referral Partners", "Agent Listed", "Brokered Auctions", "Wholesalers",
      "Agents Industry Network", "Homelight", "Asset Managers",
    ],
  },
  {
    label: "Digital",
    channels: [
      "Digital Prospect Now", "Facebook Ads", "Google Ads", "Google Retargeting",
      "Organic Search", "Google Map Pack", "Google Business", "Facebook",
      "Instagram", "TikTok", "YouTube", "Google Business Profile",
      "Other Social Media", "Social Platforms",
    ],
  },
];

export default function TerritoryEosLeadChannels({ msSlug, channels, onUpdate }: Props) {
  const [local, setLocal] = useState<EosTerritoryLeadChannel[]>(channels);

  const channelMap = new Map(local.map((ch) => [ch.channel_name, ch]));

  async function toggle(channel: EosTerritoryLeadChannel) {
    setLocal((prev) =>
      prev.map((c) => (c.id === channel.id ? { ...c, is_active: !c.is_active } : c))
    );
    await fetch(`/api/territories/${msSlug}/eos/lead-channels/${channel.id}`, {
      method: "POST",
    }).catch(() => {
      setLocal((prev) =>
        prev.map((c) => (c.id === channel.id ? { ...c, is_active: channel.is_active } : c))
      );
    });
    onUpdate();
  }

  return (
    <div>
      <h3 className="text-body-sm font-semibold text-text-primary mb-1">Lead Channels</h3>
      {CHANNEL_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="text-center mt-5 mb-2">
            <span className="block border-b border-border-primary w-[calc(100%-15px)] mx-auto pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              {group.label}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-1">
            {group.channels.map((name) => {
              const ch = channelMap.get(name);
              if (!ch) return null;
              return (
                <label
                  key={ch.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-bg-secondary cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={ch.is_active}
                    onChange={() => toggle(ch)}
                    className="h-4 w-4 rounded border-border-primary text-nah-blue focus:ring-nah-blue/30"
                  />
                  <span className={`text-body-sm ${ch.is_active ? "text-text-primary" : "text-text-tertiary"}`}>
                    {ch.channel_name}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
