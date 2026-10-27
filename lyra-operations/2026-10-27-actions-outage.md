# Actions outage - 2026-10-27

Database recovery is tracked in [issue #3](https://github.com/BrysonW24/vai-lyra-stock-tracker/issues/3).

## Diagnosis

The hourly scanner last succeeded at 2026-10-26 01:38 UTC (12:38 Sydney). The next run
failed at 02:01 UTC (13:01 Sydney); the latest 54 scanner runs all failed on the same
application commit, `ce95ee3`. Checkout, Python setup and dependency installation succeed.

- [Scanner failure](https://github.com/BrysonW24/vai-lyra-stock-tracker/actions/runs/40455381074):
  `httpx.ConnectError: [Errno -2] Name or service not known` while creating the run row.
- [Morning guide failure](https://github.com/BrysonW24/vai-lyra-stock-tracker/actions/runs/40419298530):
  the same database connectivity error.
- [Nightly maintenance failure](https://github.com/BrysonW24/vai-lyra-stock-tracker/actions/runs/40411627586):
  database-dependent workers cannot connect; the pooler reports
  `tenant/user postgres.droqoofjbclszlceowrp not found`.

Supabase reports `lyra-stock-tracker` (`droqoofjbclszlceowrp`) as `INACTIVE`.
Resuming it was refused because the account already has two active free projects:
`podium-ps-db` and `vivacity-ai-db`. The cause of the pause itself is unconfirmed.
The database must be resumed before these production jobs can recover.

The latest CI passed on this commit. The latest runs of AI Briefing, Daily Read,
Content Review, model evaluation, Deploy Smoke, Solo sync and RBA also passed.
These results do not prove database availability: most predate the outage, and
today's RBA runs exit at the calendar gate.

## Keepalive repair

The shared keepalive action previously enabled every scheduled workflow on every
surviving cron run. This undid a manual operational pause. It now reads the state
first and enables only `active` or `disabled_inactivity` workflows. It preserves
`disabled_manually`, leaves other states unchanged, and warns on API failures.
`tests/test_workflow_keepalive.py` executes the real action shell against a fake
GitHub CLI, including refused reads/writes and continued processing.

## Recovery

1. Choose which services should remain active. Resuming Lyra requires freeing an
   active free project slot or an approved billing change. Do not pause another
   application's database without the owner's choice.
2. Resume Lyra and wait until Supabase reports `ACTIVE_HEALTHY`.
3. Verify a read-only database query and a REST read with the existing worker
   credentials. Resume any deliberately paused Lyra workflows explicitly.
4. Run the scanner once and verify that it records a successful run and persists
   real results. Run the nightly checks, then rehearse the morning guide using its
   dry-run input before the next scheduled delivery.

If Lyra will remain paused, deliberately disable its database-dependent schedules
to stop repeated outage emails, and record which workflows were paused. Keepalive
will preserve that choice after the repair is merged. CI and Solo sync can remain
enabled. Re-enabling jobs while the database is inactive will reproduce the outage.
