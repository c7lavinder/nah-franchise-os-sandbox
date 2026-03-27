"use client";

export type TimePeriod = "week" | "month" | "quarter" | "year";

interface TimePeriodSelectorProps {
  selected: TimePeriod;
  onChange: (period: TimePeriod) => void;
}

const PERIODS: { value: TimePeriod; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
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
