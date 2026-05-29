# ADR 0004: Send safety and agent control plane

## Status
Accepted

## Context
Scout and future agents can draft work that touches real prospects, customers, and GHL records. The DRC rule already says Scout drafts and humans confirm. Phase 4 makes the approval/send safety contract explicit in code, schema, and tests so future agent work cannot quietly bypass it.

## Decision
Customer-facing sends are high-risk actions. They require all of these gates before execution:

- `human_approval` — a human explicitly confirms the final content.
- `immutable_action_log` — an append-only approval log exists before the provider call.
- `quiet_hours` — send timing is checked against configured quiet hours.
- `suppression_list` — DNC, unsubscribe, compliance, and local suppression state are checked.
- `daily_send_cap` — per-contact and provider cap checks are recorded.
- `approved_template` — template-backed sends record template/source approval where applicable.
- `provider_health` — GHL/provider availability and credential readiness are recorded.

The first hard enforcement point is Scout action execution:

- `/api/scout/action` rejects any action whose status is not `confirmed`.
- Customer-facing Scout sends write an `approved_for_execution` log before calling GHL.
- Scout execution logs include `risk_tier`, `approval_source`, `approved_by_user_id`, `safety_checks`, and `output_schema_version`.
- `scout_action_logs` audit fields are immutable at the database layer; contact merge tooling may only reassign `ghl_contact_id`.

The agent control-plane foundation is schema-only for now:

- `agent_runs` tracks bounded agent jobs, outputs, schema version, retry policy, and status.
- `agent_actions` tracks proposed actions, risk tier, provider/suppression/quiet-hours/cap/template checks, and requires human approval by default.
- `agent_run_events` is append-only telemetry for run/action progress.
- `agent_approvals` is append-only human decision history.

## Consequences
- Future autonomous work can draft actions and request approval, but it cannot send directly through this foundation.
- Logs are heavier, but approval audits become reconstructable.
- Quiet hours, suppression, caps, templates, and provider gates are represented before the full policy engine exists.
- Any future worker adding a customer-facing send path must either route through the DRC contract or document a human-originated exception.
