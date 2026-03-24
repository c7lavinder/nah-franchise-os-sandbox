# /next — Next Task Recommendation

> When I type /next do exactly this.
> This command reads the current project state, checks for blockers,
> and tells you exactly what to build next with a copy-paste ready prompt.
> No guessing. No skipping ahead. Build in order.

---

## STEP 1 — Read and cross-reference

Read these files completely before making any recommendation:

### 1. Read memory.md

Pull the following from memory.md:
- **Current Status** — what phase are we in? What was the last session? What is the stated next action?
- **What Has Been Built** — which items are checked [x], partial [~], broken [!], or unchecked [ ]?
- **Known Issues** — are there any Critical or High severity bugs?
- **Established Patterns** — what patterns must the next task follow?
- **Decisions Made** — any decisions that affect what comes next?

### 2. Read docs/build-plan.md

Pull the following from build-plan.md:
- Find the current phase section
- Find the first unchecked item in that phase — this is the candidate next task
- Read the full description of that task including any sub-items
- Check if the task has prerequisites listed

### 3. Cross-reference memory.md against build-plan.md

Compare what memory.md says is built vs what build-plan.md says should be built.

Check for mismatches:
- Is something checked in memory.md but not in build-plan.md? → Update build-plan.md
- Is something checked in build-plan.md but not in memory.md? → Verify it actually exists
- Does memory.md say phase is complete but build-plan.md still has unchecked items? → Flag this
- Does the "next action" in memory.md match the next unchecked item in build-plan.md? → If not, flag it

If any mismatch is found, output it before the recommendation:

```
⚠️ MISMATCH DETECTED:
memory.md says: [what memory says]
build-plan.md says: [what build plan says]
Actual state: [what is actually true based on file checks]
Resolution: [which one is correct and what needs updating]
```

### 4. Verify the candidate task's files

Before recommending the next task, check whether any of its expected output files already exist.
If they do — the task may already be partially or fully complete.

- Use file system checks to verify existence of expected files
- If files exist, read them briefly to assess completeness
- If already complete → skip to the NEXT unchecked item and repeat this verification

---

## STEP 2 — Check for blockers

Before recommending any new task, run these three blocker checks in order.
If any blocker is found, handle it before recommending the next feature task.

### Blocker Check 1: Critical bugs

Read memory.md Known Issues. Filter for Critical and High severity.

If Critical bugs exist:
- Do NOT recommend a new feature task
- Recommend fixing the critical bug first
- Output the SPECIAL CASE — critical bugs format (see below)

If High bugs exist:
- Note them in the output but do not block the next task
- Recommend fixing them soon

### Blocker Check 2: Dependencies

For the candidate next task, identify everything it depends on:
- Which files must exist before this task can start?
- Which features must be working before this task can start?
- Which environment variables must be configured?
- Which database tables must exist?

Check each dependency:
- Does the file exist? Read it to confirm it is complete, not just a placeholder.
- Is the feature actually working or just stubbed out?
- Are the environment variables defined in .env.local.example?

If any dependency is missing:
- Do NOT recommend the task that needs it
- Recommend building the dependency first
- Output the SPECIAL CASE — dependencies missing format (see below)

### Blocker Check 3: Phase completion

Is the current phase actually complete?
- Check every item in memory.md What Has Been Built for the current phase
- If all items are [x] → the phase is complete
- If any items are [ ] or [~] or [!] → the phase is NOT complete

If the phase IS complete but hasn't been formally closed:
- Output the SPECIAL CASE — phase complete format (see below)

If the phase is NOT complete:
- The next task must be from the CURRENT phase (do not skip ahead)

---

## STEP 3 — Output the recommendation

After Steps 1 and 2 pass with no blockers, output this exact format:

```
### /next — Next Task — [YYYY-MM-DD]

CURRENT PHASE: [phase name and number]
PHASE PROGRESS: [checked count] / [total count] items complete
LAST COMPLETED: [last checked item from memory.md What Has Been Built]
NEXT TASK: [exact task name from build-plan.md]

WHAT TO BUILD:
[2-3 sentences describing exactly what needs to be created.
Be specific — name the functions, components, or API routes.
Describe the expected behavior and how it fits into the system.
Reference the user-facing feature this enables.]

FILES TO CREATE:
- /exact/path/to/new-file.ts — [one sentence: what this file does and why it is needed]
- /exact/path/to/new-file.tsx — [one sentence: what this file does and why it is needed]
- /exact/path/to/new-file.ts — [one sentence: what this file does and why it is needed]

FILES TO MODIFY:
- /exact/path/to/existing-file.ts — [what needs to change and why]
- /exact/path/to/existing-file.tsx — [what needs to change and why]
[or: No existing files need modification]

SPEC REFERENCE:
Read these sections before building:
- docs/[which-doc].md — [exact section name] — [what it tells you about this task]
- docs/[which-doc].md — [exact section name] — [what it tells you about this task]
- CLAUDE.md — [section name if relevant] — [what rule applies to this task]

PATTERNS TO FOLLOW from memory.md:
- [pattern name]: [brief description of the pattern and where to see an example]
- [pattern name]: [brief description of the pattern and where to see an example]
- [pattern name]: [brief description of the pattern and where to see an example]
[If no established patterns are relevant, write: No specific patterns — establish new ones and document in memory.md]

DEPENDENCIES (must exist before starting):
- [file or feature name] — [EXISTS ✓ / MISSING ✗] — [what it provides to this task]
- [file or feature name] — [EXISTS ✓ / MISSING ✗] — [what it provides to this task]
- [file or feature name] — [EXISTS ✓ / MISSING ✗] — [what it provides to this task]
[All dependencies must show EXISTS ✓ — if any show MISSING ✗, this task is blocked]

RULES SPECIFIC TO THIS TASK:
- [any task-specific rules from CLAUDE.md, pipeline.md, or other docs]
- [any constraints or limitations to be aware of]
- [any "do NOT do this" warnings relevant to this task]

COMPLEXITY: [Simple / Medium / Complex]
  Simple = single file, straightforward logic, under 100 lines
  Medium = 2-4 files, some business logic, 100-300 lines
  Complex = 5+ files, significant business logic, API integration, 300+ lines

ESTIMATED SCOPE: [30min / 1-2hr / half day / full day]

COPY THIS BUILD PROMPT:
---
Build: [exact task name]

Read memory.md and CLAUDE.md first.

What to build: [2-3 sentence description — same as WHAT TO BUILD above]

Files to create:
- [list each file with what it does]

Files to modify:
- [list each file with what changes]

Spec to follow:
- [list each spec reference]

Rules:
- Follow established patterns in memory.md
- TypeScript strict — zero `any` types
- All GHL calls through /lib/ghl only
- All Scout actions require Draft → Review → Confirm
- Every function gets a JSDoc comment
- Self-audit every function: Write > Question 18 checks > Improve > Validate
- [any task-specific rules]

When done:
1. Verify TypeScript compiles: npx tsc --noEmit
2. Test the feature manually
3. Run /audit on all files created or modified
4. Run /wrap-session
---

AFTER THIS TASK, THE NEXT ONE IS:
[exact name of the task that follows this one in build-plan.md]
[1 sentence describing what it involves so you can plan ahead]
[note any dependency this next-next task has on the current task]
```

