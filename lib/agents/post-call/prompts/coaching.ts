import type { CallContext, CoachingResult } from "../types";
import { callClaude, stripFences } from "../call-claude";

const SYSTEM = "You are Scout, an expert franchise sales coach with deep knowledge of consultative selling, franchise development best practices, and the New Again Houses sales process.";

export function buildPrompt(ctx: CallContext): string {
  const callTypeInstructions = getCallTypeInstructions(ctx.callTypeSlug);

  return `Analyze this ${ctx.callType ?? "sales"} call transcript and return a coaching evaluation as JSON.

## The New Again Houses Sales Process
NAH sells house-flipping franchises. The process moves through: Engagement → Qualification → Discovery → Compliance → Awarding → Closed.
- Chad Arnold runs intro calls and manages the overall process
- Matt Lavinder (CEO) runs qualification and final calls — assesses candidate fit and drive
- Sam runs discovery calls — demonstrates the Master Suite and business model
- Mark runs capital/lending calls — maps the full financial picture
- Two known fallout points: (1) before candidates engage with Path to Ownership, (2) at commitment time when capital issues surface too late

## Scoring Rubric (100 points total)
Score each dimension based on evidence in the transcript:

1. Discovery Depth (0–20): Did the rep uncover the candidate's WHY, definition of success, and timeline BEFORE pitching?
   - 18–20: Deep discovery, candidate talked for 2+ minutes unprompted, goals clearly understood
   - 13–17: Good discovery with some gaps
   - 8–12: Surface-level only, rep talked too much
   - 0–7: Discovery skipped or minimal

2. Capital Qualification (0–20): Was capital discussed explicitly with real numbers or clear ranges?
   - 18–20: Capital fully mapped, specific numbers confirmed, funding options explored
   - 13–17: Capital discussed but not fully resolved
   - 8–12: Mentioned but vague, no real numbers
   - 0–7: Capital avoided or not mentioned at all

3. Relationship Building (0–15): Was genuine trust and rapport established?
   - 13–15: Candidate felt heard, personal connection made, candid conversation
   - 9–12: Professional and warm but surface level
   - 0–8: Transactional, rushed, or candidate seemed guarded

4. Process Clarity (0–15): Does the candidate clearly understand next steps and why?
   - 13–15: Next steps explained with rationale, candidate confirmed understanding
   - 9–12: Next steps mentioned but not fully explained
   - 0–8: Next steps vague or not discussed

5. Objection Surfacing (0–15): Were concerns drawn out and addressed (not avoided)?
   - 13–15: Concerns proactively sought, addressed with evidence/stories
   - 9–12: Responded to stated concerns but didn't dig for hidden ones
   - 0–8: Concerns avoided or handled dismissively

6. Momentum & Close (0–15): Was a specific next step set with date/time?
   - 13–15: Specific next step confirmed with date before call ended
   - 9–12: Next step agreed but not scheduled
   - 0–8: Vague ("I'll be in touch") or no next step

${callTypeInstructions}

## Universal Red Flags (always include in watch_out if present):
- Capital never directly probed or vague answer not followed up
- No specific next step with date set
- Rep pitched before understanding candidate's why
- Spouse/partner mentioned but not addressed
- Timeline vague with no urgency

## Universal Green Flags (include in went_well if present):
- Rep asked about "why" early and listened
- Capital discussed with real numbers
- Specific next step confirmed with date
- Franchisee story/data used to validate concern
- Candidate's own words reflected back

## Return this exact JSON structure:
{
  "coaching": {
    "score": <integer 0-100>,
    "label": "<8 words or less describing call quality>",
    "went_well": ["<specific observation with evidence>", "<specific observation>", "<specific observation>"],
    "watch_out": ["<specific concern with evidence>", "<specific concern>"],
    "next_call_prep": "<2-4 sentences: what the next rep needs to know, specific questions to ask, flags to watch>",
    "dimension_scores": {
      "discovery": <0-20>,
      "capital": <0-20>,
      "relationship": <0-15>,
      "process_clarity": <0-15>,
      "objection_surfacing": <0-15>,
      "momentum": <0-15>
    }
  }
}

Rules:
- went_well: 2–4 items. Each must reference something specific that happened in the transcript. No generic praise.
- watch_out: 1–3 items. Each must reference specific evidence. No hypotheticals.
- next_call_prep: Specific and actionable. Name the next call type. Give the 2-3 most important things to know.
- All scores must be integers. Dimension scores must sum to the overall score.
- Return only valid JSON. No preamble, no markdown fences.

WRITING STANDARDS — all text fields will be read by franchise executives:
- Write in complete, professional sentences. No shorthand or casual fragments.
- BAD: "Mark's call Monday 12 noon Central" — GOOD: "Mark's lending call is scheduled for Monday at 12:00 PM Central."
- Use full names on first reference, then first name only.
- Format dollar amounts properly ("$150,000" not "150k").
- Dates and times should include day of week and timezone.

Call Type: ${ctx.callType ?? "Unknown"}
Contact: ${ctx.contactName ?? "Unknown"}
Team: ${ctx.teamMembers.join(", ") || "Unknown"}
Date: ${ctx.callDate ?? "Unknown"}

Transcript:
${ctx.transcript}`;
}

