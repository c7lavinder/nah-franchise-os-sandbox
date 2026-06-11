import type { EosTerritoryLeadChannel } from "@/types/database";

interface Props {
  channels: EosTerritoryLeadChannel[];
}

type ChannelTone = "mauve" | "gold" | "maroon" | "plain";

interface ChannelColumn {
  label: string;
  sources?: string[];
  tone: ChannelTone;
}

interface ChannelGroup {
  label: string;
  columns: ChannelColumn[];
}

const CHANNEL_GROUPS: ChannelGroup[] = [
  {
    label: "Bulk Lists",
    columns: [
      { label: "Prospect Now", sources: ["Prospect Now", "Digital Prospect Now"], tone: "mauve" },
      { label: "Vacants", tone: "mauve" },
      { label: "High Equity", tone: "mauve" },
      { label: "Absentee Owners", tone: "mauve" },
    ],
  },
  {
    label: "Lead Mining",
    columns: [
      { label: "Probates", tone: "plain" },
      { label: "Evictions", tone: "plain" },
      { label: "City Citations", tone: "plain" },
      { label: "Distressed Rentals", tone: "plain" },
      { label: "Divorces", tone: "plain" },
      { label: "Social Platforms", tone: "plain" },
      { label: "Birddogs", tone: "plain" },
    ],
  },
  {
    label: "Listed",
    columns: [
      { label: "Agent Listed", tone: "plain" },
      { label: "FSBO", tone: "plain" },
    ],
  },
  {
    label: "Auctions",
    columns: [
      { label: "Foreclosures", tone: "plain" },
      { label: "Brokered Auctions", tone: "plain" },
    ],
  },
  {
    label: "Referral Partners",
    columns: [
      { label: "Wholesalers", tone: "gold" },
      { label: "Agents", tone: "gold" },
      { label: "Industry Network", tone: "gold" },
      { label: "Homelight", tone: "gold" },
      { label: "Asset Managers", tone: "gold" },
    ],
  },
  {
    label: "Digital",
    columns: [
      { label: "Facebook Ads", tone: "maroon" },
      { label: "Google Ads", tone: "maroon" },
      { label: "Google Retargeting", tone: "maroon" },
      { label: "Organic Search", tone: "mauve" },
      { label: "Google Map Pack", tone: "mauve" },
      { label: "Google Business", tone: "mauve" },
      { label: "Facebook", tone: "gold" },
      { label: "Instagram", tone: "gold" },
      { label: "TikTok", tone: "gold" },
      { label: "YouTube", tone: "gold" },
      { label: "Google Business Profile", tone: "gold" },
      { label: "Other Social Media", tone: "gold" },
    ],
  },
];

const TONE_CLASSES: Record<ChannelTone, { bar: string; text: string }> = {
  mauve: { bar: "bg-[#e4d4db]", text: "text-[#303238]" },
  gold: { bar: "bg-[#f6e4aa]", text: "text-[#303238]" },
  maroon: { bar: "bg-[#7f2947]", text: "text-white" },
  plain: { bar: "bg-transparent", text: "text-[#303238]" },
};

const CHANNEL_COLUMN_COUNT = CHANNEL_GROUPS.reduce((sum, group) => sum + group.columns.length, 0);

export default function TerritoryEosLeadChannels({ channels }: Props) {
  const channelMap = new Map(channels.map((ch) => [ch.channel_name, ch]));

  function isActive(column: ChannelColumn) {
    const names = column.sources ?? [column.label];
    return names.some((name) => channelMap.get(name)?.is_active);
  }

  return (
    <div className="overflow-x-auto">
      <h3 className="mb-8 text-[36px] font-semibold leading-none text-[#303238]">Lead Generation Channels</h3>
      <div
        className="inline-grid min-w-max grid-rows-[32px_30px_245px] gap-x-2"
        style={{ gridTemplateColumns: `repeat(${CHANNEL_COLUMN_COUNT}, 40px)` }}
      >
        {CHANNEL_GROUPS.map((group) => (
          <div
            key={`header-${group.label}`}
            className="flex items-end justify-center border-b-2 border-[#303238] px-1 pb-1 text-[15px] font-semibold leading-none text-[#303238]"
            style={{ gridColumn: `span ${group.columns.length}` }}
          >
            {group.label}
          </div>
        ))}

        {CHANNEL_GROUPS.flatMap((group) =>
          group.columns.map((column) => {
            const active = isActive(column);
            return (
              <div key={`check-${group.label}-${column.label}`} className="flex items-center justify-center">
                <span
                  aria-hidden="true"
                  className={`flex h-4 w-4 items-center justify-center rounded-[3px] border text-[11px] font-bold leading-none ${
                    active ? "border-[#0d7dff] bg-[#0d7dff] text-white" : "border-[#888] bg-white text-transparent"
                  }`}
                >
                  ✓
                </span>
              </div>
            );
          })
        )}

        {CHANNEL_GROUPS.flatMap((group) =>
          group.columns.map((column) => {
            const tone = TONE_CLASSES[column.tone];
            return (
              <div
                key={`label-${group.label}-${column.label}`}
                className={`flex h-[245px] w-10 items-center justify-center ${tone.bar}`}
              >
                <span
                  className={`whitespace-nowrap text-[15px] font-semibold leading-none ${tone.text}`}
                  style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
                >
                  {column.label}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
