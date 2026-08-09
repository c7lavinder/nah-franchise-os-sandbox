# Duplicate contacts — 4 groups left for a human call

Updated 2026-08-09 (evidence pass). The original D5 list had 57 same-name groups.
A deeper evidence pass — normalizing phone formats (`+1XXXXXXXXXX` vs bare 10 digits)
and checking the multi-email `contact_emails` table — proved 46 of them were the same
person after all, and they have been **merged** (46 merges, 0 failures, 0 orphaned
journeys; full log in the session wrap). 43 shared the exact same phone once formats
were normalized; 3 shared an email that only the multi-email table knew about.

The GHL "duplicate" tag step failed on all 46 — placeholder GHL ids, same as the first
D5 batch. Every database step was green.

That leaves **4 groups needing your judgment** and **7 junk groups** you can bulk-clear.

---

## Needs your call (4 groups)

Merge in the app (Lead detail → Merge) if same person; leave alone if different people.

### angel lane (2 contacts)

Two different email owners (laneangel / gwendolynlane) at two different phone numbers,
both Philadelphia. Could be a mother/relative filling the form for the same household —
or two people.

- laneangel493@gmail.com · 2158525372 · Philadelphia, PA · id 4b361bf2-...
- gwendolynlane65@gmail.com · +14452678012 · Philadelphia, PA · id a2ae438a-...

### derrick washington (2 contacts)

Different emails, different phones, both New Orleans. Both look like business emails
owned by the same kind of person; nothing proves it either way.

- excitingfuturesandbeyond@gmail.com · +15044973152 · New Orleans, LA · id 1c65de09-...
- everythingcommercellc@gmail.com · 5042030189 · New Orleans, LA · id c85c39bf-...

### jimmy stratton (2 contacts)

Almost certainly the same person — jamesdsta@ vs jamesdstar@ (one letter), phones differ
only in the last 4 digits, same town. But "almost certainly" on a name+near-miss is
exactly what this list exists to catch, so it's your call.

- jamesdsta@gmail.com · 8056570724 · Taylors, SC · id f360e8e3-...
- jamesdstar@gmail.com · 8056570288 · Taylors, SC · id efd8235d-...

### ron cates (2 contacts)

Probably a KEEP-BOTH, not a merge: the second record is charleston@newagainhouses.com
with 2 calls and 33 profile rows — it looks like the Charleston franchise office record,
not a person. Merging a person into an office record would be wrong.

- soulshinesolutionschs@gmail.com · 8439260093 · Charleston, SC · id 3a76162e-...
- charleston@newagainhouses.com · 981-1856 · Charleston, SC · 2 calls, 33 profile rows · id e9008e18-...

---

## Junk form submissions (7 groups, 20 contacts) — bulk-clear candidates

Every contact below has ZERO notes, tasks, calls, and profile rows — nothing but the
auto-created journey. Most have no email, phone, or location at all. These are junk
form submissions, not people. They pass the Delete guard ("untouched record"), so the
Delete button in MasterSuite can clear them one by one — or say the word and a session
deletes the lot.

- **alanoud kennedy** (2) — both completely blank
- **ben (test) harrison** (3) — Ben's own test submissions (ben3@newagainhouses.com)
- **hamood alobeidli** (7) — all seven completely blank
- **ifkdrpb odrkie** (2) — keyboard-mash name; one has a Saudi school email
- **md.mukhtar md.mukhtar** (2) — one bare phone, otherwise blank
- **test test** (2) — testingwebsitedifne@ and amber@newagainhouses.com test rows
- **حليمة الغروي** (2) — both completely blank

---

## How this was proven (for the record)

- Phones compared on their last 10 digits — the old pass compared raw strings, so
  `+13179465840` and `3179465840` looked "different".
- Emails checked across `contact_emails` (the multi-email store), not just the primary
  column — that alone proved 3 groups.
- Keeper choice per merge: most activity first, then a real (non-auto) journey, then
  oldest record.
- Evidence snapshot per contact (all emails/phones, location, activity counts) was
  generated read-only before any merge ran.
