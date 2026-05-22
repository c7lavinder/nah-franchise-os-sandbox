# Scout Retrieval Brain — Current State, Superpowers & What's Next

> Where we are, what to double down on, and the path to making Scout elite.

---

## Current State

### What exists today

Scout is an AI franchise sales and operations coach with 37 tools, backed by a 7-phase Retrieval Brain that was built in 3 sessions. Here's what it can do right now:

**Data access:**

- 37 tools across read, draft, and performance categories
- 900K+ property records, 64 active territories, 10 years of operational data
- 199 custom profile fields per contact, auto-populated from call extractions
- Call transcripts with AI grading (A-F), summaries, action items, and data extractions
- EOS tracking (goals, rocks, habits, scorecard) at contact and territory level
- Full pipeline system with 4 pipelines, sub-tasks, and stage history

**Search & retrieval:**

- Voyage AI embeddings (voyage-3-large, 1024 dimensions)
- Hybrid search: semantic (pgvector cosine) + BM25 (full-text), merged with reciprocal rank fusion
- Voyage AI reranking on merged results
- Contextual chunking: transcript and KB chunks prepended with metadata before embedding
- 118 embedded items (70 transcripts + 48 KB docs)
- 3 search tools: `search_knowledge`, `search_transcripts`, `search_documents`

**Intelligence layer:**

- Question classifier (9 types) with retrieval strategies and token budgets
- Pre-fetch context injection: relevant chunks injected into system prompt before Scout's first response
- Pre-computed contact briefs and territory briefs (nightly refresh + stale-on-change)
- Smart retrieval chaining: franchisee questions auto-include territory data
- Retrieval quality logging per conversation turn

**Model routing:**

- Opus orchestrates (iteration 1), Haiku executes (iterations 2+) — Opus reasoning at Haiku cost
- Model router escalates based on question complexity, user role, and conversation depth
- Leadership/admin users floor at Sonnet (never Haiku)

**Auto-population:**

- Post-call agent extracts 30-60 data points per call with confidence scores
- High confidence (85%+) auto-saves to profile, medium (60-84%) flagged for review
- Intelligence scores recalculate in real-time after auto-save
- Manual values never overwritten by AI

### What's working well

1. **The Opus-Haiku orchestration pattern.** Opus picks the right tools and reasons about the question. Haiku processes results cheaply. This is a genuine cost advantage — Opus-quality answers at 90% Haiku cost.

2. **Pre-computed briefs.** Most questions about a contact or territory can be answered from the brief alone, without Scout making multiple tool calls. This keeps responses fast and cheap.

3. **Hybrid search is a step-change from keyword-only.** Semantic search catches conceptual matches that keyword search misses entirely. BM25 catches exact terms that semantic search might rank lower. Together they cover more ground than either alone.

4. **Auto-population creates a flywheel.** Every call makes profiles richer. Richer profiles make Scout smarter. Smarter Scout makes better recommendations. Better recommendations improve call quality. More data per call. The loop compounds.

5. **The question classifier prevents waste.** "Hi Scout" costs zero retrieval. "How many leads this month?" goes straight to a database query. Only questions that actually benefit from search context pay for it.

---

## Superpowers — What to Double Down On

These are the things that could make Scout genuinely unfair compared to any other franchise operations tool. They're not features — they're compounding advantages.

### Superpower 1: Total Call Memory

**What it is:** Scout has heard every call, remembers every promise, tracks every objection, and knows what was said vs. what was done.

**Where we are:** Transcripts are embedded and searchable. Call summaries and action items exist. But the connections between calls aren't being exploited.

**What makes it elite:**

- **Cross-call pattern detection.** "This prospect has brought up capital concerns on 3 of 4 calls. The objection is escalating, not resolving." Scout should detect this automatically and flag it — not wait to be asked.
- **Promise tracking.** "On the May 3rd call, Chad said he'd send the FDD by Friday. It's Tuesday and it hasn't been sent." Scout should know what was promised and whether it happened.
- **Coaching progression.** "Chuck's call grades improved from C to B+ over 3 calls. His biggest improvement area is asking open-ended questions." Track how a prospect's engagement evolves across calls, not just individual call snapshots.
- **Sentiment trajectory.** Not just "this call was positive" but "this prospect's sentiment has trended down over the last 3 interactions — something is going wrong."

