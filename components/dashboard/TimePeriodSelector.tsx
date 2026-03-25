"use client";

interface TimePeriodSelectorProps {
  selected: string;
  onChange: (period: string) => void;
}

const PERIODS = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "all", label: "All Time" },
];

export default function TimePeriodSelector({ selected, onChange }: TimePeriodSelectorProps) {
  return (
    <div className="flex gap-1 bg-bg-secondary border border-border-default rounded-lg p-1">
      {PERIODS.map((period) => (
        <button
          key={period.value}
          onClick={() => onChange(period.value)}
          className={`px-3 py-1.5 rounded-md text-caption font-medium transition-colors ${
            selected === period.value
              ? "bg-nah-orange text-white"
              : "text-text-tertiary hover:text-text-primary hover:bg-bg-hover"
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
