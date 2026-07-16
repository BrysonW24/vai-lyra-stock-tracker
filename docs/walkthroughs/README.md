# Lyra walkthroughs - clone to live, step by step

These five documents take a friend from "what is this?" to their own live, deployed Lyra.
They are written for someone comfortable in a terminal who has never seen this repo. Every
step has a "You know it worked when" checkpoint - if a checkpoint fails, stop there and use
that walkthrough's troubleshooting table before moving on.

**Shortcut for Claude Code users:** open the clone in [Claude Code](https://claude.com/claude-code)
and run `/setup` - the agent playbook at [`.claude/commands/setup.md`](../../.claude/commands/setup.md)
executes these same stages for you, gates included.

| # | Walkthrough | What you end up with | Cost |
|---|---|---|---|
| 1 | [What is Lyra - the 10-minute tour](./01-what-is-lyra.md) | You understand what it does and how to think about it | $0 |
| 2 | [Run it yourself in 5 minutes](./02-run-it-yourself.md) | The full console on your machine (demo data, no accounts) | $0 |
| 3 | [Go live - your own Supabase + the hourly scanner](./03-go-live-supabase.md) | Real hourly scanning into your own database, sign-in, alerts | $0 |
| 4 | [Put Lyra online - Vercel or Docker/Coolify](./04-deploy-your-own.md) | Your Lyra on the internet with a health-checked deploy | $0 - ~US$6/mo |
| 5 | [Understand the score](./05-understand-the-score.md) | You can read every point of the 0-100 score from the code | $0 |
| 6 | [Get alerts on your phone](./06-alerts-on-your-phone.md) | Urgent pings + hourly summaries via web push and Telegram (WhatsApp honestly scoped) | $0 |

Do them in order - each stage builds on the previous one, and you can stop at any stage with
a working setup.

## Related references

- [`COSTS.md`](../../COSTS.md) - every service in the stack, priced, with free-tier limits.
- [`docs/runbooks/coolify-deploy.md`](../runbooks/coolify-deploy.md) - the full Coolify runbook behind walkthrough 4.
- [`docs/tradingview-copilot.md`](../tradingview-copilot.md) - backtest the exact Lyra score inside TradingView.
- [`SECURITY.md`](../../SECURITY.md) - key-handling rules (never put a secret in a `NEXT_PUBLIC_*` variable).
- [`CLAUDE.md`](../../CLAUDE.md) - repo conventions, including the enforced version-bump flow.

Lyra is research software, not financial advice.
