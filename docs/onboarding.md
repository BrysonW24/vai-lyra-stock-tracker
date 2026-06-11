Below is a **full professional onboarding design** for the stock-market operating system.

The goal is to make the user feel:

```text
“I trust this product.”
“This is serious.”
“This is built for traders/investors.”
“I can start quickly.”
“I can go deeper later.”
“This will help me understand my own behaviour, not just look at charts.”
```

The onboarding should not feel like a boring form.

It should feel like setting up a **personal trading command centre**.

---

# Onboarding Philosophy

The onboarding experience should do four things:

```text
1. Build trust immediately.
2. Capture enough information to personalise the product.
3. Avoid overwhelming the user.
4. Create an instant “wow” moment after setup.
```

The app should not demand that the user perfectly inputs their entire portfolio before seeing value.

Instead, it should support three paths:

```text
Quick Start
“I just want to scan the market.”

Watchlist First
“I want to track companies I’m interested in.”

Portfolio First
“I want to analyse my actual holdings.”
```

This is important because different users arrive with different levels of commitment.

Some will know all their holdings.

Some will just want to track Nvidia, AMD, Tesla, Microsoft, Meta, Apple, Palantir, etc.

Some will want to deeply analyse past trades.

The onboarding should respect all of those users.

---

# Core Onboarding Principle

> **Let the user get value before asking for perfect data.**

That means:

```text
Entering holdings should be optional.
Entering unit count should be optional.
Entering buy price should be optional.
Entering buy date should be optional.
Adding to watchlist should be easy.
Adding to portfolio should be easy.
Enrichment can happen later.
```

The app should say:

```text
“You can start with just ticker symbols. We’ll help you enrich the details later.”
```

This removes friction.

---

# Onboarding Experience Overview

I would build onboarding as a **7-step guided flow**, with optional expansion.

```text
Step 1: Welcome / Value Promise
Step 2: Operator Profile
Step 3: Market Focus
Step 4: Add Watchlist
Step 5: Add Portfolio Holdings
Step 6: Trade History / Buy Snapshot Setup
Step 7: Alert and Dashboard Preferences
Step 8: Generate Command Centre
```

The user can skip most steps.

The onboarding should always have:

```text
Progress indicator
Skip option
Save and continue later
Mobile-friendly layout
Beautiful visual language
Trust/security messaging
```

---

# Visual Direction

The onboarding should look like a premium fintech/trading console.

## Style

```text
Dark glassmorphism
Soft 3D data objects
Floating market cards
Subtle animated chart lines
Transparent panels
Deep navy / black background
Electric blue, green and amber highlights
High-density but calm
```

## Visual objects

Use tasteful SVG / 3D-style objects such as:

```text
Glass candlestick cube
Floating portfolio sphere
3D momentum wave
Layered radar rings
Signal beacon
Ticker constellation
AI analysis prism
Market calendar orb
```

The visual system should make the product feel like:

```text
High trust
Technical
Premium
Financial
Calm
Intelligent
```

Not like a casino.

Not like a crypto pump dashboard.

Not like a generic AI SaaS app.

---

# Suggested Onboarding Layout

Each onboarding screen should use a two-column desktop layout.

```text
┌─────────────────────────────────────────────────────────────┐
│ Logo / Product Name                           Progress 2/8  │
├──────────────────────────────┬──────────────────────────────┤
│ Left: Form / Decision         │ Right: Visual Preview        │
│                              │                              │
│ Primary question              │ Glass chart object           │
│ Short explanation             │ Preview of dashboard output  │
│ Input fields                  │ Trust/security message       │
│ CTA buttons                   │                              │
└──────────────────────────────┴──────────────────────────────┘
```

Mobile should become stacked:

```text
Visual header
Question
Inputs
CTA
Skip
Progress
```

---

# Step 1: Welcome / Value Promise

## Goal

Tell the user what this product does in one clear moment.

## Screen title

```text
Build your personal market command centre.
```

## Subtitle

```text
Track US technology stocks, monitor your portfolio, detect technical momentum, and receive signal-based alerts when something important changes.
```

## Three value cards

```text
Scan the market
We track major US technology stocks using deterministic indicators like RSI, MACD, moving averages and volume.

Understand your holdings
Add your portfolio to see which positions are strengthening, weakening, overextended or approaching risk.

Learn from your trades
Capture entry prices, buy dates and trade snapshots to understand what worked, what failed and why.
```

## CTA options

