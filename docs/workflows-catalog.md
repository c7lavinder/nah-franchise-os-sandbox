# NAH Workflows Catalog

> Auto-generated 2026-06-25 from the Supabase workflow tables (source of truth). Regenerate after changes.
> Channels: 📧 Email · 📱 SMS · ☎️ Call task · 🤖 AI check · 🔔 Team notify · 🏷️ Tag · ➡️ Pipeline move.
> ✋ = customer-facing send, queues for human approval before going out. ⚙️ = auto-executes.
> ⚠️ flags = needs attention before this workflow can be trusted/fired.

## Summary

| Workflow                                                                           | Status | Type               | Fires automatically? | Steps | Duration |
| ---------------------------------------------------------------------------------- | ------ | ------------------ | -------------------- | ----- | -------- |
| [2026 Q2 Cold Lead Drip Campaign](#2026-q2-cold-lead-drip-campaign)                | live   | drip               | ⚠️ No (manual)       | 3     | 14 days  |
| [Generic Franchise Drip Campaign 1 Yr](#generic-franchise-drip-campaign-1-yr)      | live   | drip               | ⚠️ No (manual)       | 5     | 365 days |
| [New Lead 30-Day Sequence](#new-lead-30-day-sequence)                              | live   | new_lead_30day     | ⚠️ No (manual)       | 18    | 30 days  |
| [New Prospect: Path to Ownership Nurture](#new-prospect-path-to-ownership-nurture) | live   | new_lead_nurture   | ✅ Yes               | 13    | 14 days  |
| [Post-Call Follow-up](#post-call-follow-up)                                        | live   | post_call_followup | ⚠️ No (manual)       | 3     | 3 days   |
| [Pre-Call Reminder](#pre-call-reminder)                                            | live   | pre_call_reminder  | ⚠️ No (manual)       | 3     | 2 days   |
| [Website Form Leads](#website-form-leads)                                          | live   | drip               | ✅ Yes               | 12    | 14 days  |
| [FDD Nurture (14-Day)](#fdd-nurture-14-day)                                        | draft  | fdd_nurture        | ✅ Yes               | 8     | 14 days  |
| [Follow-up Cadence](#follow-up-cadence)                                            | draft  | follow_up_cadence  | ✅ Yes               | 6     | 28 days  |
| [Intro Call Info Campaign](#intro-call-info-campaign)                              | draft  | drip               | ✅ Yes               | 3     | 5 days   |
| [Long-term Nurture](#long-term-nurture)                                            | draft  | long_term_nurture  | ✅ Yes               | 8     | 90 days  |
| [Onboarding Welcome](#onboarding-welcome)                                          | draft  | onboarding_welcome | ✅ Yes               | 9     | 14 days  |
| [Re-engagement](#re-engagement)                                                    | draft  | re_engagement      | ✅ Yes               | 6     | 14 days  |
| [Trainual Nudge](#trainual-nudge)                                                  | draft  | trainual_nudge     | ✅ Yes               | 7     | 7 days   |

---

## 2026 Q2 Cold Lead Drip Campaign

- **Status:** 🟢 Live
- **Type:** `drip`
- **Purpose:** Imported from Franchise Tether (3 steps).
- **Enrollment / Trigger:** ⚠️ **Manual only** — does not fire automatically (no trigger configured)
- **Exit:** —
- **⚠️ Audit flags:** No automatic trigger (manual enrollment only) · 3/3 emails are plain text (no formatting/links)

### Steps (3)

#### Step 1 · Day 0 — 📧 Email _(start)_ · ✋ needs approval

**Subject:** Why most real estate deals fail

> {{contact.first_name}},
>
> Most real estate deals fall apart before an offer is ever made. Not because the market is bad, but because there is no reliable system to know if a deal is actually good.
>
> We run every property through MasterSuite. It removes the guesswork. If it says buy, you buy. If it does not, you walk. One of our franchise owners in Tampa walked into a house they loved, but MasterSuite said the numbers did not work. They walked away and found a better deal the same month.
>
> Hear their full story here: https://www.youtube.com/watch?v=-Kyf1A0LWEM
>
> Thinking about getting into real estate investing? Reach out to New Again Houses and let's talk about how house flipping could work in your market.
>
> Chad Arnold

**Links:** `https://www.youtube.com/watch?v=-Kyf1A0LWEM`

#### Step 2 · Day 7 @ 07:30:00 — 📧 Email _(+7 day(s) later)_ · ✋ needs approval

**Subject:** The deal that almost happened

> {{contact.first_name}},
>
> One of our owners found a promising property, great neighborhood, strong demand, clean layout. Before moving forward, we broke it down. The numbers only worked under best-case assumptions. They passed.
>
> Two weeks later, a quieter deal in the same area closed exactly as expected.
>
> Good deals still fall through when capital is the bottleneck. Through our partnership with Alta Capital, over 10 years and zero defaults, that is never the issue for our owners. The only question is whether the deal is strong enough.
>
> Matt and Mark sit down to talk about how that partnership was built and where it is headed: https://www.youtube.com/watch?v=cfkmsfPX1dg
>
> Ready to start flipping houses? Book a call with New Again Houses.
>
> Chad Arnold

**Links:** `https://www.youtube.com/watch?v=cfkmsfPX1dg`

#### Step 3 · Day 14 @ 07:15:00 — 📧 Email _(+7 day(s) later)_ · ✋ needs approval

**Subject:** You are never alone in the deal

> {{contact.first_name}},
>
> Real estate decisions carry real weight. You are committing real money, timelines matter, and mistakes compound quickly.
>
> When one of our owners hit a wall mid-renovation, costs creeping up, a contractor behind, they called their coach. Together they reviewed the numbers and adjusted the plan before the problem grew.
>
> That is the difference between owners who succeed and owners who struggle. The best ones treat every problem as something that can be solved. Chad Arnold, our Franchise Development Manager, breaks down exactly what he sees separate high performers from low performers:
>
> https://www.youtube.com/watch?v=xiLPBi92VAA
>
> If real estate investing has been on your mind, let's connect. Schedule a call to explore what's possible in your area.
>
> Chad Arnold

**Links:** `https://www.youtube.com/watch?v=xiLPBi92VAA`

---

## Generic Franchise Drip Campaign 1 Yr

- **Status:** 🟢 Live
- **Type:** `drip`
- **Purpose:** Imported from Franchise Tether (5 steps).
- **Enrollment / Trigger:** ⚠️ **Manual only** — does not fire automatically (no trigger configured)
- **Exit:** —
- **⚠️ Audit flags:** No automatic trigger (manual enrollment only) · 5/5 emails are plain text (no formatting/links)

### Steps (5)

#### Step 1 · Day 30 @ 10:00:00 — 📧 Email _(start)_ · ✋ needs approval

**Subject:** Franchising opportunities with {{user.first_name}} {{user.last_name}}

> {{contact.first_name}}, we talked a while ago about helping you identify if the New Again Houses franchise concept is right for you. I wanted to provide you with my contact information again so you have it handy.If you have questions about franchising, please don't hesitate to reach out.We are here to help you anytime - or anyone you know who might be looking for a unique franchise opportunity.

#### Step 2 · Day 90 @ 00:00:00 — 📧 Email _(+60 day(s) later)_ · ✋ needs approval

**Subject:** Franchising opportunities with {{user.first_name}} {{user.last_name}}

> {{contact.first_name}}, we talked a while ago about helping you find a franchise. We have new Franchisors every week who are looking for new Franchisees. They could be a great opportunity for you!We are here to help you at anytime - or anyone you know who might be looking for a franchise.Here is a link to schedule a time that works for you.

#### Step 3 · Day 180 @ 00:00:00 — 📧 Email _(+90 day(s) later)_ · ✋ needs approval

**Subject:** New Franchise Opportunities with {{user.first_name}} {{user.last_name}}

> {{contact.first_name}}, I hope this finds you well! We have new franchise opportunities added every week.If you would like to take a peek at these with me, I'm happy to help you!Here is a link to schedule a time that works for you.

#### Step 4 · Day 270 @ 00:00:00 — 📧 Email _(+90 day(s) later)_ · ✋ needs approval

**Subject:** Fire Your Boss!

> {{contact.first_name}}, I hope this finds you well! Are you finished working for someone else? Let's talk about putting you in your own franchise so you can control your own destiny!Here is a link to schedule a time that works for you.

#### Step 5 · Day 365 @ 12:00:00 — 📧 Email _(+95 day(s) later)_ · ✋ needs approval

**Subject:** Multi Unit and Master Franchise Opportunities Available

> {{contact.first_name}}, Seriously, are you still working for someone else? Let's find a franchise that you will enjoy that allows you to control your own life.It has been a year since we last talked. There are so many opportunities in Franchising in all kinds of industries. There is no obligation and no cost to you for us to explore possibilities.Let's hop on a quick call!

---

## New Lead 30-Day Sequence

- **Status:** 🟢 Live
- **Type:** `new_lead_30day`
- **Purpose:** Get the prospect on a call with Chad and into Trainual within 30 days.
- **Enrollment / Trigger:** ⚠️ **Manual only** — does not fire automatically (no trigger configured)
- **Exit:** Ends after **30 days**
- **Primary metric:** Call booking rate
- **⚠️ Audit flags:** No automatic trigger (manual enrollment only) · 5/5 emails are plain text (no formatting/links)

### Steps (18)

#### Step 1 · Day 1 — 📱 SMS _(start)_ · ✋ needs approval

> Hey [FirstName], this is Chad with New Again Houses. Thanks for your interest in our franchise opportunity! I'd love to learn more about your goals. When's a good time for a quick call?

#### Step 2 · Day 1 — 📧 Email _(same day)_ · ✋ needs approval

**Subject:** Welcome to New Again Houses

> Hi [FirstName],
>
> Thanks for reaching out about the New Again Houses franchise opportunity. I'm Chad, and I'll be your guide through this process.
>
> New Again Houses is a proven house-flipping franchise with exclusive territories, construction coaching, and our Lowe's partnership.
>
> I'd love to schedule a quick call to learn about your goals and see if NAH might be the right fit.
>
> What does your schedule look like this week?
>
> Best,
> Chad

#### Step 3 · Day 3 — ☎️ Call task (Chad) _(+2 day(s) later)_ · ⚙️ auto

> Day 3 call: First personal touch with [Name]. Goal: understand their background and interest level.

#### Step 4 · Day 3 — 📱 SMS _(same day)_ · ✋ needs approval

> Hey [FirstName] — just following up on my message. Would love to connect this week if you're available. What works best for you?

#### Step 5 · Day 5 — 📧 Email _(+2 day(s) later)_ · ✋ needs approval

**Subject:** What makes NAH different

> Hi [FirstName],
>
> I wanted to share what sets New Again Houses apart from other franchise opportunities:
>
> - Exclusive territories that protect your investment
> - Construction coaching from day one
> - Our Lowe's partnership for materials savings
> - Proven systems that reduce the learning curve
>
> Most solo house flippers struggle in year one. NAH franchisees have the system, support, and brand already built.
>
> Want to hop on a call to discuss?
>
> Chad

#### Step 6 · Day 7 — 📱 SMS _(+2 day(s) later)_ · ✋ needs approval

> [FirstName], just checking in. Still interested in learning about the NAH franchise? Happy to answer any questions.

#### Step 7 · Day 7 — 🤖 AI check _(same day)_ · ⚙️ auto

> Check if call has been booked. If not, draft scheduling message with available time slots.

#### Step 8 · Day 10 — ☎️ Call task (Chad) _(+3 day(s) later)_ · ⚙️ auto

> Day 10 call: Follow up with [Name]. If no prior contact, this is critical — personal touch needed.

#### Step 9 · Day 10 — 📧 Email _(same day)_ · ✋ needs approval

**Subject:** A quick question for you

> Hi [FirstName],
>
> I have a quick question — what's your timeline for getting into business ownership?
>
> Understanding where you are helps me tailor the information I share. Whether you're ready now or exploring for the future, I'm here to help.
>
> Just reply to this email or give me a call.
>
> Chad

#### Step 10 · Day 14 — ☎️ Call task (Chad) _(+4 day(s) later)_ · ⚙️ auto

> Day 14 call: Mid-sequence check with [Name]. Assess engagement level and adjust approach.

#### Step 11 · Day 14 — 📱 SMS _(same day)_ · ✋ needs approval

> Hey [FirstName] — I know life gets busy. Just wanted you to know I'm here whenever you're ready to chat about the NAH opportunity. No pressure.

#### Step 12 · Day 17 — 📧 Email _(+3 day(s) later)_ · ✋ needs approval

**Subject:** Franchisee spotlight

> Hi [FirstName],
>
> I wanted to share a quick story. One of our franchisees came in with zero house flipping experience. Within 6 months, they had their first successful flip using our system.
>
> That's the power of a proven model — you don't have to figure it out alone.
>
> I'd love to share more about what the first 90 days look like. Want to schedule a call?
>
> Chad

#### Step 13 · Day 20 — ☎️ Call task (Chad) _(+3 day(s) later)_ · ⚙️ auto

> Day 20 call: Re-engagement attempt with [Name]. If still no contact, consider territory or timing pivot.

#### Step 14 · Day 20 — 📱 SMS _(same day)_ · ✋ needs approval

> [FirstName], I've been thinking about your area — there may be some great territory options available. Want to take a look?

#### Step 15 · Day 24 — 📧 Email _(+4 day(s) later)_ · ✋ needs approval

**Subject:** Your questions answered

> Hi [FirstName],
>
> Here are the most common questions I get from prospects:
>
> Q: How much does it cost?
> A: The investment varies, but most franchisees fund through SBA loans, retirement rollovers, or financing partners.
>
> Q: Do I need experience?
> A: No. Our system and coaching are built for people new to house flipping.
>
> Q: What about territory?
> A: Territories are exclusive — that's what protects your investment.
>
> I'd love to answer any specific questions you have. Just hit reply.
>
> Chad

#### Step 16 · Day 27 — 📱 SMS _(+3 day(s) later)_ · ✋ needs approval

> Hey [FirstName], just a heads up — we're getting more interest in your area. If territory matters to you, let's connect soon.

#### Step 17 · Day 30 — ☎️ Call task (Chad) _(+3 day(s) later)_ · ⚙️ auto

> Day 30 final call: Last attempt with [Name]. If no engagement, move to Follow-up pipeline.

#### Step 18 · Day 30 — 📱 SMS _(same day)_ · ✋ needs approval

> [FirstName], this is my last scheduled reach-out for now. If the timing isn't right, no worries — the door is always open. Wishing you the best.

---

## New Prospect: Path to Ownership Nurture

- **Status:** 🟢 Live
- **Type:** `new_lead_nurture`
- **Purpose:** 14-day nurture sequence for new prospects in the Path to Ownership pipeline, designed to get them to book an intro call via warm SMS and email touchpoints from Chad.
- **Enrollment / Trigger:** Auto — on **`contact.stage_changed`** where `pipelineName contains "Path to Ownership"` AND `stageName equals "Engagement"`
  _When a contact is moved into Stage 1 (Engagement) of the Sales — Path to Ownership pipeline_
- **Exit:** Ends after **14 days**; exits early if `appointmentStatus equals "booked"` or `contactReplied equals true`; _Exit when the prospect books an intro call, replies to any message, or Day 14 ends — whichever comes first._
- **Primary metric:** Intro call booking rate
- **⚠️ Audit flags:** 7/7 emails are plain text (no formatting/links)

### Steps (13)

#### Step 1 · Day 1 @ 09:00:00 — ☎️ Call task (Chad) _(start)_ · ⚙️ auto

**Subject:** New prospect just entered the pipeline. Call [FirstName] today to introduce yourself, answer any initial questions, and invite them to book an intro call at https://api.leadconnectorhq.com/widget/bookings/nahintro

> 📞 New Prospect – Initial Outreach: [FirstName] [LastName]

#### Step 2 · Day 1 @ 11:00:00 — 📱 SMS _(same day)_ · ✋ needs approval

> Hey [FirstName]! This is Chad with New Again Houses Franchise Development. I saw your interest come through and wanted to personally reach out — we'd love to connect! Here's a link to grab a quick intro call at your convenience: https://api.leadconnectorhq.com/widget/bookings/nahintro. Looking forward to chatting! 🏡

**Links:** `https://api.leadconnectorhq.com/widget/bookings/nahintro.`

#### Step 3 · Day 1 @ 11:30:00 — 📧 Email _(same day)_ · ✋ needs approval

**Subject:** Welcome to New Again Houses — Let's Talk Franchise Ownership 🏡

> Hi [FirstName],
>
> Welcome — and thank you for your interest in New Again Houses Franchise Development! My name is Chad Arnold, and I'm excited to be your guide through this process.
>
> I wanted to start by sharing a quick message from our VP of Operations, Sam Ferguson, who does a wonderful job telling the story of how New Again Houses came to be and where we're headed:
>
> 🎥 Watch Sam's Intro Video → https://www.youtube.com/watch?v=YNKstKjMYEo
>
> **Our Story**
> New Again Houses was founded in Bristol, TN — a small Appalachian city on the Virginia-Tennessee border. What started as a local house-flipping operation grew into a proven, repeatable franchise model built for everyday entrepreneurs who want to build real wealth through real estate.
>
> **The Path to Ownership**
> Our process is designed to be transparent, educational, and pressure-free. Here's what it looks like:
>
> 1. Intro Call — Get to know each other and answer your big questions
> 2. Discovery — Dive deep into the model, financials, and your market
> 3. Validation — Talk to existing franchisees
> 4. Awarding — Make your decision with confidence
>
> I'd love to connect for a quick 20-minute intro call so we can see if this is a fit. You can grab a time that works for you right here:
>
> 📅 Book Your Intro Call → https://api.leadconnectorhq.com/widget/bookings/nahintro
>
> ⚠️ Note: I'll be following up within 24 hours — if I don't hear from you, I'll assume you'd like to continue receiving information and will keep the conversation going!
>
> Talk soon,
> Chad Arnold
> Franchise Development | New Again Houses
>
> —
> 📺 YouTube: @newagainhousesfranchise
> 📘 Facebook: New Again Houses Franchise

**Links:** `https://www.youtube.com/watch?v=YNKstKjMYEo` · `https://api.leadconnectorhq.com/widget/bookings/nahintro`

#### Step 4 · Day 3 @ 10:00:00 — 📱 SMS _(+2 day(s) later)_ · ✋ needs approval

> Hey [FirstName], Chad here again! Just wanted to make sure my email didn't get lost. 😊 If you have 20 minutes, I'd love to connect on a quick intro call — no pressure at all. Grab a time here: https://api.leadconnectorhq.com/widget/bookings/nahintro

**Links:** `https://api.leadconnectorhq.com/widget/bookings/nahintro`

#### Step 5 · Day 3 @ 13:00:00 — 📧 Email _(same day)_ · ✋ needs approval

**Subject:** The Founder Who's Been on Real Estate Disruptors 🎙️

> Hi [FirstName],
>
> I wanted to share something that gives you a real feel for the culture and mission behind New Again Houses — straight from our founder, Matt Lavinder.
>
> Matt was featured on the Real Estate Disruptors podcast, where he talks about how he built the model, the philosophy behind it, and what makes this franchise different from anything else in the space:
>
> 🎥 Watch Matt on Real Estate Disruptors → https://www.youtube.com/watch?v=OlVUtYUNPjM
>
> If you're more of a podcast person, Matt also hosts **Find a Way** — a show about entrepreneurship, grit, and building something that matters:
>
> 🎧 Listen to Find a Way on Spotify → https://open.spotify.com/show/4X4cg6I3ndMB9EtF9R2HzD
>
> Matt's story is genuine, and I think you'll walk away from both feeling like you know exactly what this company stands for.
>
> Whenever you're ready, I'd love to chat. Book a time here:
>
> 📅 Book Your Intro Call → https://api.leadconnectorhq.com/widget/bookings/nahintro
>
> Talk soon,
> Chad Arnold
> Franchise Development | New Again Houses
>
> —
> 📺 YouTube: @newagainhousesfranchise
> 📘 Facebook: New Again Houses Franchise

**Links:** `https://www.youtube.com/watch?v=OlVUtYUNPjM` · `https://open.spotify.com/show/4X4cg6I3ndMB9EtF9R2HzD` · `https://api.leadconnectorhq.com/widget/bookings/nahintro`

#### Step 6 · Day 5 @ 09:00:00 — 📧 Email _(+2 day(s) later)_ · ✋ needs approval

**Subject:** Good Morning — Here's What Franchisees Actually Think of Us 📊

> Good morning, [FirstName]!
>
> One of the questions I get most often is: "But what do the franchisees really think?"
>
> Great question — and thankfully, we have receipts. 😄
>
> New Again Houses was ranked **#11 overall** in the 2025 Franchise Business Review satisfaction survey — putting us in the **top quartile** of all franchises evaluated. Here's what stood out:
>
> ✅ 28% above the franchise industry average in overall franchisee satisfaction
> ✅ Above average in every real estate franchise category
> ✅ Consistently high marks for training, support, and culture
>
> You can read the full FBR survey results here:
> 📄 View Our FBR Report → https://drive.google.com/file/d/14-niKGPXWKcjONsRDMrXZvL2i7KU9qos/view
>
> Or explore Franchise Business Review's full rankings:
> 🌐 FBR Website → https://franchisebusinessreview.com/
>
> These aren't numbers we manufactured — they come directly from franchisees who filled out anonymous surveys. That means a lot.
>
> Ready to see if this could be the right fit for you? Let's talk:
>
> 📅 Book Your Intro Call → https://api.leadconnectorhq.com/widget/bookings/nahintro
>
> Have a great morning,
> Chad Arnold
> Franchise Development | New Again Houses
>
> —
> 📺 YouTube: @newagainhousesfranchise
> 📘 Facebook: New Again Houses Franchise

**Links:** `https://drive.google.com/file/d/14-niKGPXWKcjONsRDMrXZvL2i7KU9qos/view` · `https://franchisebusinessreview.com/` · `https://api.leadconnectorhq.com/widget/bookings/nahintro`

#### Step 7 · Day 6 @ 12:00:00 — 📱 SMS _(+1 day(s) later)_ · ✋ needs approval

> Hi [FirstName]! Did you know New Again Houses ranks #11 overall in franchisee satisfaction — 28% above the industry average? Real people, real results. 🏡 When you're ready to chat: https://api.leadconnectorhq.com/widget/bookings/nahintro — Chad

**Links:** `https://api.leadconnectorhq.com/widget/bookings/nahintro`

#### Step 8 · Day 7 @ 13:30:00 — 📧 Email _(+1 day(s) later)_ · ✋ needs approval

**Subject:** What Tim & Stephanie Say About New Again Houses 🎥

> Hi [FirstName],
>
> Sometimes the best thing I can do is get out of the way and let our franchisees speak for themselves.
>
> Tim & Stephanie own New Again Houses Greenville — and they put together a video sharing their honest experience with the brand, the support, and what franchise ownership has meant for their family:
>
> 🎥 Watch Tim & Stephanie's Story → https://www.youtube.com/watch?v=g_iaC73yUbo
>
> I love this one because they talk about the real journey — including the questions they had before they got started. Sound familiar? 😊
>
> If their story resonates, I'd love to help you map out what this could look like for you. The intro call is just a conversation — no pressure, no pitch:
>
> 📅 Book Your Intro Call → https://api.leadconnectorhq.com/widget/bookings/nahintro
>
> Hope to hear from you soon,
> Chad Arnold
> Franchise Development | New Again Houses
>
> —
> 📺 YouTube: @newagainhousesfranchise
> 📘 Facebook: New Again Houses Franchise

**Links:** `https://www.youtube.com/watch?v=g_iaC73yUbo` · `https://api.leadconnectorhq.com/widget/bookings/nahintro`

#### Step 9 · Day 9 @ 11:30:00 — 📱 SMS _(+2 day(s) later)_ · ✋ needs approval

> Hey [FirstName] — a lot of our franchisees say the intro call was the moment everything clicked for them. It's only 20 minutes. Would love to make that happen for you: https://api.leadconnectorhq.com/widget/bookings/nahintro — Chad 🏡

**Links:** `https://api.leadconnectorhq.com/widget/bookings/nahintro`

#### Step 10 · Day 10 @ 12:00:00 — 📧 Email _(+1 day(s) later)_ · ✋ needs approval

**Subject:** You Won't Be Doing This Alone — Meet Your Support Team 💪

> Hi [FirstName],
>
> One of the things that sets New Again Houses apart is what happens _after_ you sign. We believe the franchisor's job doesn't end at awarding — it's just getting started.
>
> Our philosophy is simple: **your success is our success.** That's why we invest heavily in ongoing coaching, business support, and a team that genuinely cares about each franchisee's trajectory.
>
> Here's a look at our success coaches in action:
>
> 🎥 Meet Our Success Coaches → https://www.youtube.com/watch?v=EXZq4t7LcBM
>
> Whether you're in your first flip or building a full team, you've got people in your corner who've been through it and know how to help you grow.
>
> I'd love to walk you through exactly what that support looks like for someone in your market. Let's connect:
>
> 📅 Book Your Intro Call → https://api.leadconnectorhq.com/widget/bookings/nahintro
>
> Rooting for you,
> Chad Arnold
> Franchise Development | New Again Houses
>
> —
> 📺 YouTube: @newagainhousesfranchise
> 📘 Facebook: New Again Houses Franchise

**Links:** `https://www.youtube.com/watch?v=EXZq4t7LcBM` · `https://api.leadconnectorhq.com/widget/bookings/nahintro`

#### Step 11 · Day 12 @ 13:00:00 — 📧 Email _(+2 day(s) later)_ · ✋ needs approval

**Subject:** This Is What Our Community Looks Like 🤝

> Hi [FirstName],
>
> Franchise ownership can feel like a solo journey — but at New Again Houses, it's anything but.
>
> Every year we bring our franchisee family together for our annual conference. It's part training, part celebration, and all community. When you see the energy in the room, you understand why our franchisees rate culture so highly.
>
> 🎥 Watch Our 2023 Franchisee Conference Recap → https://www.youtube.com/watch?v=5kIe7Ku0llQ
>
> These are real people who chose to bet on themselves — and found a network of others doing the same. That's something you can't put a price on.
>
> If you've been on the fence, I hope this gives you a feel for what joining this family actually means. And whenever you're ready to take that first step, I'm here:
>
> 📅 Book Your Intro Call → https://api.leadconnectorhq.com/widget/bookings/nahintro
>
> See you on the inside (hopefully! 😄),
> Chad Arnold
> Franchise Development | New Again Houses
>
> —
> 📺 YouTube: @newagainhousesfranchise
> 📘 Facebook: New Again Houses Franchise

**Links:** `https://www.youtube.com/watch?v=5kIe7Ku0llQ` · `https://api.leadconnectorhq.com/widget/bookings/nahintro`

#### Step 12 · Day 13 @ 11:00:00 — 📱 SMS _(+1 day(s) later)_ · ✋ needs approval

> Hey [FirstName], Chad here — just wanted to check in one last time. If franchise ownership with New Again Houses has crossed your mind, I'd love to chat before we wrap up. Grab a time: https://api.leadconnectorhq.com/widget/bookings/nahintro 🏡

**Links:** `https://api.leadconnectorhq.com/widget/bookings/nahintro`

#### Step 13 · Day 14 @ 12:30:00 — 📧 Email _(+1 day(s) later)_ · ✋ needs approval

**Subject:** This Is My Last Email for Now, [FirstName] — But the Door's Always Open 🚪

> Hi [FirstName],
>
> I've really enjoyed sharing the New Again Houses story with you over the past two weeks. This will be my last scheduled email in this series — but I mean it when I say this isn't goodbye.
>
> If the timing isn't right today, that's completely okay. Life moves fast and priorities shift. I'll be moving you into our long-term nurture cadence so you'll continue to hear from us occasionally with updates, stories, and opportunities.
>
> And if something changes — if the timing gets better, the curiosity grows, or you just want to ask a question — I'm always just one click away:
>
> 📅 Book a Call Anytime → https://api.leadconnectorhq.com/widget/bookings/nahintro
>
> Thank you for giving us the opportunity to share what we're building. I hope our paths cross when the time is right. 🙏
>
> Warm regards,
> Chad Arnold
> Franchise Development | New Again Houses
>
> —
> 📺 YouTube: @newagainhousesfranchise
> 📘 Facebook: New Again Houses Franchise

**Links:** `https://api.leadconnectorhq.com/widget/bookings/nahintro`

---

## Post-Call Follow-up

- **Status:** 🟢 Live
- **Type:** `post_call_followup`
- **Purpose:** Recap the call and deliver next steps.
- **Enrollment / Trigger:** ⚠️ **Manual only** — does not fire automatically (no trigger configured)
- **Exit:** Ends after **3 days**
- **Primary metric:** Next step completion rate
- **⚠️ Audit flags:** No automatic trigger (manual enrollment only) · 1/1 emails are plain text (no formatting/links)

### Steps (3)

#### Step 1 · Day 1 — 📧 Email _(start)_ · ✋ needs approval

**Subject:** Great talking with you

> Hi [FirstName],
>
> Great talking with you today! Here's a quick recap of what we discussed and the agreed next steps.
>
> [Scout will personalize this based on Chad's call notes]
>
> Let me know if you have any questions.
>
> Chad

#### Step 2 · Day 2 — 📱 SMS _(+1 day(s) later)_ · ✋ needs approval

> Hey [FirstName] — check your email for the recap from our call. Let me know if you have any questions!

#### Step 3 · Day 3 — 📱 SMS _(+1 day(s) later)_ · ✋ needs approval

> [FirstName], just checking in on the next steps we discussed. Anything I can help with?

---

## Pre-Call Reminder

- **Status:** 🟢 Live
- **Type:** `pre_call_reminder`
- **Purpose:** Reduce no-shows and set expectations for upcoming calls.
- **Enrollment / Trigger:** ⚠️ **Manual only** — does not fire automatically (no trigger configured)
- **Exit:** Ends after **2 days**
- **Primary metric:** No-show rate
- **⚠️ Audit flags:** No automatic trigger (manual enrollment only) · 1/1 emails are plain text (no formatting/links)

### Steps (3)

#### Step 1 · Day 1 — 📱 SMS _(start)_ · ✋ needs approval

> Hey [FirstName] — confirming our call on [date] at [time]. Looking forward to it!

#### Step 2 · Day 1 — 📧 Email _(same day)_ · ✋ needs approval

**Subject:** What to expect on our call

> Hi [FirstName],
>
> I'm looking forward to our upcoming call. Here's what we'll cover:
>
> - Your background and goals
> - How the NAH franchise model works
> - Territory availability in your area
> - Next steps if it feels like a fit
>
> No pressure — this is a conversation, not a sales pitch.
>
> See you soon,
> Chad

#### Step 3 · Day 2 — 📱 SMS _(+1 day(s) later)_ · ✋ needs approval

> [FirstName] — just a reminder about our call today. See you soon!

---

## Website Form Leads

- **Status:** 🟢 Live
- **Type:** `drip`
- **Purpose:** Imported from Franchise Tether (12 steps).
- **Enrollment / Trigger:** Auto — on **`journey.created`** where `pipelineSlug equals "sales"` AND `stageName equals "Engagement"` AND `source contains "Website"`
  _When a website form lead is created in Sales — Path to Ownership / Engagement_
- **Exit:** Ends after **14 days**; exits early if `appointmentStatus equals "booked"` or `contactReplied equals true`; _Exit when the prospect books an intro call, replies, or the 14-day website-form sequence ends._
- **Primary metric:** Intro call booking rate

### Steps (12)

#### Step 1 · Day 1 — ☎️ Call task (Chad) _(start)_ · ⚙️ auto

**Subject:** New website form lead: get prospect on intro call

> Get {{journey.name}} on Intro Call

#### Step 2 · Day 1 — 📱 SMS _(same day)_ · ✋ needs approval

> Hi {{contact.first_name}}, this is Chad with New Again Houses. I just got your form - when could you get on a quick call to talk through what New Again Houses is all about?

#### Step 3 · Day 1 — 📧 Email _(same day)_ · ✋ needs approval

**Subject:** Hi {{contact.first_name}} - Welcome to New Again Houses!

> Franchise Opportunity
>
> Hi {{contact.first_name}},
>
> Thank you for reaching out and inquiring about the New Again Houses® Franchise opportunity. We're so glad you found us!
>
> Born in Bristol, TN in 2008, New Again Houses® entered the house-flipping scene – and in 2019, the first franchise was born. Since then, millions of dollars have gone into restoring homes and communities for new families to enjoy for years to come. Our house-flipping franchise focuses on transforming old houses into excellent-condition family homes built to last. Is this the adventure you've been searching for?
>
> ▶ Watch: A short intro from our founder Sam Ferguson
>
> The first step is to book a call with Chad to discuss the timeline of our process — which we call the Path To Ownership — and answer some high-level questions.
>
> Book Your Intro Call
>
> Once you've booked your slot, please confirm your appointment. If it isn't confirmed at least 24 hours in advance, the slot may be reopened for other prospects so we can make the most of our available times.
>
> Thanks again for completing our inquiry form — I look forward to discussing this fantastic franchise concept with you soon.
>
> Chad Arnold &bull; Franchise Development &bull; New Again Houses®
>
> YouTube |
> Facebook |
> Book a call
>
> You're receiving this because you inquired about the New Again Houses® franchise opportunity.

**Links:** `https://www.youtube.com/watch?v=YNKstKjMYEo` · `https://api.leadconnectorhq.com/widget/bookings/nahintro` · `https://www.youtube.com/@newagainhousesfranchise` · `https://www.facebook.com/NewAgainHousesFranchise` · `https://nah-franchise-os-sandbox.vercel.app/frandev/images/nah-logo-email.png`

#### Step 4 · Day 1 — 📧 Email _(same day)_ · ✋ needs approval

**Subject:** Message from our Founder

> Franchise Opportunity
>
> Hi {{contact.first_name}},
>
> I wanted to share a quick video from our founder, Matt Lavinder , from when he spoke on the Real Estate Disruptors podcast. Although he loved his work as a coach, Matt reached the point where he wanted to build something of his own — leading him to walk away from his W-2 and build the New Again Houses Franchise.
>
> ▶ Watch: Matt on Real Estate Disruptors
>
> Matt also recently launched a podcast, and the first interviews are all with our franchisees — a great resource for understanding our owners' backgrounds and the journeys they took to ownership in our system.
>
> ▶ Listen: Find a Way with Matt Lavinder
>
> To take the next step, please book a time using my booking link and start the process today.
>
> Book Your Intro Call
>
> Thanks and have a great day.
>
> Chad Arnold &bull; Franchise Development &bull; New Again Houses®
>
> YouTube |
> Facebook |
> Book a call
>
> You're receiving this because you inquired about the New Again Houses® franchise opportunity.

**Links:** `https://www.youtube.com/watch?v=OlVUtYUNPjM` · `https://open.spotify.com/show/4X4cg6I3ndMB9EtF9R2HzD` · `https://api.leadconnectorhq.com/widget/bookings/nahintro` · `https://www.youtube.com/@newagainhousesfranchise` · `https://www.facebook.com/NewAgainHousesFranchise` · `https://nah-franchise-os-sandbox.vercel.app/frandev/images/nah-logo-email.png`

#### Step 5 · Day 1 — 📱 SMS _(same day)_ · ✋ needs approval

> Hi {{contact.first_name}}, checking back in. Would today or tomorrow be better for a quick intro call about the New Again Houses franchise?

#### Step 6 · Day 2 — 📱 SMS _(+1 day(s) later)_ · ✋ needs approval

> Hi {{contact.first_name}}. For the next step in the New Again Houses Franchise Opportunity follow https://calendly.com/newagainhouses_chad/new-again-houses Thanks.

**Links:** `https://calendly.com/newagainhouses_chad/new-again-houses`

#### Step 7 · Day 3 — 📧 Email _(+1 day(s) later)_ · ✋ needs approval

**Subject:** Hi {{contact.first_name}} - How do we compare to the franchise industry?

> Franchise Opportunity
>
> Good morning {{contact.first_name}},
>
> I want to share some great information about what makes New Again Houses different. Instead of me telling you, here's what our franchisees actually think — based on a survey they complete each year. Highlights from the 2025 results:
>
> - Ranked #11 among the top franchises in the country
> - Ranked in the top quartile for 2024
> - 28% above-average satisfaction rating vs. 376 other franchise brands
> - Ranked above average in every area for real estate franchises
>
> ▶ View the FBR 2025 Franchisee Survey Results
>
> This data comes from a third-party company, Franchise Business Review, which surveys about 370 franchisors in the industry. For 2025 we ranked as the 11th highest-rated system — something we're very proud of, because it shows our franchisees believe in our program and the support our team provides in building a long-term, viable real estate business.
>
> To take the next step, please book a time using my booking link and start the process today. Let me know if you have any questions!
>
> Book Your Intro Call
>
> Stay connected with franchise owner stories and updates: Subscribe on YouTube | Follow us on Facebook
>
> Chad Arnold &bull; Franchise Development &bull; New Again Houses®
>
> YouTube |
> Facebook |
> Book a call
>
> You're receiving this because you inquired about the New Again Houses® franchise opportunity.

**Links:** `https://drive.google.com/file/d/14-niKGPXWKcjONsRDMrXZvL2i7KU9qos/view` · `https://franchisebusinessreview.com/` · `https://api.leadconnectorhq.com/widget/bookings/nahintro` · `https://www.youtube.com/@newagainhousesfranchise` · `https://www.facebook.com/NewAgainHousesFranchise` · `https://nah-franchise-os-sandbox.vercel.app/frandev/images/nah-logo-email.png`

#### Step 8 · Day 5 — 📧 Email _(+2 day(s) later)_ · ✋ needs approval

**Subject:** Franchisee Testimonial

> Franchise Opportunity
>
> Hi {{contact.first_name}},
>
> I'm sharing a short video from one of our franchise owners as they talk about why they decided to franchise with us.
>
> ▶ Watch: Tim & Stephanie — New Again Houses® Greenville
>
> We'd love to share more reasons this opportunity might be a great fit if you want to become a real estate entrepreneur.
>
> To take the next step, please book a time using my booking link and start the process today.
>
> Book Your Intro Call
>
> Thanks and have a great day.
>
> Chad Arnold &bull; Franchise Development &bull; New Again Houses®
>
> YouTube |
> Facebook |
> Book a call
>
> You're receiving this because you inquired about the New Again Houses® franchise opportunity.

**Links:** `https://www.youtube.com/watch?v=g_iaC73yUbo` · `https://api.leadconnectorhq.com/widget/bookings/nahintro` · `https://www.youtube.com/@newagainhousesfranchise` · `https://www.facebook.com/NewAgainHousesFranchise` · `https://nah-franchise-os-sandbox.vercel.app/frandev/images/nah-logo-email.png`

#### Step 9 · Day 6 — 📱 SMS _(+1 day(s) later)_ · ✋ needs approval

> Hi {{contact.first_name}}, wanted to make sure you saw my note. Happy to answer questions and help you decide if an intro call makes sense. What does your schedule look like?

#### Step 10 · Day 8 — 📧 Email _(+2 day(s) later)_ · ✋ needs approval

**Subject:** What makes us different? Our People!

> Franchise Opportunity
>
> Hi {{contact.first_name}},
>
> We believe our role as a franchisor is to give our franchisees as many resources as possible to achieve their definition of success — from onboarding through ongoing coaching with our success team.
>
> Here's a short video so you can meet the specialized business coaches you'll work with if you're awarded a franchise.
>
> ▶ Watch: Meet our success coaches
>
> To take the next step, please book a time using my booking link and start the process today.
>
> Book Your Intro Call
>
> Thanks and have a great day.
>
> Chad Arnold &bull; Franchise Development &bull; New Again Houses®
>
> YouTube |
> Facebook |
> Book a call
>
> You're receiving this because you inquired about the New Again Houses® franchise opportunity.

**Links:** `https://www.youtube.com/watch?v=EXZq4t7LcBM` · `https://api.leadconnectorhq.com/widget/bookings/nahintro` · `https://www.youtube.com/@newagainhousesfranchise` · `https://www.facebook.com/NewAgainHousesFranchise` · `https://nah-franchise-os-sandbox.vercel.app/frandev/images/nah-logo-email.png`

#### Step 11 · Day 12 — 📧 Email _(+4 day(s) later)_ · ✋ needs approval

**Subject:** New Again Houses Franchise Follow Up

> Franchise Opportunity
>
> Hi {{contact.first_name}},
>
> I wanted to follow up on the inquiry you made regarding our franchise offering.
>
> Please check out a video from our 2023 Franchisee Conference — it captures the excitement and energy our franchisees have about belonging to the NAH community.
>
> ▶ Watch: 2023 New Again Houses Conference
>
> To take the next step, please book a time using my booking link and start the process today.
>
> Book Your Intro Call
>
> Thanks and have a great day.
>
> Chad Arnold &bull; Franchise Development &bull; New Again Houses®
>
> YouTube |
> Facebook |
> Book a call
>
> You're receiving this because you inquired about the New Again Houses® franchise opportunity.

**Links:** `https://www.youtube.com/watch?v=5kIe7Ku0llQ` · `https://api.leadconnectorhq.com/widget/bookings/nahintro` · `https://www.youtube.com/@newagainhousesfranchise` · `https://www.facebook.com/NewAgainHousesFranchise` · `https://nah-franchise-os-sandbox.vercel.app/frandev/images/nah-logo-email.png`

#### Step 12 · Day 14 — 📧 Email _(+2 day(s) later)_ · ✋ needs approval

**Subject:** Time to move on

> Franchise Opportunity
>
> Hi {{contact.first_name}},
>
> We've tried to move you to the first step in our process and shared several emails and videos to give you a sense of what our opportunity offers — but it doesn't seem like the right time for you to connect just yet.
>
> No problem at all. We'll move you to a longer-term, information-sharing campaign so you can stay up to date on our franchise system and reconnect whenever you're ready.
>
> If you'd like to take the next step now, you can always book a time using my booking link.
>
> Book a Call When You're Ready
>
> Thanks, and good luck in all of your future endeavors!
>
> Chad Arnold &bull; Franchise Development &bull; New Again Houses®
>
> YouTube |
> Facebook |
> Book a call
>
> You're receiving this because you inquired about the New Again Houses® franchise opportunity.

**Links:** `https://api.leadconnectorhq.com/widget/bookings/nahintro` · `https://www.youtube.com/@newagainhousesfranchise` · `https://www.facebook.com/NewAgainHousesFranchise` · `https://nah-franchise-os-sandbox.vercel.app/frandev/images/nah-logo-email.png`

---

## FDD Nurture (14-Day)

- **Status:** ⚪ Draft (not active)
- **Type:** `fdd_nurture`
- **Purpose:** Keep prospects engaged during the mandatory 14-day FDD review period with legal-safe content.
- **Enrollment / Trigger:** Auto — on **`stage.advanced`** where `pipelineSlug equals "sales"` AND `toStageSlug equals "compliance"`
  _When a deal reaches Compliance (FDD review) in Path to Ownership_
- **Exit:** Ends after **14 days**
- **Primary metric:** Engagement rate
- **⚠️ Audit flags:** Draft — not live yet · 4/4 emails are plain text (no formatting/links)

### Steps (8)

#### Step 1 · Day 1 — 📧 Email _(start)_ · ✋ needs approval

**Subject:** Your FDD review period has started

> Hi [FirstName],
>
> Your Franchise Disclosure Document (FDD) review period has officially started. This is a mandatory 14-day period where you can review the document at your own pace.
>
> During this time, I'll check in periodically with helpful information. No pressure, no rush — this is your time to review.
>
> For legal questions, please consult your attorney.
>
> Chad

#### Step 2 · Day 3 — 📱 SMS _(+2 day(s) later)_ · ✋ needs approval

> Hey [FirstName] — how's the FDD review going? Any questions so far? For legal questions, please consult your attorney.

#### Step 3 · Day 5 — 📧 Email _(+2 day(s) later)_ · ✋ needs approval

**Subject:** Understanding the NAH business model

> Hi [FirstName],
>
> While you review your FDD, I wanted to share some context about how the NAH business model works in practice. Our franchisees benefit from exclusive territories, construction coaching, and proven systems that reduce the typical learning curve.
>
> This is educational context to help you understand what you're reading in the FDD.
>
> For any legal questions about the document, please consult your attorney.
>
> Chad

#### Step 4 · Day 7 — 📱 SMS _(+2 day(s) later)_ · ✋ needs approval

> [FirstName] — checking in on week one of your FDD review. How are things looking? Happy to answer any general questions. For legal questions, please consult your attorney.

#### Step 5 · Day 9 — 📧 Email _(+2 day(s) later)_ · ✋ needs approval

**Subject:** Meet one of our franchisees

> Hi [FirstName],
>
> I wanted to share a bit about the NAH franchisee experience. Our franchise owners come from diverse backgrounds — some with construction experience, many without.
>
> What they all have in common is the support system that helps them succeed from day one.
>
> For any legal questions about your FDD, please consult your attorney.
>
> Chad

#### Step 6 · Day 10 — 📱 SMS _(+1 day(s) later)_ · ✋ needs approval

> Hey [FirstName], just checking in. Your FDD review is past the halfway point. Any questions I can help with? For legal questions, please consult your attorney.

#### Step 7 · Day 12 — 📧 Email _(+2 day(s) later)_ · ✋ needs approval

**Subject:** What happens after your FDD review

> Hi [FirstName],
>
> Your 14-day FDD review period is almost complete. Here's what the next steps look like:
>
> 1. We'll schedule a decision call to discuss your thoughts
> 2. If you decide to move forward, we'll walk through the agreement
> 3. Then we kick off onboarding — territory setup, training, and your first project
>
> No decisions needed yet — just wanted you to know what's ahead.
>
> For any legal questions, please consult your attorney.
>
> Chad

#### Step 8 · Day 14 — 📱 SMS _(+2 day(s) later)_ · ✋ needs approval

> [FirstName], your FDD review period is complete. Ready to discuss next steps? I'd love to schedule a call when you're ready.

---

## Follow-up Cadence

- **Status:** ⚪ Draft (not active)
- **Type:** `follow_up_cadence`
- **Purpose:** Consistent touches for warm leads with interest but no locked-in next step.
- **Enrollment / Trigger:** Auto — on **`stage.advanced`** where `pipelineSlug equals "followup"` AND `toStageSlug equals "followup"`
  _When a contact moves to the Follow-up stage_
- **Exit:** Ends after **28 days**
- **Primary metric:** Re-engagement rate
- **⚠️ Audit flags:** Draft — not live yet · 2/2 emails are plain text (no formatting/links)

### Steps (6)

#### Step 1 · Day 7 — ☎️ Call task (Chad) _(start)_ · ⚙️ auto

> 7-day follow-up with [Name]. Draft next message based on last conversation.

#### Step 2 · Day 7 — 📱 SMS _(same day)_ · ✋ needs approval

> Hey [FirstName], just following up from our last conversation. Anything new on your end?

#### Step 3 · Day 14 — 📧 Email _(+7 day(s) later)_ · ✋ needs approval

**Subject:** Tailored for you

> Hi [FirstName],
>
> I was thinking about our conversation and wanted to share some information specifically relevant to your situation.
>
> [Scout will tailor based on conversation history and objections]
>
> Let me know your thoughts.
>
> Chad

#### Step 4 · Day 21 — ☎️ Call task (Chad) _(+7 day(s) later)_ · ⚙️ auto

> 21-day follow-up with [Name]. Personal call recommended — assess if lead should move back to pipeline or to nurture.

#### Step 5 · Day 21 — 📱 SMS _(same day)_ · ✋ needs approval

> [FirstName], wanted to check in. I know timing is everything — just want to make sure I'm here when you're ready.

#### Step 6 · Day 28 — 📧 Email _(+7 day(s) later)_ · ✋ needs approval

**Subject:** Keeping the door open

> Hi [FirstName],
>
> Just a quick note to say I'm here whenever you're ready to continue the conversation. No rush, no pressure.
>
> In the meantime, if you have any questions, just hit reply.
>
> Chad

---

## Intro Call Info Campaign

- **Status:** ⚪ Draft (not active)
- **Type:** `drip`
- **Purpose:** Imported from Franchise Tether (3 steps).
- **Enrollment / Trigger:** Auto — on **`stage.advanced`** where `pipelineSlug equals "sales"` AND `toStageSlug equals "qualification"`
  _When a deal reaches Qualification in Path to Ownership_
- **Exit:** —
- **⚠️ Audit flags:** Draft — not live yet · 3/3 emails are plain text (no formatting/links)

### Steps (3)

#### Step 1 · Day 0 — 📧 Email _(start)_ · ✋ needs approval

**Subject:** Hi {{contact.first_name}} - Quick Video From Matt Lavinder

> Hi {{contact.first_name}}. We wanted to share a quick video from our founder, Matt Lavinder, when he spoke on the Real Estate Disruptors podcast. Although he loved what he did as a coach, Matt reached the point where he wanted to build something of his own leading him to walk away from his W-2 and build the New Again Houses Franchise. Our founder shares the difficulty of leaving a W2 job. If you want to watch the full video, you can check that out using this link: https://www.youtube.com/watch?v=OlVUtYUNPjM Thanks and have a great day and I am looking forward to our call.

**Links:** `https://www.youtube.com/watch?v=OlVUtYUNPjM​Thanks`

#### Step 2 · Day 2 @ 11:30:00 — 📧 Email _(+2 day(s) later)_ · ✋ needs approval

**Subject:** What some of franchisees have to say about our relationship

> Hi {{contact.first_name}}. I am sharing a short video from one of our franchise owners as they talk about why they decided to franchise with us. Tim & Stephanie - New Again Houses® GreenvilleDuring the process you will get a chance to speak with any (or all) of our franchisees so that you can hear directly from them what their experience has been like since they joined the system. Thanks and have a great day.

#### Step 3 · Day 5 @ 08:45:00 — 📧 Email _(+3 day(s) later)_ · ✋ needs approval

**Subject:** Hi {{contact.first_name}} - What makes us different? Our People!

> Hi {{contact.first_name}}. We believe that our role as a franchisor is to provide our franchisees with as many resources as we can to give them the best chance of achieving their definition of success. There are a multitude of ways we do that from the time you begin the onboarding process through ongoing coaching with our success team. Here is a short video of our team so you can get to meet the specialized business coaches you will be working with if you are to be awarded a franchise. Get to know our success coaches.Thanks and have a great day.

---

## Long-term Nurture

- **Status:** ⚪ Draft (not active)
- **Type:** `long_term_nurture`
- **Purpose:** Monthly touch from Chad plus automated value content for prospects with future potential.
- **Enrollment / Trigger:** Auto — on **`stage.advanced`** where `pipelineSlug equals "followup"` AND `toStageSlug equals "nurture"`
  _When a contact moves to the Nurture stage_
- **Exit:** Ends after **90 days**
- **Primary metric:** Content engagement rate
- **⚠️ Audit flags:** Draft — not live yet · 3/3 emails are plain text (no formatting/links)

### Steps (8)

#### Step 1 · Day 14 — 📧 Email _(start)_ · ✋ needs approval

**Subject:** Market insights from NAH

> Hi [FirstName],
>
> Wanted to share some insights from the house flipping market. The opportunity continues to grow, especially for franchisees with exclusive territories and proven systems.
>
> Hope you find this interesting. As always, if you want to chat, I'm here.
>
> Chad

#### Step 2 · Day 30 — ☎️ Call task (Chad) _(+16 day(s) later)_ · ⚙️ auto

> Monthly personal touch with [Name]. Check in, provide value, assess readiness.

#### Step 3 · Day 30 — 📱 SMS _(same day)_ · ✋ needs approval

> Hey [FirstName], just checking in. Hope all is well! If anything changes on your end, you know where to find me.

#### Step 4 · Day 45 — 📧 Email _(+15 day(s) later)_ · ✋ needs approval

**Subject:** Franchisee spotlight

> Hi [FirstName],
>
> Wanted to share a quick franchisee story — it's always inspiring to see how people from different backgrounds succeed with the NAH system.
>
> Hope this finds you well.
>
> Chad

#### Step 5 · Day 60 — ☎️ Call task (Chad) _(+15 day(s) later)_ · ⚙️ auto

> 60-day check with [Name]. Assess if re-engagement sequence should be triggered.

#### Step 6 · Day 60 — 📧 Email _(same day)_ · ✋ needs approval

**Subject:** What's new at New Again Houses

> Hi [FirstName],
>
> Quick update on what's happening at NAH — new markets, new franchisees, and continued growth.
>
> If you're curious about what's changed since we last spoke, I'd love to catch up.
>
> Chad

#### Step 7 · Day 75 — 📱 SMS _(+15 day(s) later)_ · ✋ needs approval

> [FirstName], it's been a couple months. Has anything changed? Would love to reconnect if the timing is better now.

#### Step 8 · Day 90 — 🤖 AI check _(+15 day(s) later)_ · ⚙️ auto

> 90-day review: assess engagement. If zero opens/clicks, recommend archive review.

---

## Onboarding Welcome

- **Status:** ⚪ Draft (not active)
- **Type:** `onboarding_welcome`
- **Purpose:** Welcome new franchisee and kick off onboarding at Funds Received stage.
- **Enrollment / Trigger:** Auto — on **`stage.advanced`** where `pipelineSlug equals "sales"` AND `toStageSlug equals "closed"`
  _When a deal reaches Closed (won) in Path to Ownership_
- **Exit:** Ends after **14 days**
- **Primary metric:** Onboarding task completion rate
- **⚠️ Audit flags:** Draft — not live yet · 4/4 emails are plain text (no formatting/links)

### Steps (9)

#### Step 1 · Day 1 — 📱 SMS _(start)_ · ✋ needs approval

> Congratulations [FirstName]! Welcome to the New Again Houses family! Check your email for your onboarding overview.

#### Step 2 · Day 1 — 📧 Email _(same day)_ · ✋ needs approval

**Subject:** Welcome to New Again Houses!

> Hi [FirstName],
>
> Congratulations and welcome to the New Again Houses franchise family!
>
> I'm thrilled to have you on board. Here's what happens next:
>
> - Your welcome kit information is on its way
> - Your territory setup begins immediately
> - Your onboarding schedule will be shared within 48 hours
>
> You'll be hearing from our team members shortly to get everything rolling.
>
> Welcome aboard!
> Chad

#### Step 3 · Day 1 — 🔔 Team notify _(same day)_ · ⚙️ auto

> New franchisee closed: [Name]. Notify construction coach, lending partner, and leadership.

#### Step 4 · Day 2 — 📧 Email _(+1 day(s) later)_ · ✋ needs approval

**Subject:** Meet your construction coach

> Hi [FirstName],
>
> One of the biggest advantages of the NAH franchise is having a dedicated construction coach. They'll guide you through your first projects and help you build confidence.
>
> Your coach will be reaching out shortly to schedule an intro call.
>
> Exciting times ahead!
> Chad

#### Step 5 · Day 3 — 📱 SMS _(+1 day(s) later)_ · ✋ needs approval

> Hey [FirstName] — how are you feeling? Any immediate questions as we get started? I'm here for you.

#### Step 6 · Day 5 — 📧 Email _(+2 day(s) later)_ · ✋ needs approval

**Subject:** Your financing next steps

> Hi [FirstName],
>
> Now that you're officially part of the team, our lending partner will be reaching out to discuss financing options for your first projects.
>
> They'll walk you through everything and make sure you're set up for success.
>
> Chad

#### Step 7 · Day 7 — 📧 Email _(+2 day(s) later)_ · ✋ needs approval

**Subject:** Training schedule and access

> Hi [FirstName],
>
> Your training schedule and access credentials should be in your inbox. If you haven't received them, let me know and I'll make sure they're sent right away.
>
> The first 30 days are all about getting you up to speed. The next 60 are about your first project. And by day 90, you'll be running the show.
>
> Chad

#### Step 8 · Day 14 — 📱 SMS _(+7 day(s) later)_ · ✋ needs approval

> [FirstName] — two weeks in! How's onboarding going? Let's schedule a call if we haven't already to make sure you have everything you need.

#### Step 9 · Day 14 — ☎️ Call task (Chad) _(same day)_ · ⚙️ auto

> 14-day onboarding check with [Name]. Ensure first onboarding call is scheduled.

---

## Re-engagement

- **Status:** ⚪ Draft (not active)
- **Type:** `re_engagement`
- **Purpose:** Bring cold leads back from Nurture or Follow-up pipelines.
- **Enrollment / Trigger:** Auto — on **`stage.advanced`** where `pipelineSlug equals "followup"` AND `toStageSlug equals "reengaged"`
  _When a contact moves to the Re-engaged stage_
- **Exit:** Ends after **14 days**
- **Primary metric:** Response rate
- **⚠️ Audit flags:** Draft — not live yet · 3/3 emails are plain text (no formatting/links)

### Steps (6)

#### Step 1 · Day 1 — 📱 SMS _(start)_ · ✋ needs approval

> Hey [FirstName], it's Chad with New Again Houses. It's been a while — just wanted to check in. Has anything changed on your end?

#### Step 2 · Day 3 — 📧 Email _(+2 day(s) later)_ · ✋ needs approval

**Subject:** Exciting updates at NAH

> Hi [FirstName],
>
> Hope you've been well! A lot has happened at New Again Houses since we last spoke. We've continued growing and supporting our franchisees across the country.
>
> I wanted to reconnect and see if the timing might be better now. No pressure — just wanted to keep you in the loop.
>
> Would love to catch up if you're open to it.
>
> Chad

#### Step 3 · Day 5 — 📱 SMS _(+2 day(s) later)_ · ✋ needs approval

> [FirstName], still thinking about business ownership? Would love to reconnect and share what's new at NAH.

#### Step 4 · Day 7 — 📧 Email _(+2 day(s) later)_ · ✋ needs approval

**Subject:** Thinking of you

> Hi [FirstName],
>
> I was looking back at our previous conversation and wanted to reach out personally. Your background and interest stood out to me.
>
> If the timing is better now, I'd love to pick up where we left off. If not, no worries at all.
>
> The door is always open.
>
> Chad

#### Step 5 · Day 10 — 📱 SMS _(+3 day(s) later)_ · ✋ needs approval

> Hey [FirstName] — quick update: there may be territory availability in your area. Want me to check?

#### Step 6 · Day 14 — 📧 Email _(+4 day(s) later)_ · ✋ needs approval

**Subject:** The door is always open

> Hi [FirstName],
>
> This is my last scheduled reach-out for now. I want you to know that whenever the timing is right for you, we're here.
>
> New Again Houses isn't going anywhere, and your interest means a lot to us.
>
> Wishing you all the best,
> Chad

---

## Trainual Nudge

- **Status:** ⚪ Draft (not active)
- **Type:** `trainual_nudge`
- **Purpose:** Get the prospect to open Trainual within 48 hours of receiving access.
- **Enrollment / Trigger:** Auto — on **`stage.advanced`** where `pipelineSlug equals "onboarding"` AND `toStageSlug equals "training"`
  _When a new franchisee reaches the Training stage in Onboarding_
- **Exit:** Ends after **7 days**
- **Primary metric:** Trainual open rate
- **⚠️ Audit flags:** Draft — not live yet

### Steps (7)

#### Step 1 · Day 1 — 📘 Trainual check _(start)_ · ⚙️ auto

> Check if prospect has opened Trainual

#### Step 2 · Day 1 — 📱 SMS _(same day)_ · ✋ needs approval

> Hey [FirstName] — did you get a chance to check out the Trainual link I sent? It walks you through the NAH model step by step.

#### Step 3 · Day 2 — 📘 Trainual check _(+1 day(s) later)_ · ⚙️ auto

> 48hr check — has Trainual been opened?

#### Step 4 · Day 2 — 📱 SMS _(same day)_ · ✋ needs approval

> [FirstName], here's the Trainual link again in case you missed it: [link]. It's a quick overview of how the franchise works.

#### Step 5 · Day 2 — ☎️ Call task (Chad) _(same day)_ · ⚙️ auto

> 48hr no-open alert: [Name] hasn't opened Trainual. Personal follow-up needed.

#### Step 6 · Day 4 — 📱 SMS _(+2 day(s) later)_ · ✋ needs approval

> Hey [FirstName] — most prospects who open Trainual move forward faster. It's a quick read and really lays out the opportunity. Worth a look!

#### Step 7 · Day 7 — 📱 SMS _(+3 day(s) later)_ · ✋ needs approval

> [FirstName], just wanted to personally encourage you to check out the Trainual overview. It answers a lot of the common questions I hear. Let me know what you think.

---

# Audit — What Actually Fires Today (2026-06-25)

A workflow only runs if (a) it's **live**, (b) its trigger **event is actually emitted**, and (c) its conditions match. Here's the reality:

## Trigger events EMITTED internally by NAH OS (fire with no GHL webhooks needed)

| Event                                  | Emitted from                                                                          | Fires                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `journey.created`                      | Web-form intake (`/api/leads/intake`), manual contact create (`/api/contacts/create`) | **Website Form Leads**                                                              |
| `stage.advanced`                       | Moving a contact to a new stage in NAH OS (`…/pipelines/[id]/advance`, batch-actions) | Any workflow triggered on `stage.advanced` **or** `contact.stage_changed` (aliased) |
| `subtask.logged` / `subtask.completed` | Logging/completing a sub-task                                                         | Sub-task-triggered workflows                                                        |

## Trigger events that need GHL WEBHOOKS — currently **NOT active** (won't fire)

`contact.created` (webhook route), `appointment.created`, `task.completed`, `opportunity.updated`, tag events, etc. Per CLAUDE.md: _"GHL webhooks are NOT active. Handlers exist but no events are subscribed."_

## Per-workflow firing verdict

| Workflow                                                                                                                  | Live?    | Will it actually fire?                                                                  | Note                                                                            |
| ------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Website Form Leads**                                                                                                    | 🟢       | ✅ YES — on every web-form lead                                                         | Branded + tested. **Trusted.**                                                  |
| **New Prospect: Path to Ownership Nurture**                                                                               | 🟢       | ⚠️ Only when a contact is **advanced into Engagement inside NAH OS** (`stage.advanced`) | **Overlaps** Website Form Leads — a new lead could hit both. Plain-text emails. |
| **New Lead 30-Day Sequence**                                                                                              | 🟢       | ❌ NO — trigger is empty                                                                | Manual only. Overlaps the two above. Decide: wire, repurpose, or retire.        |
| **Pre-Call Reminder**                                                                                                     | 🟢       | ❌ NO — needs `appointment.created` (GHL webhook, inactive)                             | Blocked until webhooks or an internal "appointment booked" event exists.        |
| **Post-Call Follow-up**                                                                                                   | 🟢       | ❌ NO — needs a call-completed event (GHL webhook, inactive)                            | Same blocker.                                                                   |
| **Generic Franchise Drip (1 Yr)**                                                                                         | 🟢       | Manual only (by design)                                                                 | Plain-text.                                                                     |
| **2026 Q2 Cold Lead Drip**                                                                                                | 🟢       | Manual only (by design)                                                                 | Plain-text.                                                                     |
| **FDD Nurture, Follow-up Cadence, Intro Call Info, Long-term Nurture, Onboarding Welcome, Re-engagement, Trainual Nudge** | ⚪ Draft | Would fire on `stage.advanced` once set live                                            | Triggers OK; just in draft. Most are plain-text.                                |

## Recommended path to "trusted & firing"

1. **Resolve the new-lead overlap** — pick ONE primary new-lead workflow (recommend **Website Form Leads**), and pause/retire the others for that path so leads don't get double-messaged.
2. **Format the plain-text emails** (HTML like Website Form Leads) before setting any draft live.
3. **Pre/Post-Call workflows are blocked on GHL webhooks** — decide whether to activate GHL webhooks or add an internal "appointment booked / call completed" event.
4. **Set drafts live one at a time**, each after its content is reviewed + formatted.