**How to build it:**

- Extract promises/commitments from transcripts as structured data (post-call agent already extracts 30-60 fields — add "commitments made" as a category)
- Build a commitment tracker: who promised what, by when, and whether it was fulfilled
- Add cross-call analytics to `get_entity(contact)`: call-over-call trends in grade, sentiment, and engagement
- Surface unfulfilled commitments in `get_next_action` recommendations

---

### Superpower 2: Predictive Pipeline Intelligence

**What it is:** Scout doesn't just tell you where a prospect is — it tells you where they're going, how likely they are to close, and what will move the needle.

**Where we are:** Intelligence scores exist (0-100 across 4 dimensions). Pipeline stages track position. But scoring is backward-looking (what happened) not forward-looking (what will happen).

**What makes it elite:**

- **Close probability.** "Based on 47 prospects who looked like Chuck at this stage, 68% closed within 90 days. The ones who didn't close typically stalled on capital confirmation." Real probability based on historical patterns, not a guess.
- **Risk scoring.** "This prospect hasn't responded in 8 days. Historically, prospects who go dark at the Discovery stage have a 23% close rate vs. 71% for those who respond within 48 hours." Quantified urgency.
- **Playbook recommendations.** "When prospects with construction concerns see a validation call within 5 days, close rates jump 40%. Schedule one now." Data-driven next moves.
- **Pipeline forecasting.** "Based on current pipeline composition and historical conversion rates, you're on pace for 3 awards this quarter. To hit 5, you need 12 more qualified leads entering by June 15."

**How to build it:**

- Build a historical outcome model: for every contact that reached each stage, what happened next (advanced, stalled, lost) and how long it took
- Correlate profile attributes with outcomes: which fields predict success? (capital confirmed, Trainual completion, response time, call grades)
- Add `close_probability` and `risk_score` to `candidate_intelligence`
- Feed these into `get_next_action` to rank recommendations by predicted impact

---

### Superpower 3: Franchisee Performance Coaching at Scale

**What it is:** Scout coaches franchise owners on their business operations with the same depth a $50K/year business consultant would — but instantly, 24/7, backed by 10 years of network data.

**Where we are:** Territory performance KPIs exist. Network benchmarks exist. EOS tracking exists. Comparison tools exist. But it's reactive — you have to ask the right question.

**What makes it elite:**

- **Proactive health alerts.** "Spokane's cycle time jumped from 98 days to 142 days over the last quarter. Their completion-to-list lag is the problem — 38 days vs. network median of 12. They may need contractor support." Don't wait for someone to ask.
- **Coaching playbooks by archetype.** "Territories in their first 18 months with 4-6 purchases follow a predictable pattern. Here's what the ones that reached high performer status did differently." Codified best practices from the data.
- **Leading indicator tracking.** "Lead volume dropped 30% month-over-month. At this trajectory, Spokane will fall below high performer threshold in Q3. Recommend: diversify lead sources — they're 80% dependent on one channel." Catch problems before they show up in lagging KPIs.
- **EOS habit correlation.** "Territories with A-grade daily tasks are 3.2x more likely to be high performers. Spokane grades B on daily tasks and D on weekly accounting. Weekly accounting is the biggest gap." Make the EOS connection concrete with numbers.

**How to build it:**

- Build territory health scoring (like contact intelligence but for territories): lead flow trend, cycle time trend, profit trend, EOS habits, diversification
- Add a `territory_alerts` system that fires when leading indicators move past thresholds
- Create a coaching brief generator that produces monthly territory reports with specific recommendations
- Wire proactive alerts into Scout's system prompt so it can raise them without being asked

---

### Superpower 4: Institutional Knowledge That Never Forgets

**What it is:** Every insight, objection response, and successful tactic gets captured, indexed, and served to the right person at the right moment — automatically.

