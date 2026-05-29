# Scheduler Ownership Contract

FranDev production scheduling is owned by Vercel Cron.

- Vercel owns production cron triggers in `vercel.json`.
- GitHub Actions may expose manual MasterSuite sync dispatch, but scheduled MasterSuite sync is disabled because GitHub runner IPs are not whitelisted by MasterSuite MySQL.
- Local launchd/node-cron jobs are not production owners for MasterSuite sync. Local runs are manual diagnostics only.
- If production scheduler ownership changes, update this document, `docs/build-deploy-runbook.md`, `.github/workflows/sync-mastersuite.yml`, and `vercel.json` in the same change.