```text
Start setup
Explore demo first
I only want a watchlist
I want to add my portfolio
```

## Visual

A 3D glass radar object with ticker particles orbiting it.

Example SVG concept:

```tsx
<SignalRadarOrb />
```

Visual idea:

```text
A transparent sphere with glowing ticker dots around it:
NVDA, AMD, MSFT, AAPL, META
A small pulse radiates from the centre.
```

## Trust note

```text
Your data stays private. The system uses your portfolio only to personalise signals, risk states and alerts.
```

---

# Step 2: Operator Profile

## Goal

Understand how the user approaches investing/trading.

This helps configure the dashboard and default alerts.

## Screen title

```text
How do you operate in the market?
```

## Fields

```text
Experience level:
- Beginner
- Intermediate
- Advanced
- Professional / active trader

Style:
- Long-term investor
- Swing trader
- Momentum trader
- Mixed
- Still learning

Primary goal:
- Grow portfolio
- Find better entries
- Manage risk
- Learn technical analysis
- Track AI/tech companies
- Build a disciplined trading system

Preferred timeframe:
- Intraday
- Daily
- Weekly
- Monthly
- Long-term
```

## Optional risk profile

```text
How much risk are you comfortable reviewing?
- Conservative
- Balanced
- Aggressive
- Experimental
```

## Why this matters

The product can tune its language.

For a beginner, show more educational prompts.

For an advanced user, show more dense metrics.

For a swing trader, focus on 1H / 1D signals.

For a long-term investor, focus more on daily / weekly trend and fundamentals.

## Visual

A glass control panel with sliders:

```text
Timeframe
Risk
Signal sensitivity
Education level
```

---

# Step 3: Market Focus

## Goal

Define what the user wants to track.

Default should be US technology stocks.

## Screen title

```text
Choose your market universe.
```

## Default option

```text
US Technology 100
Major US-listed technology and AI-related companies across semiconductors, cloud, software, cybersecurity, platforms and AI infrastructure.
```

## Categories

User can toggle:

```text
Mega-cap platforms
Semiconductors
AI infrastructure
Cloud and enterprise software
Cybersecurity
Data and analytics
Consumer internet
E-commerce
Fintech technology
Robotics / automation
```

## Default selected

```text
All US Technology 100
```

## Optional advanced

```text
Add custom tickers
```

The user can input:

```text
PLTR
TSM
SMCI
SHOP
UBER
SNOW
CRWD
PANW
ARM
```

## Visual

A “ticker constellation” map grouped by sector.

```text
Semiconductors cluster
Cloud cluster
Cybersecurity cluster
Mega-cap cluster
```

Each cluster is represented as a glowing group of ticker chips.

---

# Step 4: Add Watchlist

## Goal

Let the user quickly add companies they care about without needing portfolio data.

## Screen title

```text
Which companies do you want to keep close?
```

## Subtitle

```text
Add companies to your watchlist now. You can set target prices and signal rules later.
```

## Input methods

### Method 1: Search ticker

```text
Search company or ticker...
```

### Method 2: Quick add popular tech names

Ticker chips:

```text
NVDA
AMD
MSFT
AAPL
GOOGL
META
AMZN
TSLA
AVGO
PLTR
CRM
NOW
SNOW
CRWD
PANW
ARM
```

### Method 3: Add by category

```text
Add top semiconductors
Add top AI infrastructure names
Add top cybersecurity names
Add top cloud software names
```

## Watchlist item optional fields

For each added ticker, allow optional expansion:

```text
Target buy price
Target signal score
Notes
Alert me when score reaches
Alert me when price reaches
```

But keep it optional.

The simple path should be:

```text
Add ticker → done.
```

## UX pattern

Ticker cards:

```text
┌─────────────────────────────┐
│ NVDA                        │
│ Nvidia                      │
│ Category: Semiconductor     │
│ [Add to Watchlist]          │
└─────────────────────────────┘
```

After adding:

```text
✓ Added to Watchlist
```

## Visual

Floating glass ticker cards moving into a “Watchlist Vault”.

---

# Step 5: Add Portfolio Holdings

## Goal

Allow users to enter their holdings without friction.

This is where personalisation becomes powerful.

## Screen title

```text
Add your current holdings.
```

## Subtitle

```text
Start with ticker symbols only, or add full position details for portfolio tracking, performance analysis and trade snapshots.
```

## Three modes

```text
Quick Add
Enter tickers only.

Position Add
Enter ticker, quantity and average buy price.

Full Trade Snapshot
Enter ticker, quantity, buy price, buy date and notes.
```

