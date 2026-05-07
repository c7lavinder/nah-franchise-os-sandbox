/**
 * Seed default rubric criteria for all call types — exactly 6 per type.
 * Usage: npx tsx scripts/seed-default-rubrics.ts --dry-run
 *        npx tsx scripts/seed-default-rubrics.ts --live
 *
 * NOTE: This replaces existing criteria. Run with --live to wipe and re-insert.
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isDryRun = !process.argv.includes("--live");

interface CriterionSeed {
  name: string;
  description: string;
  weight: number;
  positive_examples: string[];
  negative_examples: string[];
}

const RUBRICS: Record<string, CriterionSeed[]> = {
  intro_call: [
    {
      name: "Rapport & Connection",
      description: "Built genuine warmth; used prospect name; found personal common ground",
      weight: 0.15,
      positive_examples: ["Used prospect name naturally", "Found personal common ground", "Warm confident tone"],
      negative_examples: ["Jumped straight to pitch", "Sounded scripted", "No personalization"],
    },
    {
      name: "Discovery",
      description: "Explored motivation, background, timeline, partner situation, capital awareness",
      weight: 0.25,
      positive_examples: [
        "Asked open-ended why questions",
        "Explored timeline and capital",
        "Uncovered partner dynamics",
      ],
      negative_examples: ["Only yes/no questions", "Skipped motivation", "Talked more than listened"],
    },
    {
      name: "NAH Differentiation",
      description: "Clearly communicated what makes NAH different: capital partner, Lowe's, MasterSuite, coaching",
      weight: 0.2,
      positive_examples: [
        "Explained 5 pillars clearly",
        "Connected value to prospect goals",
        "Contrasted with going solo",
      ],
      negative_examples: ["Generic franchise pitch", "Info dump with no connection to prospect", "No differentiation"],
    },
    {
      name: "Objection Surfacing",
      description: "Proactively invited concerns about capital, partner alignment, and timeline",
      weight: 0.15,
      positive_examples: [
        "Asked what concerns they have",
        "Addressed partner hesitation",
        "Explored capital readiness",
      ],
      negative_examples: ["Avoided tough questions", "Dismissed concerns", "Let red flags pass"],
    },
    {
      name: "Path to Ownership Framing",
      description: "Positioned process as mutual vetting; set Trainual expectations",
      weight: 0.1,
      positive_examples: ["Framed as two-way evaluation", "Set Trainual expectations", "Explained the process clearly"],
      negative_examples: ["Made it feel like a hard sell", "Skipped process explanation", "No Trainual mention"],
    },
    {
      name: "Next Step Commitment",
      description: "Secured specific Matt Call booking with clear deliverables and follow-up date",
      weight: 0.15,
      positive_examples: [
        "Booked specific next call",
        "Sent materials with follow-up date",
        "Clear time-bound commitment",
      ],
      negative_examples: ["Ended with vague follow-up", "No next step defined", "Left it open-ended"],
    },
  ],
  matt_call: [
    {
      name: "Deep Why Discovery",
      description: "Uncovered real motivation, fears, family support, life situation driving interest",
      weight: 0.25,
      positive_examples: ["Got past surface answers", "Found emotional driver", "Explored family/partner dynamics"],
      negative_examples: ["Accepted first answer", "Did not dig deeper", "Talked about NAH instead of listening"],
    },
    {
      name: "Culture & Vision Fit",
      description: "Connected NAH mission and culture to prospect specific goals and background",
      weight: 0.2,
      positive_examples: ["Customized story to prospect", "Used relevant franchisee examples", "Showed genuine belief"],
      negative_examples: ["Generic pitch", "One-size-fits-all", "Did not connect to prospect goals"],
    },
    {
      name: "Objection Handling",
      description: "Surfaced hidden hesitations and addressed concerns directly with honesty",
      weight: 0.2,
      positive_examples: ["Asked what would stop them", "Addressed capital concerns", "Tested commitment level"],
      negative_examples: ["Avoided tough questions", "Dismissed concerns", "Got defensive"],
    },
    {
      name: "Prospect Fit Assessment",
      description: "Honestly evaluated grit, capital readiness, support system, and commitment level",
      weight: 0.15,
      positive_examples: ["Assessed decision-making style", "Evaluated partner alignment", "Honest about fit concerns"],
      negative_examples: ["Overlooked red flags", "Assumed readiness", "Did not assess partner buy-in"],
    },
    {
      name: "Prospect Engagement",
      description: "Prospect asked questions, showed excitement, and owned the conversation",
      weight: 0.1,
      positive_examples: ["Prospect asked good questions", "Shifted from if to when", "Active two-way dialog"],
      negative_examples: ["One-sided conversation", "Prospect disengaged", "No curiosity from prospect"],
    },
    {
      name: "Next Step Clarity",
      description: "Clear Sam Call commitment with specific timeline",
      weight: 0.1,
      positive_examples: ["Scheduled Sam Call", "Set specific follow-up date", "Clear process expectation"],
      negative_examples: ["Vague follow-up", "No commitment secured", "Left prospect without direction"],
    },
  ],
  sam_call: [
    {
      name: "Operations Walkthrough",
      description: "Explained day-to-day reality: deal sourcing, construction, project management",
      weight: 0.25,
      positive_examples: [
        "Covered daily operations clearly",
        "Used real scenarios",
        "Connected ops to prospect background",
      ],
      negative_examples: ["Vague about daily work", "Skipped construction reality", "Made it sound too easy"],
    },
    {
      name: "Deal Economics",
      description: "Used real numbers: typical deal costs, ARV, margins, deal cycle timeline",
      weight: 0.25,
      positive_examples: [
        "Showed real deal examples",
        "Covered full deal cycle with numbers",
        "Explained profit margins",
      ],
      negative_examples: ["Vague about numbers", "No concrete examples", "Oversimplified the model"],
    },
    {
      name: "Honest Expectations",
      description: "Set realistic first-year expectations; did not sugarcoat the work required",
      weight: 0.2,
      positive_examples: [
        "Discussed time commitment honestly",
        "Set realistic first-year goals",
        "Covered challenges openly",
      ],
      negative_examples: ["Made it sound effortless", "Glossed over challenges", "Overpromised results"],
    },
    {
      name: "Ecosystem & Support",
      description: "Demonstrated Lowe's partnership, contractor network, coaching, and MasterSuite",
      weight: 0.15,
      positive_examples: ["Explained Lowe's relationship", "Showed support systems", "Demonstrated MasterSuite value"],
      negative_examples: ["Skipped support overview", "Vague about what NAH provides", "No ecosystem discussion"],
    },
    {
      name: "Prospect Confidence",
      description: "Prospect left more confident than they arrived; questions shifted from if to when",
      weight: 0.1,
      positive_examples: ["Prospect expressed excitement", "Questions shifted to when/how", "Doubt visibly reduced"],
      negative_examples: ["Prospect more uncertain after call", "New doubts introduced", "Energy dropped"],
    },
    {
      name: "Next Step Setup",
      description: "Clear advancement to Mark Call with timeline",
      weight: 0.05,
      positive_examples: [
        "Set Mark Call expectation",
        "Clear timeline communicated",
        "Prospect committed to next step",
      ],
      negative_examples: ["Vague about what comes next", "No timeline set", "Prospect left without direction"],
    },
  ],
  mark_call: [
    {
      name: "Financial Assessment",
      description: "Thoroughly reviewed prospect financial position: PFS, liquid capital, net worth",
      weight: 0.25,
      positive_examples: ["Reviewed PFS in detail", "Identified all capital sources", "Asked about debt load"],
      negative_examples: ["Surface-level review", "Took prospect's word at face value", "Missed key financial gaps"],
    },
    {
      name: "Lending Options",
      description: "Presented viable funding paths matched to situation: SBA, ROBS, Alta Capital, conventional",
      weight: 0.25,
      positive_examples: ["Matched options to prospect situation", "Explained ROBS clearly", "Covered SBA process"],
      negative_examples: ["One-size-fits-all approach", "Did not explain options", "Confused the prospect"],
    },
    {
      name: "Gap Identification",
      description: "Honestly flagged financial shortfalls with proposed bridge solutions",
      weight: 0.2,
      positive_examples: ["Flagged shortfall with solution", "Set realistic funding timeline", "Honest about gaps"],
      negative_examples: ["Ignored obvious gaps", "Overpromised on approval", "Did not probe inconsistencies"],
    },
    {
      name: "Risk & Resilience",
      description: "Tested financial stamina; discussed worst-case scenarios and runway",
      weight: 0.15,
      positive_examples: ["Asked about runway if deals slow", "Discussed worst case", "Tested commitment level"],
      negative_examples: ["Only talked best case", "Did not test financial stamina", "Avoided tough scenarios"],
    },
    {
      name: "Go/No-Go Recommendation",
      description: "Gave clear honest assessment of financial viability",
      weight: 0.1,
      positive_examples: ["Clear recommendation given", "Honest assessment shared", "Prospect knows where they stand"],
      negative_examples: ["Ambiguous assessment", "Left prospect confused", "No clear recommendation"],
    },
    {
      name: "Next Steps",
      description: "Clear action items with deadlines: application, PFS review, lending timeline",
      weight: 0.05,
      positive_examples: ["Set specific action items", "Clear deadlines", "Prospect knows what to do next"],
      negative_examples: ["Vague follow-up", "No deadlines set", "Prospect left without direction"],
    },
  ],
  matt_final_call: [
    {
      name: "Agreement Walkthrough",
      description: "Clearly explained key franchise agreement terms and obligations",
      weight: 0.25,
      positive_examples: ["Covered key terms clearly", "Answered questions thoroughly", "No legal jargon confusion"],
      negative_examples: ["Rushed through documents", "Assumed prospect read everything", "Skipped important terms"],
    },
    {
      name: "Final Objection Resolution",
      description: "Surfaced and resolved any remaining hesitations before commitment",
      weight: 0.25,
      positive_examples: ["Asked about remaining concerns", "Addressed final hesitations", "Patient with questions"],
      negative_examples: ["Ignored lingering concerns", "Applied pressure", "Rushed to close"],
    },
    {
      name: "Decision Confirmation",
      description: "Secured clear commitment to proceed; prospect feels confident in decision",
      weight: 0.2,
      positive_examples: ["Clear verbal commitment", "Prospect expressed confidence", "Decision felt right"],
      negative_examples: ["Prospect still hedging", "No clear decision", "Pressure-induced agreement"],
    },
    {
      name: "Investment Recap",
      description: "Final clarity on financial commitment, franchise fee, and timeline",
      weight: 0.15,
      positive_examples: ["Confirmed total investment", "Timeline expectations clear", "No financial surprises"],
      negative_examples: ["Skipped financial recap", "Prospect unclear on costs", "Hidden fee surprise"],
    },
    {
      name: "Onboarding Transition",
      description: "Set clear expectations for what happens after signing",
      weight: 0.1,
      positive_examples: ["Outlined onboarding steps", "Introduced key contacts", "Set first-week expectations"],
      negative_examples: [
        "Abrupt ending after signature",
        "No mention of what comes next",
        "Left prospect in the dark",
      ],
    },
    {
      name: "Energy & Conviction",
      description: "Prospect left excited, confident, and ready to start their franchise journey",
      weight: 0.05,
      positive_examples: ["Prospect expressed excitement", "High energy close", "Clear enthusiasm"],
      negative_examples: ["Prospect seemed deflated", "Low energy", "Buyer remorse signals"],
    },
  ],
  coaching_call: [
    {
      name: "Accountability Review",
      description: "Reviewed commitments from last session; held franchisee to their word",
      weight: 0.2,
      positive_examples: [
        "Reviewed last session actions",
        "Tracked progress with numbers",
        "Held accountable on misses",
      ],
      negative_examples: ["Skipped review", "Let missed commitments slide", "No reference to past goals"],
    },
    {
      name: "Pipeline & Deal Velocity",
      description: "Reviewed active deals, offer volume, and deal pipeline health",
      weight: 0.25,
      positive_examples: ["Reviewed deal pipeline", "Pushed for more offers", "Set deal count targets"],
      negative_examples: ["Did not discuss deals", "No urgency created", "Accepted slow pace"],
    },
    {
      name: "Obstacle Removal",
      description: "Identified and addressed current blockers with specific solutions",
      weight: 0.2,
      positive_examples: ["Asked about challenges", "Found root causes", "Offered specific solutions"],
      negative_examples: ["Ignored problems", "Surface-level discussion", "No actionable solutions"],
    },
    {
      name: "Skill Development",
      description: "Taught or coached on specific skills: construction, lead gen, negotiation, systems",
      weight: 0.15,
      positive_examples: ["Taught a specific skill", "Used real examples", "Connected skill to franchisee needs"],
      negative_examples: ["No coaching moment", "Generic advice only", "Did not address skill gaps"],
    },
    {
      name: "Action Items",
      description: "Set specific, time-bound next actions with clear ownership",
      weight: 0.15,
      positive_examples: ["3+ specific actions set", "Each had a deadline", "Clear ownership on each"],
      negative_examples: ["Vague takeaways", "No deadlines", "Too many items to track"],
    },
    {
      name: "Energy & Motivation",
      description: "Franchisee left energized, focused, and motivated",
      weight: 0.05,
      positive_examples: ["Celebrated wins", "Showed empathy for challenges", "Left franchisee energized"],
      negative_examples: ["Only focused on negatives", "Felt transactional", "Franchisee seemed deflated"],
    },
  ],
  onboarding_call: [
    {
      name: "Systems Setup",
      description: "Walked through GHL, MasterSuite, Trainual, and key operational tools",
      weight: 0.2,
      positive_examples: ["Covered all key tools", "Verified logins work", "Hands-on walkthrough"],
      negative_examples: ["Skipped system setup", "Left franchisee confused", "No hands-on demo"],
    },
    {
      name: "30/60/90 Expectations",
      description: "Set clear milestones, deal count targets, and timeline expectations",
      weight: 0.25,
      positive_examples: ["Covered 30/60/90 milestones", "Set deal count expectations", "Explained support cadence"],
      negative_examples: ["No timeline shared", "Vague expectations", "No milestones set"],
    },
    {
      name: "Territory Orientation",
      description: "Reviewed territory, market conditions, and initial target areas",
      weight: 0.2,
      positive_examples: ["Reviewed territory boundaries", "Discussed market conditions", "Identified target areas"],
      negative_examples: ["No territory discussion", "Generic market overview", "No strategy connection"],
    },
    {
      name: "Support Structure",
      description: "Introduced coach, weekly call schedule, key contacts, and escalation path",
      weight: 0.15,
      positive_examples: ["Introduced coach by name", "Explained weekly calls", "Covered who to contact for what"],
      negative_examples: ["No team intro", "Skipped support resources", "Franchisee does not know who to call"],
    },
    {
      name: "First Deal Readiness",
      description: "Equipped franchisee to start: lead gen basics, deal analysis, construction intro",
      weight: 0.15,
      positive_examples: [
        "Covered lead generation basics",
        "Explained deal analysis process",
        "Set first deal expectations",
      ],
      negative_examples: [
        "No discussion of getting started",
        "Franchisee unsure how to find first deal",
        "Skipped practical steps",
      ],
    },
    {
      name: "Confidence & Energy",
      description: "Franchisee left confident, excited, and clear on their first steps",
      weight: 0.05,
      positive_examples: ["Franchisee expressed excitement", "Questions answered thoroughly", "Clear enthusiasm"],
      negative_examples: ["Franchisee overwhelmed", "Unanswered questions lingered", "Low energy"],
    },
  ],
  group_call: [
    {
      name: "Content Quality",
      description: "Valuable, actionable content with real examples from the field",
      weight: 0.25,
      positive_examples: ["Shared specific tactics", "Used real deal examples", "Content matched audience needs"],
      negative_examples: ["Generic content", "Too theoretical", "Not relevant to attendees"],
    },
    {
      name: "Participant Engagement",
      description: "Multiple participants actively contributing; strong Q&A",
      weight: 0.25,
      positive_examples: ["Multiple people spoke", "Q&A was active", "Peer sharing happened"],
      negative_examples: ["One-way presentation", "Low participation", "Attendees disengaged"],
    },
    {
      name: "Facilitation",
      description: "Good pacing, time management, and balanced participation",
      weight: 0.15,
      positive_examples: ["Stayed on agenda", "Managed dominant speakers", "Good pacing throughout"],
      negative_examples: ["Went off track", "One person dominated", "Ran over time significantly"],
    },
    {
      name: "Real Deal Examples",
      description: "Used actual deals, numbers, or real situations to illustrate points",
      weight: 0.15,
      positive_examples: ["Referenced specific deals", "Showed real numbers", "Concrete not abstract"],
      negative_examples: ["All theory no practice", "No specific examples", "Vague generalities"],
    },
    {
      name: "Actionable Takeaways",
      description: "Clear action items for participants to implement this week",
      weight: 0.15,
      positive_examples: ["Summarized key points", "Set group action items", "Clear next session topic"],
      negative_examples: ["No summary", "No action items", "Ended abruptly without takeaways"],
    },
    {
      name: "Energy & Momentum",
      description: "High energy session that left participants motivated",
      weight: 0.05,
      positive_examples: ["High energy throughout", "Participants left motivated", "Positive group dynamic"],
      negative_examples: ["Low energy", "Felt like a chore", "Group seemed checked out"],
    },
  ],
  team_call: [
    {
      name: "Agenda Clarity",
      description: "Clear agenda communicated; meeting stayed on track",
      weight: 0.15,
      positive_examples: ["Agenda stated upfront", "Stayed on topic", "Organized flow"],
      negative_examples: ["No agenda", "Wandered off topic", "No structure"],
    },
    {
      name: "Decision Quality",
      description: "Clear decisions made, not just discussion; outcomes documented",
      weight: 0.25,
      positive_examples: ["Decisions clearly stated", "Consensus reached", "Outcomes documented"],
      negative_examples: ["All discussion no decisions", "Issues rehashed without resolution", "Ambiguous outcomes"],
    },
    {
      name: "Action Item Clarity",
      description: "Specific actions assigned with owners and deadlines",
      weight: 0.25,
      positive_examples: ["Each action had an owner", "Deadlines set", "Written down during meeting"],
      negative_examples: ["Vague takeaways", "No deadlines", "Unclear who owns what"],
    },
    {
      name: "Information Sharing",
      description: "Key updates communicated effectively to the right people",
      weight: 0.15,
      positive_examples: ["Updates were concise", "Relevant to attendees", "No unnecessary detail"],
      negative_examples: ["Key info missed", "Updates too long", "Wrong audience for the content"],
    },
    {
      name: "Problem Solving",
      description: "Issues identified and addressed with concrete solutions",
      weight: 0.1,
      positive_examples: ["Root causes explored", "Solutions proposed and agreed", "Blockers removed"],
      negative_examples: ["Problems raised but not solved", "Blame without solutions", "Issues ignored"],
    },
    {
      name: "Time Efficiency",
      description: "Efficient use of everyone's time; no unnecessary tangents",
      weight: 0.1,
      positive_examples: ["Ended on time or early", "No unnecessary tangents", "Every minute productive"],
      negative_examples: ["Ran over significantly", "Long tangents", "Could have been an email"],
    },
  ],
};

async function main() {
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "LIVE"}\n`);

  const { data: callTypes } = await supabase.from("call_types").select("id, slug");
  const { data: rubrics } = await supabase.from("rubrics").select("id, call_type_id, is_active").eq("is_active", true);

  for (const [slug, criteria] of Object.entries(RUBRICS)) {
    const ct = callTypes?.find((c) => c.slug === slug);
    if (!ct) {
      console.log(`SKIP: call type ${slug} not found`);
      continue;
    }

    const rubric = rubrics?.find((r) => r.call_type_id === ct.id);
    if (!rubric) {
      console.log(`SKIP: no active rubric for ${slug}`);
      continue;
    }

    console.log(`${slug}: ${criteria.length} criteria`);
    if (!isDryRun) {
      // Delete existing criteria for this rubric
      await supabase.from("rubric_criteria").delete().eq("rubric_id", rubric.id);

      // Insert new criteria
      for (let i = 0; i < criteria.length; i++) {
        const c = criteria[i];
        await supabase.from("rubric_criteria").insert({
          rubric_id: rubric.id,
          name: c.name,
          description: c.description,
          weight: c.weight,
          sort_order: i,
          positive_examples: c.positive_examples,
          negative_examples: c.negative_examples,
        });
      }
      console.log(`  Done — ${criteria.length} criteria inserted`);
    }
  }
  console.log("\nDone.");
}

main().catch(console.error);
