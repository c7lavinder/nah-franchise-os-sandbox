import type { CSSProperties } from "react";
import type { EosTerritoryLeadChannel } from "@/types/database";

interface Props {
  channels: EosTerritoryLeadChannel[];
}

type ChannelGroup = {
  label: string;
  channels: string[];
};

const CHANNEL_GROUPS: ChannelGroup[] = [
  {
    label: "Bulk Lists",
    channels: ["Prospect Now", "Vacants", "High Equity", "Absentee Owners"],
  },
  {
    label: "Lead Mining",
    channels: [
      "Probates",
      "Evictions",
      "City Citations",
      "Distressed Rentals",
      "Divorces",
      "Social Platforms",
      "Birddogs",
    ],
  },
  {
    label: "Listed",
    channels: ["Agent Listed", "FSBO"],
  },
  {
    label: "Auctions",
    channels: ["Foreclosures", "Brokered Auctions"],
  },
  {
    label: "Referral Partners",
    channels: ["Wholesalers", "Agents", "Industry Network", "Homelight", "Asset Managers"],
  },
  {
    label: "Digital",
    channels: [
      "Facebook Ads",
      "Google Ads",
      "Google Retargeting",
      "Organic Search",
      "Google Map Pack",
      "Google Business",
      "Facebook",
      "Instagram",
      "TikTok",
      "YouTube",
      "Google Business Profile",
      "Other Social Media",
    ],
  },
];

const CHANNEL_COLORS: Record<string, string> = {
  "Facebook Ads": "bg-[#7b2845] text-white",
  "Google Ads": "bg-[#7b2845] text-white",
  "Google Retargeting": "bg-[#7b2845] text-white",
  Wholesalers: "bg-[#f3e1a1]",
  Agents: "bg-[#f3e1a1]",
  "Industry Network": "bg-[#f3e1a1]",
  Homelight: "bg-[#f3e1a1]",
  "Asset Managers": "bg-[#f3e1a1]",
  Facebook: "bg-[#f3e1a1]",
  Instagram: "bg-[#f3e1a1]",
  TikTok: "bg-[#f3e1a1]",
  YouTube: "bg-[#f3e1a1]",
  "Google Business Profile": "bg-[#f3e1a1]",
  "Other Social Media": "bg-[#f3e1a1]",
};

const DEFAULT_CHANNEL_COLOR = "bg-[#e5d4dc]";
const VERTICAL_LABEL_STYLE: CSSProperties = {
  writingMode: "vertical-rl",
  transform: "rotate(180deg)",
};

function displayName(name: string): string {
  if (name === "TikTok") return "Tik Tok";
  return name;
}

export default function TerritoryEosLeadChannels({ channels }: Props) {
  const channelMap = new Map(channels.map((ch) => [ch.channel_name, ch]));
  const channelNames = CHANNEL_GROUPS.flatMap((group) => group.channels);

  function isActive(name: string): boolean {
    return Boolean(channelMap.get(name)?.is_active);
  }

  return (
    <div>
      <h3 className="mb-3 text-body-sm font-semibold text-text-primary">Lead Generation Channels</h3>
      <div
        className="grid w-full gap-x-1.5 gap-y-2"
        style={{ gridTemplateColumns: `repeat(${channelNames.length}, minmax(0, 1fr))` }}
      >
        {CHANNEL_GROUPS.map((group) => (
          <div
            key={group.label}
            className="min-w-0 border-b border-text-primary/80 px-1 pb-1 text-center text-[12px] font-semibold text-text-primary"
            style={{ gridColumn: `span ${group.channels.length}` }}
          >
            {group.label}
          </div>
        ))}
        {channelNames.map((name) => (
          <div key={`${name}-check`} className="flex h-6 min-w-0 items-center justify-center">
            <input
              type="checkbox"
              checked={isActive(name)}
              readOnly
              aria-label={name}
              className="h-4 w-4 rounded border-border-primary accent-blue-600"
            />
          </div>
        ))}
        {channelNames.map((name) => (
          <div
            key={name}
            className={`flex h-[210px] min-w-0 items-center justify-center px-0.5 text-center font-semibold leading-tight text-[#333] ${
              CHANNEL_COLORS[name] ?? DEFAULT_CHANNEL_COLOR
            }`}
            style={{ fontSize: "clamp(9px, 0.65vw, 12px)" }}
          >
            <span style={VERTICAL_LABEL_STYLE}>{displayName(name)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