## UX

Use a table-like input, not individual forms.

Desktop:

```text
Ticker | Quantity | Avg Buy Price | Buy Date | Notes | Add
NVDA   | 10       | 820.00        | 2024-05-12 | AI infrastructure thesis
AMD    | 25       | 155.20        | 2024-06-18 | momentum recovery
```

Mobile:

One card per holding:

```text
Ticker
Quantity
Average buy price
Buy date
Notes
```

## Optional fields

```text
Ticker: required
Quantity: optional
Average buy price: optional
Buy date: optional
Brokerage fee: optional
Notes: optional
```

## If the user only adds ticker

Store it as:

```text
Portfolio holding: incomplete
Needs enrichment: true
```

Then later prompt:

```text
You added NVDA. Add quantity and average price to unlock P/L tracking.
```

## Skip option

```text
Skip for now — I’ll add holdings later.
```

## Visual

A glass portfolio stack with glowing ticker tiles.

---

# Step 6: Buy-Date Snapshot / Trade Memory

This is one of the most interesting parts of the product.

## Goal

Let the user understand their past decisions.

When the user enters a buy date, the system should create a **Trade Day Snapshot**.

## Screen title

```text
Create trade snapshots from your buy dates.
```

## Subtitle

```text
When you add a buy date, we can reconstruct what the market looked like when you entered the position — price, momentum, volume, technical setup, news and future performance.
```

## Explain the value

```text
This helps you learn whether your best trades came from strong momentum, good timing, earnings catalysts, valuation resets, AI hype cycles, or broader market strength.
```

## What the snapshot captures

For each holding with a buy date, capture:

```text
Buy price
Closing price that day
RSI on buy date
MACD state on buy date
Volume ratio on buy date
Price vs 20MA / 50MA / 200MA
Distance from recent low/high
Signal score on buy date
Market regime
Sector trend
Relevant news around that date
Earnings events nearby
Future return after 5D / 20D / 60D / 120D
Max drawdown after entry
Max upside after entry
```

## Snapshot name

Use a strong product term:

```text
Trade Day Snapshot
```

Alternative names:

```text
Entry Snapshot
Market Memory
Decision Snapshot
Trade Context
Entry Context Report
```

Best name:

> **Trade Day Snapshot**

It is clear and premium.

## UX

After entering holdings:

```text
We found 3 holdings with buy dates.

Create Trade Day Snapshots?
[Create snapshots] [Skip for now]
```

## Example result

```text
NVDA Trade Day Snapshot
Bought: 12 May 2024
Entry price: $820
RSI: 58
MACD: bullish
Volume: 1.4x average
Price vs 50MA: +8.2%
Nearby event: AI infrastructure demand headlines
Future 60D return: +18.4%
Max drawdown after entry: -4.8%

Learning note:
This was a momentum continuation trade supported by strong volume and sector narrative.
```

This is extremely powerful for education.

It turns the user’s own history into lessons.

---

# Step 7: Trading Goals and Capital Context

## Goal

Understand what the user wants to achieve without making financial promises.

## Screen title

```text
Set your operating context.
```

## Fields

```text
Approximate capital available to deploy:
- Optional amount

Monthly contribution:
- Optional amount

Preferred max position size:
- 5%
- 10%
- 15%
- 20%
- Custom

Main goal:
- Build long-term portfolio
- Find swing trades
- Improve entries
- Reduce bad trades
- Learn technical/fundamental analysis
- Track AI/tech market momentum
```

## Avoid dangerous language

Do not ask:

```text
How much money do you want to make?
```

Better:

```text
What outcome are you trying to model?
```

Options:

```text
Portfolio growth
Income from trading
Capital preservation
Learning and discipline
High-growth tech exposure
```

## Simulation setup

Ask:

```text
Would you like to enable portfolio simulations?
```

If yes:

```text
Default trade amount
Target return scenario
Stop loss scenario
Holding period
```

Example:

```text
Default simulation:
Trade amount: $2,000
Base case: +8%
Bear case: -5%
Bull case: +15%
```

---

# Step 8: Alerts and Notifications

## Goal

Configure alert noise carefully.

## Screen title

```text
Choose how you want to be alerted.
```

## Channels

```text
In-app
Telegram
Email later
Push later
```

## Alert options

Default:

```text
Strong setup alerts: On
Portfolio risk alerts: On
Watchlist trigger alerts: On
Signal invalidation alerts: On
Daily digest: On
Hourly digest: Off
News/hype alerts: Off until Horizon 2
```

