# App Shell (wraps every page)

Reference: `New Again Houses App.dc.html`. Match existing tokens/components in our codebase.

## Layout

Two columns, full viewport height, no page scroll on the shell itself — the main content area scrolls.

- **Left sidebar** (~236px, translucent white): logo `new again houses` + `BETA` pill at top. Nav items (icon + label): **Scout AI, Daily HQ, Calls, Pipeline, Contacts, L10**. Active item = solid blue gradient rounded pill, white icon/label. Bottom: Notifications (bell), then user block (`CL` avatar, `Corey Lavinder`, `Admin`, chevron).
- **Main area**: subtle light gradient background (near-white → pale blue). On every screen except Scout AI, a persistent **Ask Scout bar** is pinned at the top (rounded input, speech-bubble icon, placeholder copy varies per page).
- **Floating bug/report button**: dark circle, fixed bottom-right.

## Shared components

- **KPI card**: blue gradient (`~#0f6cb2 → #2f9fe0`), large white number, label, muted sub-label. Usually 3 across. Used on Daily HQ, Calls, Pipeline, Contacts.
- **Person tag**: small rounded pill; team members get a per-person color, external contacts render grey.
- **Field-group accordion row**: icon + name + `X/Y filled` count + chevron (Profile/Data tabs).
- **Grade bar**: label + colored track (fill %) + letter (A green, B blue, C amber, D/F red).

## Navigation behavior

Clicking a nav item switches screens and exits any open detail view (call/journey/contact/territory). Each detail view has a back arrow that returns to its list.

## Ask Scout bar placeholders

- Daily HQ / Contacts / L10: `Ask Scout anything...`
- Calls: `How can I improve my call performance? What did coaching suggest?`
- Pipeline: `Which leads need attention? How's my pipeline health?`
