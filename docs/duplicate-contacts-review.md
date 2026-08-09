# Duplicate contacts — RESOLVED (nothing left to review)

Closed 2026-08-09, session 100. The original D5 list had 57 same-name groups; the
evidence pass proved 46 and merged them; the last 11 were resolved as follows.

## The 4 judgment calls — decided

- **jimmy stratton — MERGED.** The two records were imported ONE SECOND apart with
  sequential import ids (pto_100151 → pto_100152), same zip, near-identical emails
  (jamesdsta@ / jamesdstar@). A double-import, not two people. Merged into the older
  record (jamesdstar@gmail.com, efd8235d).
- **angel lane — KEPT BOTH.** Different phones, different zips (19144 vs 19138), and
  the emails belong to two identities (laneangel493@ vs gwendolynlane65@ — Angel vs
  Gwendolyn Lane). Likely two people in one family. Not provable; merging different
  people is destructive.
- **derrick washington — KEPT BOTH.** Different emails, phones, and zips (70127 vs
  70126); nothing shared but name and city. Not provable either way.
- **ron cates — KEPT BOTH.** The second record is charleston@newagainhouses.com with
  2 calls and 33 profile rows — the Charleston office record, not a duplicate person.
  If anything, that record deserves a rename so it stops matching a person's name.

## The 7 junk groups — deleted (20 contacts)

All 20 junk form-submission contacts (alanoud kennedy ×2, ben-test-harrison ×3,
hamood alobeidli ×7, ifkdrpb odrkie ×2, md.mukhtar ×2, test test ×2, حليمة الغروي ×2)
were deleted 2026-08-09 through production MasterSuite's own guarded handlers
(archive journey → delete journey → delete contact, per contact), journaled, and
replayed into the app — verified gone on BOTH sides (0 rows remaining in either
database, 60/60 journal rows applied, 0 failures).

## Nothing is pending

This file is retained as the record of how the 57 groups were resolved. The full
per-contact evidence snapshot (emails, phones, activity counts, classifications)
lives in the session-100 scratchpad archive; the merge/delete trail is in
`frandev_native_write` (journal) and each contact's `merged_into_contact_id`.