## Alert philosophy message

```text
We only alert you when something meaningful changes — not every time a stock moves.
```

## Telegram setup

If Telegram enabled:

```text
Connect Telegram Bot
Send test alert
```

Test message:

```text
Test alert: Your Stock Momentum Radar is connected.
```

## Visual

A glass notification beacon with signal waves.

---

# Step 9: Generate Command Centre

## Goal

Create the wow moment.

After onboarding, the app should generate a personalised dashboard.

## Screen title

```text
Your command centre is ready.
```

## Summary cards

```text
Market universe:
US Technology 100

Watchlist:
12 companies

Portfolio:
8 holdings added
5 enriched with quantities
3 need more details

Trade snapshots:
4 available

Alerts:
Strong setups, portfolio risk and watchlist triggers enabled
```

## CTA

```text
Open Command Centre
```

## Immediate value

The first dashboard should show:

```text
Your strongest watchlist setup
Your highest-risk holding
Your best-performing holding
Your worst-performing holding
Your portfolio exposure by category
Your first trade snapshot available
```

This creates instant emotional payoff.

---

# Post-Onboarding: Progressive Enrichment

Onboarding should continue subtly after signup.

## Example prompts

```text
Add quantity to NVDA to unlock P/L tracking.
Add buy date to AMD to create a Trade Day Snapshot.
Set a target price for SNOW.
Add your cash balance to enable simulations.
Connect Telegram to receive alerts.
```

But these should appear as small cards, not annoying modals.

Use a “Setup Completeness” widget:

```text
Command Centre Setup: 62%
✓ Watchlist added
✓ Portfolio tickers added
○ Quantities missing
○ Buy dates missing
○ Telegram not connected
○ Cash balance not set
```

---

# Professional Onboarding Flow in Detail

## Screen 1: Welcome

```text
Title:
Your market command centre starts here.

Subtitle:
Track US technology stocks, monitor your holdings, detect technical momentum and receive meaningful alerts when something changes.

Primary CTA:
Start setup

Secondary CTA:
Explore demo
```

Visual:

```text
3D glass radar with ticker dots.
```

---

## Screen 2: Choose setup path

```text
Title:
How would you like to begin?

Cards:
1. Scan the market
Start with the US Technology 100 and explore signals immediately.

2. Build a watchlist
Track companies you care about and receive setup alerts.

3. Add your portfolio
Analyse your current holdings, P/L, risk and trade history.

4. Full setup
Add watchlist, portfolio, goals and alerts now.
```

Recommended default:

```text
Full setup
```

But don’t force it.

---

## Screen 3: Operator profile

Fields:

```text
Experience level
Trading/investing style
Preferred timeframe
Risk comfort
Main goal
```

Output:

```text
Dashboard density level
Education prompts on/off
Default timeframe
Alert sensitivity
```

---

## Screen 4: Market universe

Fields:

```text
US Technology 100 selected
Category filters
Custom ticker add
```

Output:

```text
Active scan universe
```

---

## Screen 5: Watchlist

Fields:

```text
Add ticker
Add by category
Optional target price
Optional target signal score
```

Output:

```text
watchlist_items
```

---

## Screen 6: Portfolio

Fields:

```text
Ticker
Quantity optional
Avg buy price optional
Buy date optional
Notes optional
```

Output:

```text
portfolio_positions
```

---

## Screen 7: Trade snapshots

Fields:

```text
Create snapshots for holdings with buy dates?
```

Output:

```text
trade_day_snapshots queued
```

---

## Screen 8: Capital context

Fields:

```text
Cash available optional
Default trade size optional
Max position size optional
Monthly contribution optional
Simulation preferences optional
```

Output:

```text
operator_preferences
simulation_defaults
```

---

## Screen 9: Alerts

Fields:

```text
Alert types
Telegram connection
Daily digest preference
```

Output:

```text
alert_preferences
notification_channels
```

---

## Screen 10: Ready state

Show:

```text
Setup summary
Data captured
What unlocks next
Open dashboard
```

---

# Data Model for Onboarding

You need these tables or fields.

## `operator_profiles`

```sql
id
user_id
experience_level
investing_style
preferred_timeframe
risk_comfort
primary_goal
dashboard_density
education_enabled
created_at
updated_at
```

## `operator_preferences`