**Where we are:** 48 KB documents with semantic search. Gap signal logging when searches return nothing. `draft_knowledge_doc` tool for suggesting new KB entries.

**What makes it elite:**

- **Auto-generated KB from calls.** When Scout sees a great objection response on a call that gets an A grade, it should draft a KB document capturing the tactic. The best playbook content comes from real conversations, not a content writer.
- **Personalized knowledge delivery.** "Chad is about to call a prospect who has construction concerns. Here's the objection response that worked best in the last 3 months, from a call that scored A on objection handling." Right knowledge, right moment, right format.
- **KB quality scoring.** Track which KB docs actually get referenced in Scout's answers (via retrieval logs). Documents that never surface are candidates for revision or retirement. Documents that surface but Scout ignores are misaligned.
- **Competitive intelligence refresh.** "The competitor comparison doc was last updated 4 months ago. Based on 6 recent calls where prospects mentioned competitors, here are the new objections that aren't covered." Keep the KB alive.

**How to build it:**

- Add a "knowledge extraction" step to the post-call agent: when a call grades A on a rubric criterion, extract the successful approach as a candidate KB entry
- Build KB quality metrics from `scout_retrieval_logs`: retrieval rate, reference rate, gap frequency per category
- Add a KB freshness monitor that flags documents older than 90 days with no retrievals
- Auto-suggest KB updates when gap signals cluster around a topic

---

## Near-Term Enhancements (Next 2-4 Sessions)

These are concrete, buildable improvements that close the biggest gaps and unlock the superpowers above.

### 1. Fix the critical gaps from the audit

| Gap                                                   | Fix                                                                  | Effort    |
| ----------------------------------------------------- | -------------------------------------------------------------------- | --------- |
| Uploaded documents never embedded                     | Call `embedExternalResearch()` after document upload                 | 1 hour    |
| Pre-fetch ignores active contact                      | Pass `pageContext.contactId` into `prefetchContext()`                | 30 min    |
| Transcript embeddings never updated                   | Add delete-before-embed to `embedTranscript()`                       | 30 min    |
| Double reranking in pre-fetch                         | Single `hybridSearch` call with rerank instead of search-then-rerank | 30 min    |
| Embedding failure visibility                          | Embedding health check in admin dashboard                            | 1-2 hours |
| Briefs stale up to 24 hours                           | On-demand regeneration in `get_entity` when stale                    | 1 hour    |
| Journals + external research lack contextual chunking | Add contextualizers like transcripts/KB have                         | 1 hour    |

**Total: ~6 hours. Closes all critical and significant gaps.**

### 2. Cross-call analytics

Add to `get_entity(contact)` response:

- Call-over-call grade trend (improving, flat, declining)
- Recurring objection detection (same type across 2+ calls)
- Response time trend (getting faster or slower to respond)
- Total call time invested in this prospect

**Effort: 1-2 sessions**

### 3. Territory health scoring

Like candidate intelligence but for territories:

- Lead flow trend (improving/flat/declining vs. 3-month baseline)
- Cycle time trend
- Profit per flip trend
- EOS habit grade (A-F composite)
- Active inventory risk (how many properties are 200+ days)
- Diversification score (how many lead channels contribute >10%)

Store in a `territory_intelligence` table. Surface in `get_entity(territory)`.

**Effort: 2 sessions**

### 4. Commitment tracker

Extract commitments from call transcripts:

- "I'll send you the FDD by Friday"
- "Let's schedule a validation call next week"
- "I need to talk to my spouse and get back to you"

Track: who committed, what, by when, status (pending/fulfilled/overdue).

Surface in `get_next_action`: "Chad promised to send the FDD 3 days ago. It's overdue."

**Effort: 2-3 sessions**

---

## Medium-Term Vision (Next 1-2 Months)

### 5. LLM-powered question classifier

Replace the regex classifier with a Haiku call (~50ms, ~$0.001/call):

- Understands context, not just keywords
- Can detect multi-intent questions
- Can identify which contact/territory is being discussed
- Returns structured JSON: `{ type, entities, intent, suggestedTools }`

