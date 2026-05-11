import type { EosTerritoryHabit, EosHabitGrade } from "@/types/database";

interface Props {
  habits: EosTerritoryHabit[];
}

const GRADES: EosHabitGrade[] = ["A", "B", "C", "D", "F"];

const GRADE_COLORS: Record<EosHabitGrade, string> = {
  A: "bg-green-500 text-white",
  B: "bg-green-300 text-green-900",
  C: "bg-yellow-400 text-yellow-900",
  D: "bg-orange-400 text-white",
  F: "bg-red-500 text-white",
};

export default function TerritoryEosHabits({ habits }: Props) {
  return (
    <div>
      <h3 className="text-body-sm font-semibold text-text-primary mb-3">Habits</h3>
      <div className="space-y-2">
        {habits.map((h) => (
          <div key={h.id} className="flex items-center justify-between gap-4">
            <span className="text-body-sm text-text-primary flex-1">{h.habit_label}</span>
            <div className="flex gap-1">
              {GRADES.map((g) => (
                <span
                  key={g}
                  className={`w-8 h-8 rounded-md text-xs font-bold flex items-center justify-center ${
                    h.grade === g ? GRADE_COLORS[g] : "bg-bg-secondary text-text-tertiary"
                  }`}
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