```sql
id
user_id
default_timeframe
default_trade_amount
cash_available
max_position_size_pct
monthly_contribution
simulation_enabled
created_at
updated_at
```

## `portfolio_positions`

```sql
id
user_id
symbol
quantity
average_buy_price
brokerage_fee
purchase_date
notes
is_enriched
needs_snapshot
is_active
created_at
updated_at
```

## `watchlist_items`

```sql
id
user_id
symbol
target_price
target_signal_score
notes
alert_enabled
is_active
created_at
updated_at
```

## `trade_day_snapshots`

```sql
id
user_id
position_id
symbol
purchase_date
entry_price
rsi_on_entry
macd_state_on_entry
macd_histogram_on_entry
volume_ratio_on_entry
price_vs_sma_20_on_entry
price_vs_sma_50_on_entry
price_vs_sma_200_on_entry
signal_score_on_entry
market_regime_on_entry
sector_state_on_entry
news_context
event_context
return_5d
return_20d
return_60d
return_120d
max_drawdown_after_entry
max_upside_after_entry
learning_summary
created_at
updated_at
```

## `onboarding_progress`

```sql
id
user_id
welcome_completed
profile_completed
market_universe_completed
watchlist_completed
portfolio_completed
snapshots_completed
capital_context_completed
alerts_completed
onboarding_completed
completion_pct
created_at
updated_at
```

---

# Trade Day Snapshot Engine

This should be a backend job.

When user adds a holding with a buy date:

```text
1. Find historical candle data around buy date.
2. Calculate technical indicators on that date.
3. Check signal score on that date.
4. Pull nearby news/events if available.
5. Calculate future returns from buy date.
6. Calculate drawdown/upside after entry.
7. Generate structured learning summary.
8. Save snapshot.
```

## Snapshot window

Use:

```text
Entry date
Previous 20 trading days
Next 120 trading days
Nearby news ±7 days
Nearby earnings ±14 days
```

## Snapshot output

```json
{
  "trade_type": "momentum_continuation",
  "entry_quality": "strong",
  "technical_context": {
    "rsi": 58.2,
    "macd_state": "bullish",
    "volume_ratio": 1.4,
    "price_vs_sma_50": 8.2
  },
  "future_performance": {
    "return_20d": 7.4,
    "return_60d": 18.4,
    "max_drawdown": -4.8
  },
  "learning_summary": [
    "Entry was supported by momentum and volume.",
    "Stock was not near a technical bottom; it was a continuation setup.",
    "The strongest confirmation was volume expansion."
  ]
}
```

---

# Onboarding Frontend Components

Build reusable components:

```text
OnboardingShell
OnboardingProgress
WelcomeHero
SetupPathCards
OperatorProfileForm
MarketUniverseSelector
TickerSearchInput
TickerChipCloud
WatchlistBuilder
PortfolioBuilderTable
PortfolioHoldingCard
TradeSnapshotExplainer
CapitalContextForm
AlertPreferencePanel
TelegramConnectCard
SetupSummaryCard
GlassRadarOrb
GlassPortfolioStack
TickerConstellation
SignalBeacon
```

---

# Suggested SVG / Visual Assets

## 1. Glass Radar Orb

Purpose:

```text
Welcome screen / Command centre generation.
```

Visual:

```text
Transparent circular radar
Glowing sweep line
Ticker dots orbiting
Small pulse waves
```

Use for:

```text
“Scanning the market”
```

---

## 2. Ticker Constellation

Purpose:

```text
Market universe selection.
```

Visual:

```text
Clusters of ticker chips connected by thin glowing lines.
```

Groups:

```text
Semiconductors
Cloud
AI infrastructure
Cybersecurity
Mega-cap
```

---

## 3. Glass Portfolio Stack

Purpose:

```text
Portfolio input.
```

Visual:

```text
Layered transparent cards stacked vertically, each with ticker, position size and signal status.
```

---

## 4. Trade Snapshot Lens

Purpose:

```text
Buy-date snapshot.
```

Visual:

```text
A magnifying glass over a historical candlestick chart, with RSI and MACD mini-lines beneath.
```

---

## 5. Signal Beacon

Purpose:

```text
Alerts setup.
```

Visual:

```text
Small glowing signal tower sending waves to Telegram icon / mobile device.
```

---

## 6. Simulation Prism

Purpose:

```text
Capital context and simulations.
```

Visual:

```text
A 3D prism splitting one trade into bull, base and bear scenario paths.
```

---

# Onboarding Copy Tone

Tone should be:

