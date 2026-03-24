# GHL Workflow Inbound Webhook URLs

> Fill this in after creating all 10 workflows in GHL.
> Each URL is found by clicking the Inbound Webhook trigger in the workflow editor.
> These URLs get stored in the Supabase `ghl_workflows` table so Scout can trigger them.

| Workflow Name | Supabase Key | Inbound Webhook URL |
|---------------|-------------|---------------------|
| New Lead Welcome | new_lead_welcome | PASTE_URL_HERE |
| Active Follow-up Sequence | active_follow_up | PASTE_URL_HERE |
| Qualified Lead — Trainual Access | qualified_trainual | PASTE_URL_HERE |
| Discovery Reminder Sequence | discovery_reminder | PASTE_URL_HERE |
| Validation Team Intro Sequence | validation_intro | PASTE_URL_HERE |
| FDD Nurture Sequence | fdd_nurture | PASTE_URL_HERE |
| Long-term Nurture | long_term_nurture | PASTE_URL_HERE |
| New Franchisee Onboarding | franchisee_onboarding | PASTE_URL_HERE |
| Agreement Execution | agreement_execution | PASTE_URL_HERE |
| Re-engagement Alert | re_engagement_alert | PASTE_URL_HERE |

## How to Store in Database

After filling in all URLs above, run this SQL in Supabase (replace each PASTE_URL_HERE with the real URL):

```sql
INSERT INTO ghl_workflows (name, webhook_url, description, is_active) VALUES
  ('new_lead_welcome', 'PASTE_URL_HERE', 'Fires when a new lead enters Stage 1', true),
  ('active_follow_up', 'PASTE_URL_HERE', 'Day 1/3/5/7 follow-up sequence for contacted leads', true),
  ('qualified_trainual', 'PASTE_URL_HERE', 'Sends Trainual access after qualification', true),
  ('discovery_reminder', 'PASTE_URL_HERE', 'Pre-call reminders: 24hr + 1hr before discovery call', true),
  ('validation_intro', 'PASTE_URL_HERE', 'Schedules construction coach, lending partner, franchisee calls', true),
  ('fdd_nurture', 'PASTE_URL_HERE', 'Legal-safe educational content during 14-day FDD review', true),
  ('long_term_nurture', 'PASTE_URL_HERE', 'Monthly personal touch + bi-weekly automated content', true),
  ('franchisee_onboarding', 'PASTE_URL_HERE', 'Welcome sequence + onboarding tasks after funds received', true),
  ('agreement_execution', 'PASTE_URL_HERE', 'Signing checklist and team notifications', true),
  ('re_engagement_alert', 'PASTE_URL_HERE', 'Alerts Chad when a cold lead re-engages', true);
```