function getCallTypeInstructions(slug: string | null): string {
  switch (slug) {
    case "intro_call":
      return `## Intro Call Specific Criteria
PRIMARY JOB: Uncover why, qualify genuine interest, introduce Path to Ownership.
Green flags: Opened with candidate's background before explaining NAH; introduced PTO as mutual process; capital mentioned even briefly; set calendar invite.
Red flags: Spent 5+ min explaining business before asking about candidate; capital not mentioned at all; PTO not explained; no committed next step.
For next_call_prep: Note capital signals, personality type (driver/analytical/relational), any hesitations or competing options.`;

    case "matt_call":
      return `## Matt Call Specific Criteria
PRIMARY JOB: Assess candidate drive/fit, anchor capital reality, create appropriate urgency.
Green flags: Asked about 3-5 year success vision; addressed "why now"; discussed competitive alternatives; created urgency without pressure.
Red flags: Capital stayed surface-level; no personality/drive assessment; no differentiation from alternatives; hesitation smoothed over rather than explored.
For next_call_prep: Rate capital readiness (confirmed/likely/unclear/concern) and motivation level (high/medium/low) with evidence.`;

    case "sam_call":
      return `## Sam Call Specific Criteria
PRIMARY JOB: Demonstrate model working, validate territory fit, build operational excitement.
Green flags: Showed Master Suite with real deal example; walked unit economics with specific numbers; territory discussed with specific geography.
Red flags: One-directional demo; territory vague; candidate disengaged; financial model not shown.`;

    case "mark_call":
      return `## Mark Call Specific Criteria
PRIMARY JOB: Map full capital picture, explore all funding options, identify red flags.
Green flags: Total investable assets confirmed with specific number; 2+ funding options discussed; candidate understands full investment range including working capital.
Red flags: Call ended without confirmed asset number; ROBS timeline not explained; capital shortfall not addressed with alternatives.
For next_call_prep: Capital readiness status — funded/fundable/marginal/disqualified.`;

    case "fdd_review_call":
      return `## FDD Review Call Specific Criteria
PRIMARY JOB: Cover key items, establish 14-day compliance clock, gauge commitment.
Green flags: Items 5, 6, 7, 8, 19 all addressed; 14-day window explained with specific date; commitment gauge asked ("1-10 where are you?").
Red flags: 14-day window not mentioned (compliance risk); Items 6/7 not discussed; unresolved questions candidate will "email later"; no commitment gauge taken.`;

    case "territory_call":
      return `## Territory Call Specific Criteria
PRIMARY JOB: Align to specific territory, confirm availability, remove geographic uncertainty.
Green flags: Specific territory with market data (housing stock, flip activity); candidate confirmed territory understanding; excitement about specific market.
Red flags: Territory discussed without market data; availability not confirmed; geographic concerns left unresolved.`;

    case "matt_final_call":
      return `## Matt Final Call Specific Criteria
PRIMARY JOB: Confirm mutual commitment, set award process expectations, remove last objections.
Green flags: Candidate explicitly confirmed readiness; award committee process explained; FA + FDD timeline explained; remaining concerns resolved.
Red flags: Conditional commitment not followed up; award process unexplained; open items left unresolved; spouse still not engaged.`;

    default:
      return `## Call Type: ${slug ?? "General Sales Call"}
Evaluate against the universal framework above. Apply all 6 dimensions and flag all universal red/green flags present.`;
  }
}

export function parseResult(rawText: string): CoachingResult | null {
  try {
    const data = JSON.parse(stripFences(rawText)) as { coaching?: CoachingResult };
    if (!data.coaching || typeof data.coaching.score !== "number") return null;
    return data.coaching;
  } catch {
    return null;
  }
}

export async function runCoaching(ctx: CallContext, model?: string): Promise<CoachingResult | null> {
  return callClaude({
    model,
    systemPrompt: SYSTEM,
    userPrompt: buildPrompt(ctx),
    parse: parseResult,
  });
}