```text
Professional
Confident
Clear
Premium
Not hypey
Not childish
Not overpromising
```

Avoid:

```text
Beat the market
Get rich
Guaranteed signals
AI predicts winners
```

Use:

```text
Review opportunities
Understand risk
Track momentum
Improve decision quality
Build discipline
Learn from your history
```

---

# Example Full Onboarding Copy

## Welcome

```text
Build your personal market command centre.

Track major US technology companies, monitor your holdings, detect momentum shifts and receive alerts when something meaningful changes.

This system combines technical indicators, portfolio context, watchlists and trade snapshots to help you make more disciplined market decisions.
```

## Portfolio setup

```text
Add your holdings to personalise the console.

You can start with ticker symbols only, or add quantity, average buy price and purchase date to unlock portfolio performance, P/L tracking and Trade Day Snapshots.
```

## Trade snapshot

```text
Learn from the day you entered.

A Trade Day Snapshot reconstructs the market context around your buy date — including RSI, MACD, volume, moving averages, nearby news, earnings events and future performance after entry.
```

## Alerts

```text
Receive alerts only when something meaningful changes.

We avoid noisy notifications. You can be alerted when a strong setup appears, a watchlist item triggers, a portfolio holding weakens or a signal becomes invalidated.
```

## Ready

```text
Your command centre is ready.

We’ll start scanning your selected universe, tracking your watchlist, monitoring your portfolio and building market context around your decisions.
```

---

# Onboarding UX Rules

## Rule 1: Never block value

The user can skip any deep input.

## Rule 2: Allow partial holdings

Ticker-only portfolio entries are valid.

## Rule 3: Show what gets unlocked

When asking for data, explain the benefit.

Example:

```text
Add buy date → unlock Trade Day Snapshot.
Add quantity → unlock P/L tracking.
Add average price → unlock performance analysis.
Add cash balance → unlock simulations.
```

## Rule 4: Keep the onboarding beautiful but fast

No step should feel like admin.

## Rule 5: Use progressive enrichment after onboarding

Do not force the user to finish everything upfront.

---

# What Happens After Onboarding

The first dashboard should immediately show:

```text
Welcome back, Bryson.
Your US Tech 100 scanner is active.

Portfolio:
8 holdings added
5 fully enriched
3 need price/quantity details

Watchlist:
12 companies tracked
2 approaching technical setup

Signals:
3 strong setups
7 watchlist setups
1 portfolio risk

Snapshots:
4 trade snapshots available
```

Then show cards:

```text
Best current setup
Highest portfolio risk
Best historical trade
Worst historical trade
Most interesting watchlist trigger
```

---

# Best Trade / Worst Trade Analysis

Once the user enters historical buy data, show:

## Best trade card

```text
Best trade: NVDA
Return: +42.8%
Entry date: 12 May 2024

Entry context:
RSI: 58
MACD: bullish
Volume: 1.4x average
Price vs 50MA: +8.2%

Why it worked:
Momentum was already strong, volume confirmed the move, and the AI infrastructure narrative was accelerating.

Lesson:
This was a continuation trade, not a bottom-fishing trade. The signal strength came from volume and trend confirmation.
```

## Worst trade card

```text
Worst trade: SNOW
Return: -18.4%
Entry date: 4 March 2024

Entry context:
RSI: 71
MACD histogram flattening
Price vs 50MA: +19.6%
Volume declining
Earnings risk: elevated

Why it struggled:
The stock was technically overextended at entry, momentum was slowing and price was far above its moving average.

Lesson:
Avoid adding when price is extended and momentum is flattening unless there is a clear continuation catalyst.
```

This is incredibly useful.

It teaches from the user’s own behaviour.

---

# Final Onboarding Experience Summary

The onboarding should feel like this:

```text
Welcome to your market command centre.
Choose how you operate.
Select your market universe.
Add your watchlist.
Add your holdings.
Optionally enrich with quantity, price and buy date.
Create Trade Day Snapshots.
Set capital context.
Configure meaningful alerts.
Generate your personalised dashboard.
```

The deeper purpose:

> **The onboarding should not just collect data. It should begin the process of turning the user’s portfolio, watchlist and trade history into an intelligent market operating system.**

The experience should be:

```text
Professional enough to trust
Beautiful enough to enjoy
Simple enough to complete
Flexible enough to skip
Deep enough to become powerful over time
```

The first-time user should leave onboarding thinking:

```text
“This isn’t just another stock tracker. This is going to help me understand my decisions.”
```
