/**
 * Seed default rubric criteria for all 5 call types.
 * Usage: npx tsx scripts/seed-default-rubrics.ts --dry-run
 *        npx tsx scripts/seed-default-rubrics.ts --live
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const isDryRun = !process.argv.includes("--live");

interface CriterionSeed {
  name: string;
  description: string;
  weight: number;
  positive_examples: string[];
  negative_examples: string[];
  example_phrases_positive: string[];
  example_phrases_negative: string[];
}

const RUBRICS: Record<string, CriterionSeed[]> = {
  intro_call: [
    { name: "Rapport Building", description: "Did the rep build genuine connection and warmth in the opening?", weight: 1.0,
      positive_examples: ["Used prospect's name naturally", "Found common ground quickly", "Warm, confident tone"],
      negative_examples: ["Jumped straight to pitch", "Read from a script", "Sounded rushed or disinterested"],
      example_phrases_positive: ["I saw you're based in [city] — great market", "Tell me a bit about what sparked your interest"],
      example_phrases_negative: ["So let me tell you about our franchise..."] },
    { name: "Motivation Discovery", description: "Did the rep uncover WHY the prospect is interested in franchising?", weight: 1.2,
      positive_examples: ["Asked open-ended questions about goals", "Explored life situation driving the interest"],
      negative_examples: ["Assumed motivation", "Didn't ask about background at all"],
      example_phrases_positive: ["What's driving your interest in owning a franchise right now?"],
      example_phrases_negative: ["So you want to flip houses, right?"] },
    { name: "Capital Awareness", description: "Did the rep tactfully assess financial readiness?", weight: 1.0,
      positive_examples: ["Introduced capital topic naturally", "Mentioned financing options proactively"],
      negative_examples: ["Avoided the money topic entirely", "Asked bluntly about net worth"],
      example_phrases_positive: ["Most of our franchisees fund through retirement rollovers or SBA loans"],
      example_phrases_negative: ["How much money do you have?"] },
    { name: "NAH Value Proposition", description: "Did the rep communicate what makes NAH different from going solo?", weight: 1.0,
      positive_examples: ["Referenced Lowe's partnership, Lead Launchpad, MasterSuite", "Contrasted solo vs franchise success rates"],
      negative_examples: ["Gave generic franchise pitch", "Didn't differentiate NAH"],
      example_phrases_positive: ["Solo flippers have a high failure rate — NAH gives you the system from day one"],
      example_phrases_negative: [] },
    { name: "Next Step Commitment", description: "Did the rep establish a clear, time-bound next action?", weight: 1.2,
      positive_examples: ["Scheduled specific next call", "Sent PTO materials with follow-up date"],
      negative_examples: ["Ended with vague 'I'll follow up'", "No next step at all"],
      example_phrases_positive: ["Let's schedule your discovery call with Matt — does Thursday at 2 work?"],
      example_phrases_negative: ["I'll send you some info and we'll circle back"] },
  ],
  matt_call: [
    { name: "Rapport & Warmth", description: "Did Matt build trust and make the prospect comfortable?", weight: 0.8,
      positive_examples: ["Referenced prior conversations", "Made prospect feel heard"],
      negative_examples: ["Cold opening", "Didn't acknowledge prospect's journey so far"],
      example_phrases_positive: ["Chad told me you're really excited about [territory] — tell me more"],
      example_phrases_negative: [] },
    { name: "Prospect Discovery", description: "Did Matt uncover the prospect's real goals, fears, and situation?", weight: 1.2,
      positive_examples: ["Asked about family support", "Explored financial situation thoroughly", "Uncovered hidden objections"],
      negative_examples: ["Surface-level questions only", "Didn't explore capital concerns"],
      example_phrases_positive: ["Is your spouse on board? What's their biggest concern?"],
      example_phrases_negative: [] },
    { name: "Story Alignment", description: "Did Matt tell the NAH story in a way that matched the prospect's goals?", weight: 1.0,
      positive_examples: ["Connected prospect's goals to NAH's model", "Used relevant franchisee success stories"],
      negative_examples: ["Generic pitch", "Didn't customize to prospect"],
      example_phrases_positive: ["Given your background in [X], you'd actually excel at the acquisition side"],
      example_phrases_negative: [] },
    { name: "Objection Handling", description: "Did Matt address hesitations directly and honestly?", weight: 1.2,
      positive_examples: ["Acknowledged the concern before addressing it", "Used specific data or examples"],
      negative_examples: ["Dismissed concerns", "Got defensive"],
      example_phrases_positive: ["That's a fair concern — let me show you how other franchisees handled that"],
      example_phrases_negative: ["That's not really an issue"] },
    { name: "Next Step Clarity", description: "Did Matt establish a committed next action with timeline?", weight: 1.0,
      positive_examples: ["Scheduled Sam Call", "Set specific homework with deadline"],
      negative_examples: ["Vague follow-up", "Prospect left without commitment"],
      example_phrases_positive: ["Your next step is the validation call with Sam — I'll have Chad schedule that this week"],
      example_phrases_negative: [] },
  ],
  sam_call: [
    { name: "Market Analysis", description: "Did Sam demonstrate territory viability with data?", weight: 1.2,
      positive_examples: ["Showed market data for prospect's area", "Discussed deal flow realistically"],
      negative_examples: ["Vague assurances about the market", "No data presented"],
      example_phrases_positive: ["In your territory, we're seeing X deals per month in the $100-200K range"],
      example_phrases_negative: [] },
    { name: "Operational Realism", description: "Did Sam set realistic expectations about the work?", weight: 1.0,
      positive_examples: ["Discussed time commitment honestly", "Covered construction management reality"],
      negative_examples: ["Made it sound too easy", "Glossed over challenges"],
      example_phrases_positive: ["The first 6 months are intense — you'll be hands-on learning the systems"],
      example_phrases_negative: [] },
    { name: "Capital Structure", description: "Did Sam verify the prospect understands the financial model?", weight: 1.0,
      positive_examples: ["Reviewed typical deal economics", "Confirmed funding path"],
      negative_examples: ["Avoided financials", "Assumed prospect understood"],
      example_phrases_positive: ["Let's walk through a typical deal — your all-in cost, expected ARV, and margin"],
      example_phrases_negative: [] },
    { name: "Prospect Confidence", description: "Did the prospect leave more confident than they arrived?", weight: 1.0,
      positive_examples: ["Prospect expressed excitement", "Questions shifted from 'if' to 'when'"],
      negative_examples: ["Prospect seemed more uncertain after call", "New doubts introduced"],
      example_phrases_positive: [], example_phrases_negative: [] },
  ],
  mark_call: [
    { name: "Financial Assessment", description: "Did Mark thoroughly review the prospect's financial position?", weight: 1.2,
      positive_examples: ["Reviewed PFS in detail", "Identified all capital sources"],
      negative_examples: ["Surface review only", "Missed key financial gaps"],
      example_phrases_positive: ["Let's go through your PFS line by line — I want to make sure we have the full picture"],
      example_phrases_negative: [] },
    { name: "Lending Options", description: "Did Mark present viable funding paths?", weight: 1.2,
      positive_examples: ["Explained ROBS, SBA, Alta Capital options", "Matched to prospect's situation"],
      negative_examples: ["One-size-fits-all approach", "Didn't explore alternatives"],
      example_phrases_positive: ["Based on your 401k balance, a ROBS rollover could fund 80% of your startup"],
      example_phrases_negative: [] },
    { name: "Gap Identification", description: "Did Mark honestly identify any capital gaps and solutions?", weight: 1.0,
      positive_examples: ["Flagged shortfall with proposed solution", "Set realistic timeline for funding"],
      negative_examples: ["Ignored obvious gaps", "Overpromised on approval"],
      example_phrases_positive: ["You're about $30K short — here are two ways we can bridge that"],
      example_phrases_negative: [] },
    { name: "Recommendation Clarity", description: "Did Mark give a clear go/no-go recommendation?", weight: 1.0,
      positive_examples: ["Clear 'you're a strong candidate financially' or honest 'here's what needs to change'"],
      negative_examples: ["Ambiguous assessment", "Left prospect confused about viability"],
      example_phrases_positive: ["My recommendation is to proceed — you have the capital structure to succeed"],
      example_phrases_negative: [] },
  ],
  matt_final_call: [
    { name: "Agreement Review", description: "Did Matt walk through the franchise agreement clearly?", weight: 1.0,
      positive_examples: ["Covered key terms", "Answered questions thoroughly"],
      negative_examples: ["Rushed through documents", "Assumed prospect read everything"],
      example_phrases_positive: ["Let's go through the key sections of the agreement together"],
      example_phrases_negative: [] },
    { name: "Objection Resolution", description: "Were any remaining concerns resolved?", weight: 1.2,
      positive_examples: ["Addressed final hesitations", "Used closing techniques appropriately"],
      negative_examples: ["Ignored lingering concerns", "Applied pressure"],
      example_phrases_positive: ["Before we finalize, is there anything still on your mind?"],
      example_phrases_negative: [] },
    { name: "Commitment Confirmation", description: "Did the prospect commit to moving forward?", weight: 1.0,
      positive_examples: ["Clear verbal or written commitment", "Discussed onboarding timeline"],
      negative_examples: ["Ended without clear decision", "Prospect still hedging"],
      example_phrases_positive: ["Welcome to the NAH family — let me walk you through what happens next"],
      example_phrases_negative: [] },
    { name: "Onboarding Transition", description: "Did Matt set expectations for what comes after signing?", weight: 0.8,
      positive_examples: ["Outlined onboarding steps", "Introduced key team members"],
      negative_examples: ["Abrupt ending after signature", "No mention of what's next"],
      example_phrases_positive: ["In the next 2 weeks, you'll hear from our onboarding team about entity setup and training"],
      example_phrases_negative: [] },
  ],
};

async function main() {
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "LIVE"}\n`);

  const { data: callTypes } = await supabase.from("call_types").select("id, slug");
  const { data: rubrics } = await supabase.from("rubrics").select("id, call_type_id, is_active").eq("is_active", true);

  for (const [slug, criteria] of Object.entries(RUBRICS)) {
    const ct = callTypes?.find((c) => c.slug === slug);
    if (!ct) { console.log(`SKIP: call type ${slug} not found`); continue; }

    const rubric = rubrics?.find((r) => r.call_type_id === ct.id);
    if (!rubric) { console.log(`SKIP: no active rubric for ${slug}`); continue; }

    // Check if already has criteria
    const { count } = await supabase.from("rubric_criteria").select("*", { count: "exact", head: true })
      .eq("rubric_id", rubric.id).not("description", "is", null);
    if (count && count > 0) {
      console.log(`SKIP: ${slug} already has ${count} populated criteria`);
      continue;
    }

    console.log(`${slug}: would insert ${criteria.length} criteria`);
    if (!isDryRun) {
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
          example_phrases_positive: c.example_phrases_positive,
          example_phrases_negative: c.example_phrases_negative,
        });
      }
      console.log(`  ✓ Inserted ${criteria.length} criteria for ${slug}`);
    }
  }
  console.log("\nDone.");
}

main().catch(console.error);
