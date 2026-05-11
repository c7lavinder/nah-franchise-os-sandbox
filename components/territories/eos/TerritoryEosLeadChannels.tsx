import type { EosTerritoryLeadChannel } from "@/types/database";

interface Props {
  channels: EosTerritoryLeadChannel[];
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
  "High Equity",
  "Absentee Owners",
  "Probates",
  "Evictions",
  "City Citations",
  "Distressed Rentals",
  "Divorces",
  "Social Platforms",
  "Birddogs",
  "Agent Listed",
  "FSBO",
  "Foreclosures",
  "Brokered Auctions",
  "Wholesalers",
  "Agents Industry Network",
  "Homelight",
  "Asset Managers",
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
      <h3 className="text-body-sm font-semibold text-text-primary mb-3">Lead Channels</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "4px" }}>
        {/* Header row */}
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
