import type { EosTerritoryLeadChannel } from "@/types/database";

interface Props {
  channels: EosTerritoryLeadChannel[];
}

const CHANNEL_HEADERS = [
  {
    label: "Bulk Lists",
    color: "bg-blue-500",
    channels: [
      "High Equity",
      "Absentee Owners",
      "Probates",
      "Evictions",
      "City Citations",
      "Distressed Rentals",
      "Divorces",
    ],
  },
  { label: "Lead Mining", color: "bg-emerald-500", channels: ["Prospect Now", "Vacants"] },
  { label: "Listed", color: "bg-amber-500", channels: ["Agent Listed", "FSBO", "Foreclosures"] },
  { label: "Auctions", color: "bg-rose-500", channels: ["Brokered Auctions"] },
  {
    label: "Referral Partners",
    color: "bg-violet-500",
    channels: ["Wholesalers", "Agents", "Industry Network", "Homelight", "Asset Managers", "Birddogs"],
  },
  {
    label: "Digital",
    color: "bg-cyan-500",
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
      "Social Platforms",
    ],
  },
];

export default function TerritoryEosLeadChannels({ channels }: Props) {
  const channelMap = new Map(channels.map((ch) => [ch.channel_name, ch]));

  function renderCell(name: string) {
    const ch = channelMap.get(name);
    if (!ch) return <div key={name} />;
    return (
      <div key={ch.id} className="flex items-center gap-1.5 px-1 py-1 rounded">
        <span
          className={`shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] ${
            ch.is_active ? "bg-nah-blue border-nah-blue text-white" : "border-border-primary"
          }`}
        >
          {ch.is_active ? "\u2713" : ""}
        </span>
        <span className={`text-[11px] leading-tight ${ch.is_active ? "text-text-primary" : "text-text-tertiary"}`}>
          {ch.channel_name}
        </span>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-body-sm font-semibold text-text-primary mb-3">Lead Generation Channels</h3>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
        {CHANNEL_HEADERS.map((group) => (
          <div key={group.label} className="min-w-0 grid grid-cols-[6px_1fr] gap-2">
            <div className={`${group.color} rounded-full`} />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide mb-1">
                {group.label}
              </div>
              <div className="space-y-0.5">{group.channels.map((name) => renderCell(name))}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
