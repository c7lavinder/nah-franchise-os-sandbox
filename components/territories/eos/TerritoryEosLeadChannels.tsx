"use client";

import { useState } from "react";
import type { EosTerritoryLeadChannel } from "@/types/database";

interface Props {
  msSlug: string;
  channels: EosTerritoryLeadChannel[];
  onUpdate: () => void;
}

export default function TerritoryEosLeadChannels({ msSlug, channels, onUpdate }: Props) {
  const [local, setLocal] = useState<EosTerritoryLeadChannel[]>(channels);

  async function toggle(channel: EosTerritoryLeadChannel) {
    setLocal((prev) =>
      prev.map((c) => (c.id === channel.id ? { ...c, is_active: !c.is_active } : c))
    );
    await fetch(`/api/territories/${msSlug}/eos/lead-channels/${channel.id}`, {
      method: "POST",
    }).catch(() => {
      // revert on failure
      setLocal((prev) =>
        prev.map((c) => (c.id === channel.id ? { ...c, is_active: channel.is_active } : c))
      );
    });
    onUpdate();
  }

  return (
    <div>
      <h3 className="text-body-sm font-semibold text-text-primary mb-3">Lead Channels</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
        {local.map((ch) => (
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
        ))}
      </div>
    </div>
  );
}
