# SHARE.md - How to share Lyra

Two live links. Send the one that fits who you are talking to. Copy uses plain hyphens,
no em dashes, matching the repo convention.

- **Solo** (no sign-up, all on your phone): https://solo.lyra.vivacityai.com.au
- **Full account** (sync, notifications, AI): https://lyra.vivacityai.com.au

How each side actually gets its numbers is documented, with a file-and-line citation behind
every step, in [`DATA-FLOW.md`](./DATA-FLOW.md).

---

## The two-link message (detailed - the one to send)

> This is Lyra - a research-first scanner that hunts beaten-down tech stocks showing an
> early turn. It looks for names with RSI resetting up out of oversold, a MACD histogram
> that is still negative but curling up, and a price sitting near its recent low. A high
> score means "beaten down and starting to turn", not "breaking out to new highs". It is
> research, not advice.
>
> Two ways to try it:
>
> **1. Solo - https://solo.lyra.vivacityai.com.au**
> Everything stays on your phone. No account, no sign-up, nothing stored on our servers.
> When you open it, Solo pulls a year of live daily price data for a curated set of tech
> names straight from the market and recomputes RSI, MACD and the score right there, so the
> numbers are real and current, not samples. It is the exact same scoring engine the full
> version uses, just run live on the spot for a fixed list. Add your own AI key in Settings
> if you want plain-English explanations. No notifications, no sync, no history.
>
> **2. Full account - https://lyra.vivacityai.com.au**
> Sign up and it gets personal. In the background a scanner sweeps the full universe every
> hour and stores each result, so you build real history: trend over time, whether a setup
> is improving or fading, and follow-ups on how calls actually played out. Each time you
> open it, it re-checks live prices so the score is current, then layers on your own
> portfolio and watchlist, saved to your account and synced across devices. You also get
> notifications (push, Telegram, Slack) and AI personalisation - free for your first 2
> weeks, then bring your own key. Everything except the AI chat keeps working forever
> regardless.

## The short version (one line each)

> Lyra - a scanner for beaten-down tech stocks starting to turn.
> - Try it with no sign-up (all on your phone): https://solo.lyra.vivacityai.com.au
> - Full version with sync, notifications and AI (free AI for 2 weeks): https://lyra.vivacityai.com.au

## What is true on each side (so the copy never oversells)

| | Solo | Full account |
|---|---|---|
| Sign-up | None | Required |
| Data | Live, recomputed on load, curated list | Full universe scanned hourly + stored history + live overlay |
| Portfolio / watchlist | This browser only | Saved + synced across devices |
| Notifications | None | Push, Telegram, Slack |
| AI | Bring-your-own-key | Hosted free 14 days, then bring-your-own-key |
| Upgrade path | One-tap "create a Full account" prompt when it hits a wall | n/a |

Same deterministic scoring engine on both sides - a name scores identically. The account
adds memory, reach and personalisation around it. See [`DATA-FLOW.md`](./DATA-FLOW.md) and
[`HOW-LYRA-WORKS.md`](./HOW-LYRA-WORKS.md) for the full mechanics.
