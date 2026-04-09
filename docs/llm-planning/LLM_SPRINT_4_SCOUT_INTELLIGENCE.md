# Sprint LLM-4 — Scout Intelligence
**Goal:** Rebuild the pre-call brief, expand the profile tab UI to 199 fields with badges, add business intelligence queries, make Scout context-aware.
**Prerequisite:** Sprints LLM-1, LLM-2, LLM-3 complete
**Estimated time:** 3–4 hours
**Branch:** `feature/llm-scout-intelligence`

---

## Read These First
1. `docs/memory.md`
2. `docs/llm-planning/LLM_SESSION_CONTEXT.md`
3. `docs/llm-planning/NAH_Scout_Intelligence_Design.md`
4. `docs/llm-planning/NAH_Scout_Business_Intelligence.md`
5. `docs/llm-planning/NAH_Profile_Tab_v2_Expanded.md`
6. Existing `lib/scout/` directory (all files)
7. Existing `lib/calls/brief-generator.ts`
8. Current contact page + profile tab component

---

## Context
Scout v2 exists and works. This sprint makes it significantly smarter by:
- Rebuilding the pre-call brief (8 sections, far richer than current)
- Expanding the profile tab UI to show all 199 fields with source badges
- Adding business intelligence query handling
- Making Scout aware of which page and contact the user is on
- Using the hybrid RAG system from Sprint LLM-1

---

## Tasks

### Task 1: Hybrid RAG Retrieval Function
Build `lib/rag/retriever.ts`:
```typescript
async function retrieveContext(query: string, options: {
  contactId?: string,
  contentTypes?: ContentType[],
  limit?: number,
  includeStructured?: boolean
}): Promise<RetrievedContext>
```

Returns:
```typescript
{
  semanticChunks: EmbeddingResult[],    // from pgvector
  contactProfile: ContactProfile | null, // direct Supabase query if contactId provided
  recentJournals: ContactJournal[],      // last 7 days if contactId provided
  relevantKBDocs: KBChunk[],            // KB sections relevant to query
  pipelineState: PipelineState | null    // current stage + sub-tasks if contactId provided
}
```

Routing logic:
- If contactId provided → filter semantic search to that contact + include profile + journals
- If query about business patterns → search across ALL contacts (no contact filter)
- If query about methodology → search KB only
- Always include relevant KB docs alongside contact-specific results

### Task 2: Rebuild Pre-Call Brief Generator
Rebuild `lib/calls/brief-generator.ts` with 8 sections:

```typescript
async function generatePreCallBrief(contactId: string, callType: string): Promise<PreCallBrief>
```

**Section 1 — Who is this person:**
Pull from profile: name, DISC type, occupation, liquid capital, Zorakle fit score, top personality signals, conversion likelihood

**Section 2 — Where they are:**
Pull from pipeline: current stage, sub-tasks complete/pending, days in stage, yellow/red threshold status

**Section 3 — What happened last time:**
Retrieve from contact journals + last call transcript summary, commitments made and whether followed through

**Section 4 — Open concerns:**
Pull from profile: unresolved objections, yellow/red flags, spouse resistance, capital timeline concerns

**Section 5 — What to accomplish:**
Use KB (sales methodology by stage) + profile gaps to generate: stage goal, 3 specific recommended questions, list of missing profile fields this call should fill

**Section 6 — How they compare:**
Pull Zorakle match score vs top franchisees, financial profile similarity to converted leads, which existing franchisee they most resemble

**Section 7 — Prediction snapshot:**
Pull from profile: close probability + trend (up/down from last call), capital risk, ghost risk, predicted close date

**Section 8 — Suggested opening:**
Claude generates 2–3 sentence opener based on all context above

Store in `pre_call_briefs` table, make available on contact page and Daily HQ appointment cards.

### Task 3: Profile Tab UI — 199 Fields with Badges
Rebuild the profile tab component to show all 199 fields organized by 18 categories:

**Layout:**
- Collapsible category sections (accordion)
- Each category shows: name, field count, completion % (filled/total)
- Default collapsed — user expands what they need
- "Expand all" button

**Each field row:**
- Field label
- Current value (or "—" if empty)
- Source badge (colored dot): 🟢 API | 🟣 AI | 🟠 Manual
- Last updated timestamp (on hover)
- Edit button (opens inline edit for any field, any source)
- If Scout has a suggestion: yellow "suggestion" badge on the field

**Profile tab header:**
- "X Scout suggestions" badge if any fields have pending suggestions
- Click to expand a review panel showing all suggestions at once
- Each suggestion: field label, current value, suggested value, source quote, Edit/Skip/Push

**Ask LLM button:**
- Persistent at top of profile tab
- Opens Scout with context pre-loaded: "I'm looking at [contact name]'s profile"

### Task 4: Scout Context Awareness
Update Scout to know where the user is. Add context to every Scout message:

```typescript
// Injected into Scout system prompt
const pageContext = {
  currentPage: 'contact' | 'pipeline' | 'call_details' | 'daily_hq' | 'settings',
  contactId?: string,
  contactName?: string,
  currentStage?: string,
  callId?: string
}
```

Scout uses this context to:
- Answer questions about the current contact without being asked "which contact"
- Retrieve the right profile + pipeline + call data automatically
- Pre-fill action suggestions with the right contact_id

### Task 5: Business Intelligence Query Handler
Add a BI query detector in `lib/scout/query-router.ts`:
- Detects when a question is about business patterns (not a specific contact)
- Routes to `lib/scout/bi-handler.ts` which:
  - Queries across ALL contacts (not just one)
  - Pulls conversion patterns, objection frequencies, rep performance metrics
  - Formats answer with data + always ends with a prompt to go deeper
  - Adjusts phrasing based on user role (Matt = strategic, Chad = tactical, Corey = high-level)

BI queries always end with one of:
- "Want to dig deeper into this?"
- "Want me to pull the specific contacts driving this pattern?"
- "Should we work through what to change?"
- "Want me to flag this across the active pipeline?"

When Scout can't answer due to missing data (e.g. Google Ads performance), it responds:
*"I don't have [X data] yet. Here's what I can tell you from what I do have, and here's what we'd need to answer this fully."*

### Task 6: Scout Memory of Current Session
- Scout retains context across turns in the same chat session
- If user asked about a contact 3 messages ago, Scout still knows which contact
- If user asked a BI question, Scout can reference it in follow-up turns
- Use conversation_history array already in Scout context window

---

## Acceptance Criteria
- [ ] Pre-call brief generates with all 8 sections when asked in Scout
- [ ] Brief includes Zorakle data, objection history, prediction scores, suggested opener
- [ ] Profile tab shows all 199 fields in 18 collapsible categories
- [ ] Source badges display correctly on every field
- [ ] "X Scout suggestions" summary badge works + review panel works
- [ ] All fields are editable by clicking Edit (regardless of source)
- [ ] Scout knows which page/contact user is on and uses that context
- [ ] BI queries return data-backed answers with follow-up prompts
- [ ] Hybrid RAG retriever returns combined semantic + structured context
- [ ] Scout phrasing varies correctly by user role

## What NOT to Touch
- Sprint LLM-1, LLM-2, LLM-3 work
- Existing rubric criteria (22 criteria)
- Existing call grading scores/history
- Pipeline board logic
