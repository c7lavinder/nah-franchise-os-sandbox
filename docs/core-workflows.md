# NAH Core Workflows

> At-a-glance view of the four core sequences. Full message text lives in `docs/workflows-catalog.md`.
> 📧 Email · 📱 SMS · ☎️ Call task · 🤖 AI check | ✋ = needs approval before send · ⚙️ = auto

| Workflow                                    | Role      | Status   | Auto-fires?        | Steps | Duration |
| ------------------------------------------- | --------- | -------- | ------------------ | ----- | -------- |
| [Website Form Leads](#website-form-leads)   | New leads | 🟢 Live  | ✅ Yes             | 12    | 14 days  |
| [Long-term Nurture](#long-term-nurture)     | Nurture   | ⚪ Draft | ✅ Yes (once live) | 8     | 90 days  |
| [Pre-Call Reminder](#pre-call-reminder)     | Pre-call  | 🟢 Live  | ⚠️ Manual          | 3     | 2 days   |
| [Post-Call Follow-up](#post-call-follow-up) | Post-call | 🟢 Live  | ⚠️ Manual          | 3     | 3 days   |

---

## Website Form Leads

🟢 Live · Auto on `journey.created` (website form → Sales / Engagement) · exits early on booking or reply · ends Day 14 · metric: **intro call booking rate**

| Day | Ch  | Step                                                                               | Approval |
| --- | --- | ---------------------------------------------------------------------------------- | -------- |
| 1   | ☎️  | Call task — get prospect on intro call                                             | ⚙️       |
| 1   | 📱  | "Just got your form — when's a good time for a quick call?"                        | ✋       |
| 1   | 📧  | **Welcome to New Again Houses!** — intro + Sam Ferguson video + book call          | ✋       |
| 1   | 📧  | **Message from our Founder** — Matt on Real Estate Disruptors + Find a Way podcast | ✋       |
| 1   | 📱  | "Checking back — today or tomorrow for a quick call?"                              | ✋       |
| 2   | 📱  | Calendly booking link follow-up                                                    | ✋       |
| 3   | 📧  | **How do we compare?** — FBR 2025 survey (#11, 28% above avg)                      | ✋       |
| 5   | 📧  | **Franchisee Testimonial** — Tim & Stephanie, Greenville                           | ✋       |
| 6   | 📱  | "Wanted to make sure you saw my note — what's your schedule?"                      | ✋       |
| 8   | 📧  | **Our People!** — meet the success coaches                                         | ✋       |
| 12  | 📧  | **Follow Up** — 2023 Franchisee Conference video                                   | ✋       |
| 14  | 📧  | **Time to move on** — wrap-up, rolls into Long-term Nurture                        | ✋       |

**Links:** Book → `api.leadconnectorhq.com/widget/bookings/nahintro` · Calendly → `calendly.com/newagainhouses_chad/new-again-houses` · FBR → `franchisebusinessreview.com` · YouTube → `youtube.com/@newagainhousesfranchise` · Facebook → `facebook.com/NewAgainHousesFranchise`

---

## Long-term Nurture

⚪ Draft (format emails before go-live) · Auto on `stage.advanced` → Nurture stage · ends Day 90 · metric: **content engagement rate**

| Day | Ch  | Step                                                 | Approval |
| --- | --- | ---------------------------------------------------- | -------- |
| 14  | 📧  | **Market insights from NAH**                         | ✋       |
| 30  | ☎️  | Monthly personal touch — check in, assess readiness  | ⚙️       |
| 30  | 📱  | "Just checking in — you know where to find me"       | ✋       |
| 45  | 📧  | **Franchisee spotlight**                             | ✋       |
| 60  | ☎️  | 60-day check — consider re-engagement                | ⚙️       |
| 60  | 📧  | **What's new at New Again Houses**                   | ✋       |
| 75  | 📱  | "It's been a couple months — anything change?"       | ✋       |
| 90  | 🤖  | 90-day review — if zero engagement, flag for archive | ⚙️       |

---

## Pre-Call Reminder

🟢 Live · Manual enroll (auto-fire blocked on GHL appointment webhook) · ends Day 2 · metric: **no-show rate**

| Day | Ch  | Step                                                         | Approval |
| --- | --- | ------------------------------------------------------------ | -------- |
| 1   | 📱  | Confirm call: "[date] at [time] — looking forward to it!"    | ✋       |
| 1   | 📧  | **What to expect on our call** — agenda, no-pressure framing | ✋       |
| 2   | 📱  | Day-of reminder: "See you soon!"                             | ✋       |

---

## Post-Call Follow-up

🟢 Live · Manual enroll (auto-fire blocked on GHL call-completed webhook) · ends Day 3 · metric: **next-step completion rate**

| Day | Ch  | Step                                                                 | Approval |
| --- | --- | -------------------------------------------------------------------- | -------- |
| 1   | 📧  | **Great talking with you** — recap + next steps (Scout personalizes) | ✋       |
| 2   | 📱  | "Check your email for the recap — any questions?"                    | ✋       |
| 3   | 📱  | "Checking in on the next steps we discussed"                         | ✋       |
