/**
 * Import Frandev CRM Meeting Notes to KB
 *
 * Reads the Frandev meeting PDF/transcript and creates structured KB documents.
 * Each doc is tagged with seeded_from: 'frandev_meeting_2026_03_27'.
 *
 * Usage: npx tsx scripts/import-frandev-notes.ts <path-to-file>
 *
 * If no file provided, creates placeholder docs with the key content
 * extracted during the 2026-03-27 planning session.
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const FRANDEV_KB_DOCS = [
  {
    title: "NAH Sales Process Overview",
    category: "sales_methodology",
    content: `## NAH Franchise Sales Process

### Pipeline Philosophy
The NAH franchise sales process is a mutual vetting process, not a traditional sales funnel. Both parties are evaluating fit simultaneously.

### Stage Flow
1. **Engagement** — Initial contact, speed-to-lead response, framing call
2. **Qualification** — NDA, Trainual access, background assessment
3. **Discovery** — Matt call (franchisor vision/culture/fit), Zorakle assessment
4. **Compliance** — Sam validation call, Mark capital call, FDD review, background check
5. **Awarding** — Territory presentation, Matt final call, franchise agreement

### Key Rules
- Chad orchestrates the entire journey — never hands off, schedules all calls
- 84% of prospects never opened Trainual when invite fired cold (without Chad framing call)
- Fix: Chad framing call must be logged BEFORE Trainual invite fires
- Average deal length: several months (varies by prospect)
- One territory per franchisee — territories are exclusive

### Team Roles
- **Chad** (Operator): Owns full journey, orchestrates team involvement
- **Matt** (Admin): Runs Discovery call — prospect meets the franchisor
- **Sam** (Specialist): Runs Validation call — prospect vets operations
- **Mark** (Specialist): Runs Capital call — #1 objection handler, funding focus
- **John** (Specialist): Coaching framework support`,
  },
  {
    title: "Capital and Funding Objections Playbook",
    category: "objection_library",
    content: `## Capital & Funding Objections

### Objection: Investment Size Too High
- **Frequency**: Most common objection across all prospects
- **Approach**: Reframe from cost to asset. Surface financing options immediately.
- **Resources**: Guidant Financial, Alta Capital, ROBS (Rollover for Business Startups)
- **Key message**: "You are not spending money — you are buying a proven system. Most franchisees fund through retirement rollovers or SBA loans, not out-of-pocket cash."

### Objection: Uncertain ROI
- **Approach**: Reference unit economics, existing franchisee performance data
- **Key message**: "Let me show you what our existing franchisees are actually doing in their first year."

### Objection: Timing / Not Ready
- **Approach**: Understand what specifically needs to change. Most timing objections are capital or confidence in disguise.
- **Key question**: "What would need to be true for the timing to be right?"

### Objection: Spouse/Partner Resistance
- **Approach**: Offer spouse-inclusive calls, provide written materials for at-home review
- **Key message**: Include spouse early — don't let this fester as a hidden blocker

### Capital Timeline Issue
From Frandev meeting (2026-03-27): Capital timing is a recurring pattern — many prospects have the funds but the timeline to access them (ROBS processing, SBA approval) creates a multi-month gap. Scout should track capital_timeline separately from capital_availability.`,
  },
  {
    title: "Red Flags and Dropout Patterns",
    category: "ideal_candidate",
    content: `## Red Flags & Dropout Patterns

### From Frandev Meeting (2026-03-27)

**84% Trainual Fallout**: When Trainual invite was sent cold (without Chad's framing call first), 84% of prospects never opened it. This is now enforced: framing call must be logged before invite fires.

**Capital Timing Gap**: Prospects with ROBS or SBA funding often have a 2-4 month processing window. This creates a dead zone where engagement drops. Scout should flag this pattern and suggest bridge engagement activities.

**Going Cold Pattern**:
- Day 3 of no response → Surface to Chad for personal call
- Day 7 of no response → Move to Nurture
- Value-based content only during cold periods — never pressure

**Top Deal Loss Reasons** (in order):
1. Capital concerns / investment size
2. Timing ("not the right time")
3. Chose competitor
4. Territory unavailability
5. Non-committal behavior / ghosting
6. Bad fit identified during process

**Ghost Risk Indicators**:
- Declining response speed across last 3 touchpoints
- No-show on scheduled call (especially 2nd occurrence)
- Stopped engaging with Trainual content
- "I need to think about it" without a specific timeline`,
  },
  {
    title: "NAH Business Model and Platform Overview",
    category: "product_knowledge",
    content: `## NAH Business Model

### What NAH Offers Franchisees
- Proven house flipping system with established methodology
- Lowe's partnership for materials and supplies
- Construction coaching from experienced professionals
- Lead Launchpad for deal sourcing
- MasterSuite platform for operations management
- Support hubs for ongoing franchisee assistance
- Exclusive territory protection

### Why Franchise vs Solo Flipping
"Solo house flippers have a high failure rate in year one. NAH franchisees have the system, support, and brand already built. You're buying years of trial and error — avoided."

### Territory Model
- One territory per franchisee — exclusive and protected
- Territory defines the franchisee's operating area
- Territories are evaluated by Ryland for market potential
- Key metrics: housing market activity, flip volume, median home price, competition

### Revenue Model
- Franchise fee (upfront)
- Ongoing royalty percentage on revenue
- Technology/platform fees included in franchise agreement`,
  },
  {
    title: "Competitor Intelligence — Home Investors Funnel Crossover",
    category: "competitor_intelligence",
    content: `## Competitor Intelligence

### Home Investors Network
- Some prospects evaluate NAH alongside Home Investors or similar franchise models
- Key differentiator: NAH provides more hands-on support and proven renovation methodology
- Prospects comparing alternatives should be asked: "What specifically are you comparing?"

### General Competitive Landscape
- Scout should track which competitors prospects mention (stored in other_franchises_considered)
- Common alternatives: HomeVestors, 1-800-GOT-JUNK (different model but similar investment range), local RE investment groups
- NAH's advantage: dedicated renovation coaching, Lowe's partnership, territory exclusivity

### From Frandev Meeting (2026-03-27)
- Some leads come through shared advertising channels (Google Ads overlap)
- Lead Source Detail tracking is critical for attribution
- Franchise Business Review is a high-quality lead source — prospects from FBR tend to be more research-ready`,
  },
];

async function main() {
  const filePath = process.argv[2];

  if (filePath) {
    console.log(`File path provided: ${filePath}`);
    console.log("NOTE: PDF parsing not implemented. Using pre-extracted content.\n");
  }

  console.log("=== Importing Frandev Meeting Notes to KB ===\n");

  let imported = 0;
  for (const doc of FRANDEV_KB_DOCS) {
    // Check if already exists
    const { data: existing } = await supabase
      .from("knowledge_documents")
      .select("id")
      .eq("title", doc.title)
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.log(`  SKIP: "${doc.title}" already exists`);
      continue;
    }

    const { error } = await supabase.from("knowledge_documents").insert({
      title: doc.title,
      category: doc.category,
      content: doc.content,
      is_active: true,
      priority: 10,
      token_count: Math.ceil(doc.content.length / 4),
      seeded_from: "frandev_meeting_2026_03_27",
    });

    if (error) {
      console.error(`  ERROR: "${doc.title}": ${error.message}`);
    } else {
      console.log(`  ✅ "${doc.title}" (${doc.category})`);
      imported++;
    }
  }

  console.log(`\nImported: ${imported}/${FRANDEV_KB_DOCS.length}`);
  console.log("Run scripts/backfill-embeddings.ts to embed these docs.");
}

main().catch(console.error);