This unlocks smarter pre-fetching (scope to the right contact) and could eventually replace the model router too (one classifier for both retrieval strategy and model selection).

**Effort: 1-2 sessions**

### 6. Close probability model

Build a simple logistic regression (or even rule-based) model:

- Input: profile completeness, call grades, response time, Trainual completion, capital status, days in stage
- Output: probability of advancing to next stage, probability of closing
- Train on historical outcomes (contacts who closed vs. those who didn't)

Doesn't need ML infrastructure — can run as a Supabase function or in the post-call agent.

**Effort: 2-3 sessions**

### 7. Auto-generated KB from high-scoring calls

When a call gets an A grade on a rubric criterion:

- Extract the specific approach/tactic that worked
- Draft a KB document as a `suggested` entry (admin review before publishing)
- Tag with the rubric criterion and objection type
- Track which auto-generated KB docs get the most retrievals

**Effort: 2 sessions**

### 8. Proactive territory alerts

A nightly job that checks each territory against thresholds:

- Lead flow dropped >25% month-over-month
- Cycle time increased >20% from trailing average
- Active inventory >15 properties or avg age >200 days
- EOS habits dropped below B average
- Profit per flip dropped >15% from trailing average

Store as `territory_alerts`. Include in Scout's system prompt for territory-related questions.

**Effort: 1-2 sessions**

---

## Long-Term (3-6 Months) — The Elite Vision

### 9. Scout becomes the daily operating system

Today Scout responds when asked. The elite version of Scout is the first thing Chad opens every morning and the last thing he checks before leaving.

**Daily HQ powered by intelligence:**

- "Good morning Chad. You have 3 calls today. Here's what you need to know for each one." (auto-generated pre-call briefs)
- "2 prospects went dark this week. Based on historical patterns, one is recoverable with a text today."
- "Chuck's commitment to confirm capital is overdue by 2 days. Recommend follow-up."
- "The Spokane territory is trending toward high performer status — they're at 8 T12 purchases and accelerating."

**This isn't a new feature — it's wiring together what already exists:** briefs, call schedules, commitment tracking, pipeline analytics, territory performance. The intelligence is built. The delivery mechanism is the gap.

### 10. Network-wide pattern learning

Scout sees every call across every rep. No human can synthesize that.

- "The #1 objection in Q2 was capital availability. The most effective response was [specific tactic from Call #1847 with prospect X]. Here's the script."
- "Prospects who complete Trainual before their Discovery Call close at 2.3x the rate of those who don't. Consider making Trainual completion a prerequisite."
- "Lead source X produced 40 leads this quarter but 0 closed. Lead source Y produced 8 leads and 3 closed. Recommend reallocating budget."

This requires no new data — it requires connecting data that already exists across contacts, calls, territories, and outcomes.

### 11. Multi-tenant readiness

If NAH Franchise OS ever serves more than one franchise brand, the Retrieval Brain needs tenant isolation:

- Embeddings scoped by `tenant_id` (column exists, unused)
- KB documents per brand
- Briefs per brand
- Search scoped to the user's brand

The schema supports this (tenant_id columns exist). The code doesn't enforce it yet.

---

## What Makes This Elite vs. Just Good

| Just Good                              | Elite                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| Scout answers questions about contacts | Scout tells you which contacts need attention before you ask                    |
| Scout can search transcripts           | Scout detects patterns across calls and flags escalating risks                  |
| Scout shows pipeline stages            | Scout predicts which deals will close and what will move the needle             |
| Scout has performance data             | Scout coaches franchisees with specific, data-backed recommendations            |
| Scout searches the knowledge base      | Scout builds the knowledge base from its best conversations                     |
| Scout responds when asked              | Scout is the first thing you open every morning with your daily brief           |
| Scout knows what happened              | Scout knows what was promised, whether it happened, and what should happen next |

The gap between good and elite isn't more features. It's connecting the data that already exists into intelligence that acts on itself.

Everything above is buildable with what's in the system today. No new vendors. No new infrastructure. Just wiring, intelligence, and compounding.
