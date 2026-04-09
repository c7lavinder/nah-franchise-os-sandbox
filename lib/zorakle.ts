/**
 * Zorakle Utility Functions
 *
 * Shared by: seed script, sync endpoint, and Scout context.
 * Computes fit_score and risk_flag from Zorakle personality data.
 */

/** Fit score formula:
 *  eclipse_component    = COALESCE(eclipse_overall, 0) * 0.6
 *  values_component     = Achiever:20 | Societal:15 | Emulator:10 | Belonger:0 | null:10
 *  work_style_component = Director:20 | Connector:14 | Promoter:12 | Thinker:10 | null:10
 *  fit_score = ROUND(eclipse_component + values_component + work_style_component)
 */
export function computeFitScore(params: {
  eclipse_overall: number | null;
  values_type: string | null;
  work_style: string | null;
}): number {
  const eclipseComponent = (params.eclipse_overall ?? 0) * 0.6;

  const valuesMap: Record<string, number> = {
    achiever: 20,
    societal: 15,
    emulator: 10,
    belonger: 0,
  };
  const valuesComponent = params.values_type
    ? valuesMap[params.values_type.toLowerCase()] ?? 10
    : 10;

  const workStyleMap: Record<string, number> = {
    director: 20,
    connector: 14,
    promoter: 12,
    thinker: 10,
  };
  const workStyleComponent = params.work_style
    ? workStyleMap[params.work_style.toLowerCase()] ?? 10
    : 10;

  return Math.round(eclipseComponent + valuesComponent + workStyleComponent);
}

/**
 * Risk flags:
 *  green  = Achiever + Director + eclipse >= 90
 *  yellow = Belonger (any score)
 *  red    = eclipse < 85 (and not green)
 *  null   = insufficient data
 */
export function computeRiskFlag(params: {
  eclipse_overall: number | null;
  values_type: string | null;
  work_style: string | null;
}): "green" | "yellow" | "red" | null {
  const { eclipse_overall, values_type, work_style } = params;

  // Insufficient data
  if (eclipse_overall == null && values_type == null && work_style == null) {
    return null;
  }

  const isAchiever = values_type?.toLowerCase() === "achiever";
  const isDirector = work_style?.toLowerCase() === "director";
  const isBelonger = values_type?.toLowerCase() === "belonger";

  // Green: Achiever + Director + eclipse >= 90
  if (isAchiever && isDirector && (eclipse_overall ?? 0) >= 90) {
    return "green";
  }

  // Yellow: Belonger (any score)
  if (isBelonger) {
    return "yellow";
  }

  // Red: eclipse < 85
  if (eclipse_overall != null && eclipse_overall < 85) {
    return "red";
  }

  return null;
}

/** Human-readable descriptions for Scout context */
export const VALUES_DESCRIPTIONS: Record<string, string> = {
  achiever: "Achievement-oriented. Driven by results, status, and financial success. Ideal franchise profile.",
  societal: "Community-oriented. Motivated by impact and giving back. Strong but needs clear ROI framing.",
  emulator: "Aspiration-oriented. Wants to model success. Responds well to franchisee success stories.",
  belonger: "Security-oriented. Risk-averse. Needs extra capital confidence building. ⚡ Move capital conversation earlier.",
};

export const WORK_STYLE_DESCRIPTIONS: Record<string, string> = {
  director: "Takes charge, makes decisions quickly. Low patience for slow processes. Top performer profile.",
  connector: "Relationship builder. Strong with people, good at hiring. May need push on pace.",
  promoter: "Enthusiastic, sells the vision. Good at marketing but verify follow-through on operations.",
  thinker: "Analytical, needs data. Will research thoroughly. Good operator but slower to commit.",
};
