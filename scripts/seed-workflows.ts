/**
 * Seed Workflows — creates the 9 workflow templates with steps.
 *
 * Creates each workflow as a draft, adds version 1, and populates
 * the step content from the spec in docs/workflows.md.
 *
 * Safe to run multiple times — skips workflows that already exist by name.
 *
 * Usage: npx tsx scripts/seed-workflows.ts
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface StepDef {
  day: number;
  type: "sms" | "email" | "chad_call_task" | "team_notify" | "condition_check" | "trainual_check" | "ai_agent_action" | "stage_move_suggestion";
  content: string;
  subject?: string;
  confirm: boolean;
}

interface WorkflowDef {
  name: string;
  description: string;
  type: string;
  trigger: string;
  maxDays: number;
  primaryMetric: string;
  steps: StepDef[];
}

const WORKFLOWS: WorkflowDef[] = [
  {
    name: "New Lead 30-Day Sequence",
    description: "Get the prospect on a call with Chad and into Trainual within 30 days.",
    type: "new_lead_30day",
    trigger: "stage_entry:new_lead",
    maxDays: 30,
    primaryMetric: "Call booking rate",
    steps: [
      { day: 1, type: "sms", content: "Hey [FirstName], this is Chad with New Again Houses. Thanks for your interest in our franchise opportunity! I'd love to learn more about your goals. When's a good time for a quick call?", confirm: true },
      { day: 1, type: "email", subject: "Welcome to New Again Houses", content: "Hi [FirstName],\n\nThanks for reaching out about the New Again Houses franchise opportunity. I'm Chad, and I'll be your guide through this process.\n\nNew Again Houses is a proven house-flipping franchise with exclusive territories, construction coaching, and our Lowe's partnership.\n\nI'd love to schedule a quick call to learn about your goals and see if NAH might be the right fit.\n\nWhat does your schedule look like this week?\n\nBest,\nChad", confirm: true },
      { day: 3, type: "chad_call_task", content: "Day 3 call: First personal touch with [Name]. Goal: understand their background and interest level.", confirm: false },
      { day: 3, type: "sms", content: "Hey [FirstName] — just following up on my message. Would love to connect this week if you're available. What works best for you?", confirm: true },
      { day: 5, type: "email", subject: "What makes NAH different", content: "Hi [FirstName],\n\nI wanted to share what sets New Again Houses apart from other franchise opportunities:\n\n- Exclusive territories that protect your investment\n- Construction coaching from day one\n- Our Lowe's partnership for materials savings\n- Proven systems that reduce the learning curve\n\nMost solo house flippers struggle in year one. NAH franchisees have the system, support, and brand already built.\n\nWant to hop on a call to discuss?\n\nChad", confirm: true },
      { day: 7, type: "sms", content: "[FirstName], just checking in. Still interested in learning about the NAH franchise? Happy to answer any questions.", confirm: true },
      { day: 7, type: "ai_agent_action", content: "Check if call has been booked. If not, draft scheduling message with available time slots.", confirm: false },
      { day: 10, type: "chad_call_task", content: "Day 10 call: Follow up with [Name]. If no prior contact, this is critical — personal touch needed.", confirm: false },
      { day: 10, type: "email", subject: "A quick question for you", content: "Hi [FirstName],\n\nI have a quick question — what's your timeline for getting into business ownership?\n\nUnderstanding where you are helps me tailor the information I share. Whether you're ready now or exploring for the future, I'm here to help.\n\nJust reply to this email or give me a call.\n\nChad", confirm: true },
      { day: 14, type: "chad_call_task", content: "Day 14 call: Mid-sequence check with [Name]. Assess engagement level and adjust approach.", confirm: false },
      { day: 14, type: "sms", content: "Hey [FirstName] — I know life gets busy. Just wanted you to know I'm here whenever you're ready to chat about the NAH opportunity. No pressure.", confirm: true },
      { day: 17, type: "email", subject: "Franchisee spotlight", content: "Hi [FirstName],\n\nI wanted to share a quick story. One of our franchisees came in with zero house flipping experience. Within 6 months, they had their first successful flip using our system.\n\nThat's the power of a proven model — you don't have to figure it out alone.\n\nI'd love to share more about what the first 90 days look like. Want to schedule a call?\n\nChad", confirm: true },
      { day: 20, type: "chad_call_task", content: "Day 20 call: Re-engagement attempt with [Name]. If still no contact, consider territory or timing pivot.", confirm: false },
      { day: 20, type: "sms", content: "[FirstName], I've been thinking about your area — there may be some great territory options available. Want to take a look?", confirm: true },
      { day: 24, type: "email", subject: "Your questions answered", content: "Hi [FirstName],\n\nHere are the most common questions I get from prospects:\n\nQ: How much does it cost?\nA: The investment varies, but most franchisees fund through SBA loans, retirement rollovers, or financing partners.\n\nQ: Do I need experience?\nA: No. Our system and coaching are built for people new to house flipping.\n\nQ: What about territory?\nA: Territories are exclusive — that's what protects your investment.\n\nI'd love to answer any specific questions you have. Just hit reply.\n\nChad", confirm: true },
      { day: 27, type: "sms", content: "Hey [FirstName], just a heads up — we're getting more interest in your area. If territory matters to you, let's connect soon.", confirm: true },
      { day: 30, type: "chad_call_task", content: "Day 30 final call: Last attempt with [Name]. If no engagement, move to Follow-up pipeline.", confirm: false },
      { day: 30, type: "sms", content: "[FirstName], this is my last scheduled reach-out for now. If the timing isn't right, no worries — the door is always open. Wishing you the best.", confirm: true },
    ],
  },
  {
    name: "Pre-Call Reminder",
    description: "Reduce no-shows and set expectations for upcoming calls.",
    type: "pre_call_reminder",
    trigger: "appointment_created",
    maxDays: 2,
    primaryMetric: "No-show rate",
    steps: [
      { day: 1, type: "sms", content: "Hey [FirstName] — confirming our call on [date] at [time]. Looking forward to it!", confirm: true },
      { day: 1, type: "email", subject: "What to expect on our call", content: "Hi [FirstName],\n\nI'm looking forward to our upcoming call. Here's what we'll cover:\n\n- Your background and goals\n- How the NAH franchise model works\n- Territory availability in your area\n- Next steps if it feels like a fit\n\nNo pressure — this is a conversation, not a sales pitch.\n\nSee you soon,\nChad", confirm: true },
      { day: 2, type: "sms", content: "[FirstName] — just a reminder about our call today. See you soon!", confirm: true },
    ],
  },
  {
    name: "Post-Call Follow-up",
    description: "Recap the call and deliver next steps.",
    type: "post_call_followup",
    trigger: "call_completed",
    maxDays: 3,
    primaryMetric: "Next step completion rate",
    steps: [
      { day: 1, type: "email", subject: "Great talking with you", content: "Hi [FirstName],\n\nGreat talking with you today! Here's a quick recap of what we discussed and the agreed next steps.\n\n[Scout will personalize this based on Chad's call notes]\n\nLet me know if you have any questions.\n\nChad", confirm: true },
      { day: 2, type: "sms", content: "Hey [FirstName] — check your email for the recap from our call. Let me know if you have any questions!", confirm: true },
      { day: 3, type: "sms", content: "[FirstName], just checking in on the next steps we discussed. Anything I can help with?", confirm: true },
    ],
  },
  {
    name: "Trainual Nudge",
    description: "Get the prospect to open Trainual within 48 hours of receiving access.",
    type: "trainual_nudge",
    trigger: "trainual_access_granted",
    maxDays: 7,
    primaryMetric: "Trainual open rate",
    steps: [
      { day: 1, type: "trainual_check", content: "Check if prospect has opened Trainual", confirm: false },
      { day: 1, type: "sms", content: "Hey [FirstName] — did you get a chance to check out the Trainual link I sent? It walks you through the NAH model step by step.", confirm: true },
      { day: 2, type: "trainual_check", content: "48hr check — has Trainual been opened?", confirm: false },
      { day: 2, type: "sms", content: "[FirstName], here's the Trainual link again in case you missed it: [link]. It's a quick overview of how the franchise works.", confirm: true },
      { day: 2, type: "chad_call_task", content: "48hr no-open alert: [Name] hasn't opened Trainual. Personal follow-up needed.", confirm: false },
      { day: 4, type: "sms", content: "Hey [FirstName] — most prospects who open Trainual move forward faster. It's a quick read and really lays out the opportunity. Worth a look!", confirm: true },
      { day: 7, type: "sms", content: "[FirstName], just wanted to personally encourage you to check out the Trainual overview. It answers a lot of the common questions I hear. Let me know what you think.", confirm: true },
    ],
  },
  {
    name: "FDD Nurture (14-Day)",
    description: "Keep prospects engaged during the mandatory 14-day FDD review period with legal-safe content.",
    type: "fdd_nurture",
    trigger: "stage_entry:fdd_delivered",
    maxDays: 14,
    primaryMetric: "Engagement rate",
    steps: [
      { day: 1, type: "email", subject: "Your FDD review period has started", content: "Hi [FirstName],\n\nYour Franchise Disclosure Document (FDD) review period has officially started. This is a mandatory 14-day period where you can review the document at your own pace.\n\nDuring this time, I'll check in periodically with helpful information. No pressure, no rush — this is your time to review.\n\nFor legal questions, please consult your attorney.\n\nChad", confirm: true },
      { day: 3, type: "sms", content: "Hey [FirstName] — how's the FDD review going? Any questions so far? For legal questions, please consult your attorney.", confirm: true },
      { day: 5, type: "email", subject: "Understanding the NAH business model", content: "Hi [FirstName],\n\nWhile you review your FDD, I wanted to share some context about how the NAH business model works in practice. Our franchisees benefit from exclusive territories, construction coaching, and proven systems that reduce the typical learning curve.\n\nThis is educational context to help you understand what you're reading in the FDD.\n\nFor any legal questions about the document, please consult your attorney.\n\nChad", confirm: true },
      { day: 7, type: "sms", content: "[FirstName] — checking in on week one of your FDD review. How are things looking? Happy to answer any general questions. For legal questions, please consult your attorney.", confirm: true },
      { day: 9, type: "email", subject: "Meet one of our franchisees", content: "Hi [FirstName],\n\nI wanted to share a bit about the NAH franchisee experience. Our franchise owners come from diverse backgrounds — some with construction experience, many without.\n\nWhat they all have in common is the support system that helps them succeed from day one.\n\nFor any legal questions about your FDD, please consult your attorney.\n\nChad", confirm: true },
      { day: 10, type: "sms", content: "Hey [FirstName], just checking in. Your FDD review is past the halfway point. Any questions I can help with? For legal questions, please consult your attorney.", confirm: true },
      { day: 12, type: "email", subject: "What happens after your FDD review", content: "Hi [FirstName],\n\nYour 14-day FDD review period is almost complete. Here's what the next steps look like:\n\n1. We'll schedule a decision call to discuss your thoughts\n2. If you decide to move forward, we'll walk through the agreement\n3. Then we kick off onboarding — territory setup, training, and your first project\n\nNo decisions needed yet — just wanted you to know what's ahead.\n\nFor any legal questions, please consult your attorney.\n\nChad", confirm: true },
      { day: 14, type: "sms", content: "[FirstName], your FDD review period is complete. Ready to discuss next steps? I'd love to schedule a call when you're ready.", confirm: true },
    ],
  },
  {
    name: "Re-engagement",
    description: "Bring cold leads back from Nurture or Follow-up pipelines.",
    type: "re_engagement",
    trigger: "manual_enrollment",
    maxDays: 14,
    primaryMetric: "Response rate",
    steps: [
      { day: 1, type: "sms", content: "Hey [FirstName], it's Chad with New Again Houses. It's been a while — just wanted to check in. Has anything changed on your end?", confirm: true },
      { day: 3, type: "email", subject: "Exciting updates at NAH", content: "Hi [FirstName],\n\nHope you've been well! A lot has happened at New Again Houses since we last spoke. We've continued growing and supporting our franchisees across the country.\n\nI wanted to reconnect and see if the timing might be better now. No pressure — just wanted to keep you in the loop.\n\nWould love to catch up if you're open to it.\n\nChad", confirm: true },
      { day: 5, type: "sms", content: "[FirstName], still thinking about business ownership? Would love to reconnect and share what's new at NAH.", confirm: true },
      { day: 7, type: "email", subject: "Thinking of you", content: "Hi [FirstName],\n\nI was looking back at our previous conversation and wanted to reach out personally. Your background and interest stood out to me.\n\nIf the timing is better now, I'd love to pick up where we left off. If not, no worries at all.\n\nThe door is always open.\n\nChad", confirm: true },
      { day: 10, type: "sms", content: "Hey [FirstName] — quick update: there may be territory availability in your area. Want me to check?", confirm: true },
      { day: 14, type: "email", subject: "The door is always open", content: "Hi [FirstName],\n\nThis is my last scheduled reach-out for now. I want you to know that whenever the timing is right for you, we're here.\n\nNew Again Houses isn't going anywhere, and your interest means a lot to us.\n\nWishing you all the best,\nChad", confirm: true },
    ],
  },
  {
    name: "Long-term Nurture",
    description: "Monthly touch from Chad plus automated value content for prospects with future potential.",
    type: "long_term_nurture",
    trigger: "stage_entry:nurture",
    maxDays: 90,
    primaryMetric: "Content engagement rate",
    steps: [
      { day: 14, type: "email", subject: "Market insights from NAH", content: "Hi [FirstName],\n\nWanted to share some insights from the house flipping market. The opportunity continues to grow, especially for franchisees with exclusive territories and proven systems.\n\nHope you find this interesting. As always, if you want to chat, I'm here.\n\nChad", confirm: true },
      { day: 30, type: "chad_call_task", content: "Monthly personal touch with [Name]. Check in, provide value, assess readiness.", confirm: false },
      { day: 30, type: "sms", content: "Hey [FirstName], just checking in. Hope all is well! If anything changes on your end, you know where to find me.", confirm: true },
      { day: 45, type: "email", subject: "Franchisee spotlight", content: "Hi [FirstName],\n\nWanted to share a quick franchisee story — it's always inspiring to see how people from different backgrounds succeed with the NAH system.\n\nHope this finds you well.\n\nChad", confirm: true },
      { day: 60, type: "chad_call_task", content: "60-day check with [Name]. Assess if re-engagement sequence should be triggered.", confirm: false },
      { day: 60, type: "email", subject: "What's new at New Again Houses", content: "Hi [FirstName],\n\nQuick update on what's happening at NAH — new markets, new franchisees, and continued growth.\n\nIf you're curious about what's changed since we last spoke, I'd love to catch up.\n\nChad", confirm: true },
      { day: 75, type: "sms", content: "[FirstName], it's been a couple months. Has anything changed? Would love to reconnect if the timing is better now.", confirm: true },
      { day: 90, type: "ai_agent_action", content: "90-day review: assess engagement. If zero opens/clicks, recommend archive review.", confirm: false },
    ],
  },
  {
    name: "Follow-up Cadence",
    description: "Consistent touches for warm leads with interest but no locked-in next step.",
    type: "follow_up_cadence",
    trigger: "stage_entry:follow_up",
    maxDays: 28,
    primaryMetric: "Re-engagement rate",
    steps: [
      { day: 7, type: "chad_call_task", content: "7-day follow-up with [Name]. Draft next message based on last conversation.", confirm: false },
      { day: 7, type: "sms", content: "Hey [FirstName], just following up from our last conversation. Anything new on your end?", confirm: true },
      { day: 14, type: "email", subject: "Tailored for you", content: "Hi [FirstName],\n\nI was thinking about our conversation and wanted to share some information specifically relevant to your situation.\n\n[Scout will tailor based on conversation history and objections]\n\nLet me know your thoughts.\n\nChad", confirm: true },
      { day: 21, type: "chad_call_task", content: "21-day follow-up with [Name]. Personal call recommended — assess if lead should move back to pipeline or to nurture.", confirm: false },
      { day: 21, type: "sms", content: "[FirstName], wanted to check in. I know timing is everything — just want to make sure I'm here when you're ready.", confirm: true },
      { day: 28, type: "email", subject: "Keeping the door open", content: "Hi [FirstName],\n\nJust a quick note to say I'm here whenever you're ready to continue the conversation. No rush, no pressure.\n\nIn the meantime, if you have any questions, just hit reply.\n\nChad", confirm: true },
    ],
  },
  {
    name: "Onboarding Welcome",
    description: "Welcome new franchisee and kick off onboarding at Funds Received stage.",
    type: "onboarding_welcome",
    trigger: "stage_entry:funds_received",
    maxDays: 14,
    primaryMetric: "Onboarding task completion rate",
    steps: [
      { day: 1, type: "sms", content: "Congratulations [FirstName]! Welcome to the New Again Houses family! Check your email for your onboarding overview.", confirm: true },
      { day: 1, type: "email", subject: "Welcome to New Again Houses!", content: "Hi [FirstName],\n\nCongratulations and welcome to the New Again Houses franchise family!\n\nI'm thrilled to have you on board. Here's what happens next:\n\n- Your welcome kit information is on its way\n- Your territory setup begins immediately\n- Your onboarding schedule will be shared within 48 hours\n\nYou'll be hearing from our team members shortly to get everything rolling.\n\nWelcome aboard!\nChad", confirm: true },
      { day: 1, type: "team_notify", content: "New franchisee closed: [Name]. Notify construction coach, lending partner, and leadership.", confirm: false },
      { day: 2, type: "email", subject: "Meet your construction coach", content: "Hi [FirstName],\n\nOne of the biggest advantages of the NAH franchise is having a dedicated construction coach. They'll guide you through your first projects and help you build confidence.\n\nYour coach will be reaching out shortly to schedule an intro call.\n\nExciting times ahead!\nChad", confirm: true },
      { day: 3, type: "sms", content: "Hey [FirstName] — how are you feeling? Any immediate questions as we get started? I'm here for you.", confirm: true },
      { day: 5, type: "email", subject: "Your financing next steps", content: "Hi [FirstName],\n\nNow that you're officially part of the team, our lending partner will be reaching out to discuss financing options for your first projects.\n\nThey'll walk you through everything and make sure you're set up for success.\n\nChad", confirm: true },
      { day: 7, type: "email", subject: "Training schedule and access", content: "Hi [FirstName],\n\nYour training schedule and access credentials should be in your inbox. If you haven't received them, let me know and I'll make sure they're sent right away.\n\nThe first 30 days are all about getting you up to speed. The next 60 are about your first project. And by day 90, you'll be running the show.\n\nChad", confirm: true },
      { day: 14, type: "sms", content: "[FirstName] — two weeks in! How's onboarding going? Let's schedule a call if we haven't already to make sure you have everything you need.", confirm: true },
      { day: 14, type: "chad_call_task", content: "14-day onboarding check with [Name]. Ensure first onboarding call is scheduled.", confirm: false },
    ],
  },
];

async function seedWorkflows() {
  console.log("=== Seeding Workflows ===\n");

  // Get a user ID for created_by (use the first admin/leadership user)
  const { data: users } = await supabase
    .from("users")
    .select("id, role")
    .in("role", ["leadership"])
    .limit(1);

  let userId: string;
  if (users && users.length > 0) {
    userId = users[0].id;
  } else {
    // Fallback: use any user
    const { data: anyUser } = await supabase.from("users").select("id").limit(1).single();
    if (!anyUser) {
      console.error("No users found. Create a user first.");
      process.exit(1);
    }
    userId = anyUser.id;
  }

  let created = 0;
  let skipped = 0;

  for (const wf of WORKFLOWS) {
    // Check if workflow already exists
    const { data: existing } = await supabase
      .from("workflows")
      .select("id")
      .eq("name", wf.name)
      .limit(1)
      .single();

    if (existing) {
      console.log(`  ↻ SKIP: ${wf.name} (already exists)`);
      skipped++;
      continue;
    }

    // Create workflow
    const { data: workflow, error: wfErr } = await supabase
      .from("workflows")
      .insert({
        name: wf.name,
        description: wf.description,
        workflow_type: wf.type,
        trigger_type: wf.trigger,
        exit_conditions: { maxDays: wf.maxDays },
        primary_metric_name: wf.primaryMetric,
        status: "draft",
        health_score: "C",
        created_by: userId,
      })
      .select()
      .single();

    if (wfErr || !workflow) {
      console.error(`  ✗ FAIL: ${wf.name} — ${wfErr?.message}`);
      continue;
    }

    // Create version 1
    const { data: version, error: verErr } = await supabase
      .from("workflow_versions")
      .insert({
        workflow_id: workflow.id,
        version_number: 1,
        change_description: "Initial seed version",
        created_by: userId,
      })
      .select()
      .single();

    if (verErr || !version) {
      console.error(`  ✗ FAIL: ${wf.name} version — ${verErr?.message}`);
      continue;
    }

    // Update workflow with current_version_id
    await supabase
      .from("workflows")
      .update({ current_version_id: version.id })
      .eq("id", workflow.id);

    // Create steps
    let stepNum = 1;
    for (const step of wf.steps) {
      await supabase.from("workflow_steps").insert({
        workflow_version_id: version.id,
        step_number: stepNum,
        day_number: step.day,
        step_type: step.type,
        content: step.content,
        subject: step.subject ?? null,
        requires_confirmation: step.confirm,
      });
      stepNum++;
    }

    console.log(`  ✓ ${wf.name} — ${wf.steps.length} steps`);
    created++;
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped`);
}

seedWorkflows().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