---

## SPECIAL CASE — Phase complete

When all items in the current phase are checked [x] in memory.md:

```
### /next — Phase Complete — [YYYY-MM-DD]

✅ ALL ITEMS IN [PHASE NAME] ARE COMPLETE.

PHASE SCORECARD:
- Items built: [count]
- Known issues: [count] ([critical], [high], [medium], [low])
- Decisions made: [count]
- Audits completed: [count]

BEFORE STARTING NEXT PHASE:
1. Run /audit on ALL files created in [current phase]
   Files to audit:
   - [list every file created in this phase]
2. Run /status to confirm everything is green
3. Fix any issues found by /audit
4. Update memory.md Current Status to reflect phase completion
5. Push to GitHub with a clear commit message:
   "feat: complete [Phase Name] — [one sentence summary]"
6. Run /wrap-session to close out the phase

NEXT PHASE: [Phase Name]
FIRST TASK: [first unchecked item in next phase]
DESCRIPTION: [2-3 sentences about what the next phase covers]

Do NOT start the next phase until all 6 steps above are completed.
```

---

## SPECIAL CASE — Critical bugs exist

When memory.md Known Issues contains Critical severity bugs:

```
### /next — Critical Bugs Must Be Fixed First — [YYYY-MM-DD]

🚨 CRITICAL BUGS BLOCK ALL NEW FEATURE WORK.

OPEN CRITICAL ISSUES:
1. [severity] — [description] — [file] — [what needs to happen to fix it]
2. [severity] — [description] — [file] — [what needs to happen to fix it]

FIX THESE FIRST:
Start with: [which bug to fix first and why — usually the one closest to data loss or security]

After fixing:
1. Run /audit on the fixed file to confirm the fix is clean
2. Update memory.md Known Issues — change status from open to fixed
3. Run /next again to get the actual next feature task

HIGH SEVERITY ISSUES (fix soon but not blocking):
- [description] — [file]
- [description] — [file]
[or: No high severity issues]

The next feature task AFTER bugs are fixed would be:
[task name] — [brief description]
But do NOT start it until all Critical issues are resolved.
```

---

## SPECIAL CASE — Dependencies missing

When the next task requires something that does not exist yet:

```
### /next — Dependency Missing — [YYYY-MM-DD]

⚠️ NEXT TASK IS BLOCKED BY MISSING DEPENDENCY.

BLOCKED TASK: [task name]
MISSING DEPENDENCY: [what is missing]
WHY IT IS NEEDED: [what the blocked task needs from this dependency]

BUILD THE DEPENDENCY FIRST:

DEPENDENCY TASK: [name of what to build]
WHAT TO BUILD: [description of the dependency]
FILES TO CREATE:
- [file list]

SPEC REFERENCE:
- [where to find the spec for the dependency]

After building the dependency:
1. Run /audit on the new files
2. Run /next again — the original task should now be unblocked

THEN RETURN TO:
[original blocked task name] — [brief description]
```

---

## Decision Rules

When the situation is ambiguous, follow these rules:

1. **Always build in order.** Do not skip ahead in build-plan.md even if a later task seems easier.
2. **Fix before build.** Critical bugs always come before new features. High bugs should be fixed within the same phase.
3. **Dependencies before dependents.** If Task B needs Task A, build Task A first even if Task B is listed first in the plan.
4. **Memory.md is the source of truth** for what has been built. build-plan.md is the source of truth for what should be built. When they conflict, verify against the actual files.
5. **When in doubt, ask.** If the next task is unclear or there are multiple valid paths, present the options to the user instead of guessing.
6. **One task at a time.** /next always recommends exactly ONE task. Never recommend multiple tasks at once.
7. **Be specific.** "Build the Scout page" is not specific enough. "Create the ScoutChatInput component that renders a text input with send button and voice recorder, following the design in docs/design.md section 4.2" is specific enough.
