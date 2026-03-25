"use client";

import { Loader2, TrendingUp, TrendingDown, Lightbulb } from "lucide-react";

interface GradeResult {
  score: string;
  scoreNumeric: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  coachingTips: string[];
}

interface CoachingTabProps {
  grade: GradeResult | null;
  grading: boolean;
}

export default function CoachingTab({ grade, grading }: CoachingTabProps) {
  if (grading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 size={24} className="animate-spin text-scout-purple" />
        <p className="text-body-sm text-text-tertiary">Scout is analyzing the call...</p>
      </div>
    );
  }

  if (!grade) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-body-sm text-text-tertiary">
          No transcript available — coaching will appear once calls are recorded and transcribed
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-5">
      {/* Score */}
      <div className="flex items-center gap-4">
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold ${
          grade.scoreNumeric >= 80 ? "bg-success/15 text-success" :
          grade.scoreNumeric >= 60 ? "bg-warning/15 text-warning" :
          "bg-danger/15 text-danger"
        }`}>
          {grade.score}
        </div>
        <div>
          <p className="text-h2 text-text-primary">Call Score: {grade.scoreNumeric}/100</p>
          <p className="text-body-sm text-text-secondary">{grade.summary}</p>
        </div>
      </div>

      {/* Strengths */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={14} className="text-success" />
          <h3 className="text-overline text-text-tertiary tracking-wider">STRENGTHS</h3>
        </div>
        <ul className="space-y-1.5">
          {grade.strengths.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-body-sm text-text-primary">
              <span className="text-success mt-0.5">+</span>
              {s}
            </li>
          ))}
        </ul>
      </section>

      {/* Improvements */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown size={14} className="text-warning" />
          <h3 className="text-overline text-text-tertiary tracking-wider">AREAS TO IMPROVE</h3>
        </div>
        <ul className="space-y-1.5">
          {grade.improvements.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-body-sm text-text-primary">
              <span className="text-warning mt-0.5">-</span>
              {s}
            </li>
          ))}
        </ul>
      </section>

      {/* Coaching Tips */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb size={14} className="text-scout-purple" />
          <h3 className="text-overline text-text-tertiary tracking-wider">COACHING TIPS</h3>
        </div>
        <ul className="space-y-1.5">
          {grade.coachingTips.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-body-sm text-text-primary">
              <span className="text-scout-purple mt-0.5">→</span>
              {s}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
