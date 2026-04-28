---
Last verified: 2026-04-27
Source: database (users table)
---

# Team — NAH Franchise OS

---

## Roles

| Role | Access | Description |
|---|---|---|
| `admin` | Everything + Settings mutations | System administrators |
| `operator` | All actions on assigned contacts | Franchise development reps |
| `specialist` | Assigned calls + read all | Subject matter experts (lending, validation) |
| `member` | Read access | Support team members |
| `leadership` | Pipeline health, rep performance | Executive oversight |
| `marketing` | Campaign performance, lead source quality | Marketing team |
| `rep` | Tactical — next best action, draft messages | Front-line sales reps |

---

## Current team

| Name | Email | Role | GHL User ID | Primary use |
|---|---|---|---|---|
| Corey Lavinder | corey@newagainhouses.com | admin | — | Everything (owner) |
| Matt Lavinder | matt@newagainhouses.com | admin | JR7Z8HSBm16enwFDlheU | Settings, pipeline management |
| Chad Arnold | chad@newagainhouses.com | operator | LmwQtpaD5SSIIHe6r4Pk | Daily HQ, Scout, pipeline |
| John Wright | john@newagainhouses.com | member | 4gzTRxTJszXk4dOtky8H | Calls, coaching |
| Sam Ferguson | sam@newagainhouses.com | specialist | — | Validation calls |
| Mark Pate | mark@altacapitalmanagement.com | specialist | — | Lending calls |
| Rylyn | rylyn@newagainhouses.com | specialist | — | Franchise development |
| Nora | nora-frandev@newagainhouses.com | specialist | — | Franchise development |

Additional members: Amber Bolton, Erin Armstrong, Jeff Pudelek, Jessida Odle, Joe Kraus, Ray Heath (all `member` role).

---

## Auth model

- **Authentication:** Supabase Auth (email + password). JWT in localStorage.
- **Authorization:** `requireAuth` on all API routes. Admin role check on `/api/settings/*` mutations.
- **Admin view-as:** Admins can pass `?targetUserId=X` on `/api/daily-hq` to see another user's data.
- See `docs/security.md` for full auth model documentation.

---

## GHL user mapping

Only users with a `ghl_user_id` can:
- Have tasks assigned to them in GHL
- See their appointments in Daily HQ calendar
- Have scorecard activity tracked

Users without `ghl_user_id` (most of the team) use the app for viewing and Scout but don't have GHL-side activity tracked.
