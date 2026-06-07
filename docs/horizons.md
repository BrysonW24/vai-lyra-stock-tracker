Yes - this is the right way to think about it.

The roadmap should be structured in **horizons**, where each horizon adds a new layer of intelligence without breaking the core principle:

> **The product starts as a deterministic technical-analysis console, then expands into market intelligence, AI-assisted interpretation, education, simulation, and eventually automated trading.**

The big thing is not to jump too quickly into “AI trading bot” territory. The strongest product path is:

```text
Horizon 1: Technical signal console
Horizon 2: News, events, company intelligence
Horizon 3: AI tools, education, simulations, strategy assistant
Horizon 4: Semi-autonomous or autonomous trading decision layer
```

---

# Product Roadmap: Stock Momentum Radar

## Product North Star

Build a beautiful, mobile-optimised, data-dense trading console that helps a trader understand what is happening across major US technology stocks using deterministic indicators, visual analysis, portfolio context, watchlist tracking, education, and eventually AI-assisted trading workflows.

The product should begin with technical analysis, then expand into fundamentals, news, sentiment, education, simulation, and ultimately decision automation.

The goal is not just to show stock prices.

The goal is to help the user understand:

```text
What is moving?
Why is it moving?
Is momentum improving or weakening?
Is valuation stretched or reasonable?
Is there news or hype behind the move?
How does this relate to my portfolio?
What should I learn to understand this better?
What could happen if I make a trade?
```

---

# Horizon 1 - Technical Analysis Console

## Goal

Create the strongest possible first version of the product: a deterministic, mathematical, chart-heavy, mobile-optimised stock analysis console.

This horizon is about getting the foundation right.

The app should already be useful before adding news, AI, hype, or automation.

The core promise:

> **Show me which tech stocks are technically interesting right now, and help me visually understand why.**

---

## Horizon 1 product scope

### 1. First 100 US technology stocks

Start with the initial universe of major US/Nasdaq technology companies.

The backend should scan these on a schedule and calculate:

```text
RSI
MACD
MACD histogram
MACD histogram slope
Moving averages
Volume ratio
Distance from recent lows
Signal score
Signal score delta
Signal status
Action state
```

The frontend should render these in a dense, beautiful interface.

---

### 2. Signal Radar

This is the main scanner table.

The user should be able to sort and filter by:

```text
Highest signal score
Biggest score improvement
Biggest score decline
RSI below 50
MACD histogram rising
Near recent low
Above/below moving averages
High volume ratio
Portfolio holdings only
Watchlist only
```

The key idea is:

> **The user should never need to manually inspect 100 charts to know where to look first.**

---

### 3. Ticker detail page

Each stock needs a beautiful, interactive detail page.

This should include:

```text
Price chart
Volume chart
RSI chart
MACD chart
Signal score history
Moving average overlays
Buy-review / watch / invalidation markers
Score component breakdown
Portfolio/watchlist context
```

The user should be able to visually understand the full story of a stock.

Not just:

```text
AMD score is 82.
```

But:

```text
AMD’s RSI recovered from 38 to 45, MACD histogram is improving, price is near a 60-period low, and volume has started to lift.
```

---

### 4. Interactive comparison charts

This is a big Horizon 1 enhancement.

Allow the user to checkbox multiple stocks and compare them.

Example:

```text
NVDA
AMD
AVGO
TSM
ARM
```

Then show:

```text
Relative price performance
Relative signal score
Relative RSI
Relative MACD histogram
Relative volume ratio
```

This is where the product becomes genuinely useful.

The user should be able to ask visually:

```text
Which semiconductor stock has recovered fastest?
Which one is still lagging?
Which one has the strongest momentum recovery?
Which one is technically overextended?
```

Comparison modes:

```text
Price growth from selected start date
Signal score trend
RSI trend
MACD histogram trend
Volume ratio trend
Normalised return %
```

This is very important for Horizon 1.

---

### 5. Portfolio input

The user should be able to enter:

```text
Ticker
Quantity
Average buy price
Purchase date
Brokerage/fees
Notes
```

The app then calculates:

```text
Market value
Unrealised profit/loss
Portfolio weight
Signal status
Risk status
Action state
```

The console should help answer:

```text
What do I own?
What is gaining?
What is weakening?
What should I not add to?
What should I review adding to?
What is becoming risky?
```

---

### 6. Watchlist

The user should be able to create a watchlist.

For each watchlist item:

```text
Ticker
Target price
Target signal score
RSI threshold
MACD condition
Notes
Alert enabled
```

The watchlist should show:

```text
Approaching trigger
Triggered
Not ready
Invalidated
```

---

### 7. Mobile optimisation

Mobile is not optional.

Horizon 1 must be mobile-friendly from the beginning.

Mobile should prioritise:

```text
Quick signal check
Strong setups
Portfolio risk
Watchlist triggers
Recent alerts
Ticker detail summary
```

Desktop can be dense and table-heavy.

Mobile should be dense but not overwhelming.

Mobile layout:

```text
Command
Radar
Portfolio
Watchlist
Alerts
```

Each ticker row should look like:

```text
AMD   82 +9   Buy Review
$174.22 | RSI 45↑ | MACD Hist -0.31↑ | Vol 1.12x
```

---

## Horizon 1 backend requirements

The backend must provide deterministic truth.

It should include:

```text
Ticker universe service
Market data ingestion
Indicator calculation
Derived feature calculation
Signal scoring
Signal lifecycle tracking
Portfolio overlay
Watchlist overlay
Alert preparation
Job run logging
```

Every score must be explainable.

Store:

```text
Raw candles
Indicators
Derived features
Score components
Final signal
Signal status
Lifecycle state
Alert state
```

This makes the product auditable and trustworthy.

---

## Horizon 1 frontend requirements

The frontend should include:

```text
Command Centre
Signal Radar
Portfolio
Watchlist
Ticker Detail
Comparison Lab
Alerts
Settings
```

The interface should be:

```text
Dense
Chart-heavy
Mobile-optimised
Fast
Beautiful
Low-slop
Numbers-first
```

A major Horizon 1 success criterion is:

> **The app should already feel valuable even if no AI, news, or trading bot exists yet.**

---

# Horizon 2 - News, Events, Fundamentals and Market Intelligence

## Goal

Add context around the technical signal.

Technical indicators tell us what the stock is doing.

News, fundamentals, and events help explain why it might be happening.

The core promise:

> **Show me whether the technical signal is supported or contradicted by real-world market context.**

---

## Horizon 2 product scope

### 1. News integration

Add news APIs and company-specific news feeds.

For each ticker, the system should pull:

```text
Recent headlines
Source
Timestamp
Ticker relevance
Sentiment
News category
Market impact estimate
```

News categories:

```text
Earnings
Product launch
AI announcement
Analyst upgrade/downgrade
Partnership
Regulatory
Macro
Litigation
Management change
Guidance
M&A
```

The frontend should show a compact news panel, not a giant article feed.

Example:

```text
NVDA | AI infrastructure partnership | Positive | High relevance | 2h ago
AMD | Analyst downgrade | Negative | Medium relevance | 5h ago
MSFT | Azure AI expansion | Positive | High relevance | 1d ago
```

---

### 2. Hype meter

Introduce a ticker-level hype score.

The hype meter could track:

```text
Headline frequency
Mention acceleration
Positive/negative sentiment
X/social mentions later
Search interest later
Volume confirmation
Price confirmation
```

Important:

The hype meter should not become the trading signal.

It should sit beside technical score.

Example:

```text
Technical Score: 82
Hype Score: 71
News Sentiment: Positive
Volume Confirmation: Yes
Event Risk: Medium
```

This creates a richer picture.

---

### 3. Fundamentals layer

Add fundamental metrics to help users understand whether price action is supported by business quality.

Metrics could include:

```text
Revenue
Revenue growth
Gross margin
Operating margin
Net income
Free cash flow
EBITDA
Market cap
Enterprise value
EV / EBITDA
Price / sales
Price / earnings
Revenue to valuation ratio
Debt
Cash
Guidance
```

This is where the product starts becoming educational and investment-grade.

The app should help users understand:

```text
Is this company growing?
Is it profitable?
Is it expensive?
Is the valuation justified by revenue growth?
Is EBITDA improving?
Is revenue growth slowing?
```

---

### 4. Company event calendar

Add a calendar for:

```text
Earnings dates
Investor days
Product launches
AI conferences
Macro events
CPI
Fed meetings
Jobs data
Options expiry
```

This matters because:

```text
A strong technical signal before earnings has different risk than a strong technical signal after earnings.
```

Ticker detail should show:

```text
Upcoming earnings in 4 days
Recent product event 2 days ago
Macro event tomorrow
```

---

## Horizon 2 backend requirements

Add services for:

```text
News ingestion
Fundamentals ingestion
Calendar events
Sentiment scoring
Ticker-event mapping
Hype score calculation
Relevance scoring
```

Store:

```text
news_items
ticker_news_map
fundamental_snapshots
company_events
market_calendar_events
hype_scores
sentiment_scores
```

---

## Horizon 2 frontend requirements

Add:

```text
News panel
Ticker intelligence feed
Hype meter
Fundamentals tab
Calendar page
Event risk badges
Technical + news combined view
```

The frontend should still stay dense.

No long article summaries unless expanded.

Default view should be:

```text
Ticker | Event | Sentiment | Relevance | Time | Impact
```

---

# Horizon 3 - AI Tools, Education Hub and Strategy Assistant

## Goal

Add AI assistance in a controlled way.

AI should not replace the deterministic signal engine.

AI should help the user understand, learn, simulate, and compare.

The core promise:

> **Help the user become a better trader by explaining the metrics, suggesting what to inspect, and teaching how to interpret the console.**

---

## Horizon 3 product scope

### 1. Education Hub

This is a very strong idea.

The product should teach users how to read a stock.

Not in a generic course format only.

It should teach inside the context of the actual dashboard.

The education hub should include modules like:

```text
What is RSI?
What is MACD?
What does MACD histogram mean?
What are moving averages?
What is volume confirmation?
What is support and resistance?
What is EBITDA?
What is revenue growth?
What is EV / EBITDA?
What is price-to-sales?
What is market cap?
What is free cash flow?
What is valuation?
What is overextension?
What is momentum recovery?
```

Each lesson should connect to live examples.

Example:

```text
Lesson: MACD Histogram Recovery
Live example: AMD currently has a negative but rising MACD histogram.
Open AMD chart to see this pattern.
```

That is powerful.

---

### 2. Metric recommendation engine

The app should recommend what the user should inspect next.

Example:

```text
AMD has a strong technical setup.
Recommended next checks:
1. MACD histogram recovery
2. RSI reclaim above 50
3. Volume confirmation
4. Upcoming earnings date
5. Revenue growth trend
```

For an overextended stock:

```text
NVDA is technically overextended.
Recommended next checks:
1. RSI above 70
2. Price distance from 50MA
3. MACD histogram flattening
4. Recent hype/news acceleration
5. Portfolio exposure
```

This becomes a guided learning and decision system.

---

### 3. AI explanation panels

AI can explain:

```text
Why did this signal trigger?
What should I inspect next?
What does this indicator combination mean?
What risks are present?
What would invalidate this setup?
```

But the answer should be structured.

No waffle.

Format:

```text
Signal
Evidence
What it means
What to inspect next
Risk
Invalidation conditions
```

---

### 4. Strategy Builder

Allow the user to build or select strategies.

Examples:

```text
Momentum Recovery
Oversold Bounce
Trend Continuation
Breakout Watch
Overextended Risk
Earnings Caution
High Hype / Low Technical Confirmation
```

The user should be able to configure:

```text
RSI range
MACD condition
Volume condition
Moving average condition
Price distance from low
Required news sentiment
Required hype score
Max event risk
```

Then the backend can scan for those strategies.

---

### 5. Simulation Lab

Add a strong simulation layer.

Inputs:

```text
Starting capital
Trade amount
Number of trades
Expected return
Expected loss
Win rate
Holding period
Monthly target
Stop loss
Take profit
```

Outputs:

```text
Projected balance
Potential profit
Potential loss
Required win rate
Portfolio impact
Compounding path
Scenario comparison
```

This would be extremely useful.

---

## Horizon 3 backend requirements

Add:

```text
AI explanation service
Education content store
Metric recommendation engine
Strategy builder engine
Simulation engine
Scenario engine
Trade journal support
```

Store:

```text
education_modules
metric_recommendations
user_strategies
strategy_rules
simulation_runs
trade_journal_entries
ai_explanations
```

---

## Horizon 3 frontend requirements

Add:

```text
Education Hub
Strategy Builder
Simulation Lab
AI Explain drawer
Metric recommendation panel
Trade Journal
Learning cards inside ticker detail
```

The UI should keep AI contained.

AI should appear as:

```text
Small explain buttons
Structured drawers
Contextual education cards
Metric suggestions
Scenario outputs
```

Not as a giant chatbot taking over the screen.

---

# Horizon 4 - Trading Bot / Decision Automation Layer

## Goal

Connect the current analysis system to the previous trading bot project and allow semi-automated or automated trading workflows.

This should only happen after the signal engine, risk engine, and simulation engine are mature.

The core promise:

> **Move from insight to controlled execution.**

---

## Horizon 4 product scope

### 1. Semi-automated trading assistant

Before full automation, build review-based trading.

Example:

```text
System detects AMD Buy Review.
System proposes:
- Buy amount: $2,000
- Stop loss: -5%
- Take profit: +12%
- Risk: 1.5% of portfolio
- Reason: momentum recovery + volume confirmation
User approves or rejects.
```

This is safer than fully automated trading.

---

### 2. Broker integration

Eventually integrate with broker APIs.

Capabilities:

```text
Read portfolio
Read cash balance
Place order
Cancel order
Track order status
Sync trade history
```

This should be treated carefully.

---

### 3. Trading policy engine

The bot should only act within strict rules.

Examples:

```text
Max position size
Max daily trades
Max portfolio exposure by sector
No trade before earnings
No trade if event risk high
No trade if signal confidence below threshold
No trade if spread too wide
No trade if market regime is negative
```

---

### 4. Backtesting and paper trading

Before real execution:

```text
Backtest strategy
Run paper trading
Compare signal predictions to outcomes
Track false positives
Track drawdowns
Track win rate
Track average return
```

This is essential.

---

### 5. Autonomous execution

Only after strong validation:

```text
Fully automated trade execution
Risk-controlled
Position-sized
Logged
Auditable
User-configurable
Emergency kill switch
```

This should be Horizon 4, not Horizon 1.

---

## Horizon 4 backend requirements

Add:

```text
Broker connector
Order management system
Risk engine
Position sizing engine
Execution policy engine
Paper trading engine
Backtesting engine
Trade audit log
Kill switch
```

Store:

```text
orders
executions
paper_trades
broker_positions
risk_limits
trade_policies
strategy_performance
```

---

## Horizon 4 frontend requirements

Add:

```text
Trade Review page
Paper Trading dashboard
Execution console
Risk settings
Broker connection page
Strategy performance page
Trade audit logs
Emergency stop control
```

---

# Recommended Horizon Roadmap

## Horizon 1 - Technical Console

Theme:

```text
Mathematics, charts, signals, portfolio, watchlist, mobile.
```

Build:

```text
Technical scanner
Signal radar
Ticker detail charts
Portfolio input
Watchlist input
Interactive comparison charts
Telegram alerts
Mobile-optimised UI
```

Success metric:

```text
The user can open the app and immediately know which tech stocks deserve review.
```

---

## Horizon 2 - Market Context

Theme:

```text
News, events, fundamentals, hype.
```

Build:

```text
News feed
Ticker event feed
Fundamental metrics
Hype meter
Calendar
Event risk
Company intelligence layer
```

Success metric:

```text
The user can understand whether a technical signal has real-world support or risk.
```

---

## Horizon 3 - AI and Education

Theme:

```text
Teach, explain, simulate, guide.
```

Build:

```text
Education hub
AI explanation drawer
Metric recommendation engine
Strategy builder
Simulation lab
Trade journal
Contextual learning cards
```

Success metric:

```text
The user becomes better at reading stocks while using the product.
```

---

## Horizon 4 - Trading Automation

Theme:

```text
From review to execution.
```

Build:

```text
Paper trading
Backtesting
Broker integration
Trade recommendation engine
Risk policy engine
Semi-automated execution
Fully automated execution later
```

Success metric:

```text
The system can safely move from signal generation to controlled trade execution.
```

---

# Horizon 1 detailed delivery plan

Since this is the immediate priority, I’d break Horizon 1 into 4 releases.

---

## Horizon 1A - Live Technical Scanner

Goal:

```text
Get the scanner live and useful.
```

Build:

```text
First 100 tech stock universe
Hourly backend worker
RSI/MACD/moving average calculations
Signal score
Signal radar table
Telegram strong alerts
Supabase persistence
Frontend demo fallback
```

Done when:

```text
The app scans real stocks, stores real signals, and shows them in the UI.
```

---

## Horizon 1B - Dense Charting and Ticker Detail

Goal:

```text
Make the app visually useful.
```

Build:

```text
Candlestick chart
RSI panel
MACD panel
Volume panel
Signal score history
Moving average overlays
Signal markers
Ticker detail page upgrades
```

Done when:

```text
The user can open a ticker and visually understand the setup in under 30 seconds.
```

---

## Horizon 1C - Portfolio and Watchlist

Goal:

```text
Make the app personal.
```

Build:

```text
Manual portfolio input
Watchlist input
Portfolio overlay
Watchlist overlay
Portfolio risk state
Watchlist trigger state
Custom alert thresholds
```

Done when:

```text
The app tells the user what matters specifically to their money and watchlist.
```

---

## Horizon 1D - Interactive Comparison Lab

Goal:

```text
Make the app exploratory and powerful.
```

Build:

```text
Checkbox multi-stock comparison
Normalised growth chart
Relative RSI chart
Relative MACD histogram chart
Relative signal score chart
Category filters
Semiconductor/software/cyber comparison
```

Done when:

```text
The user can compare multiple stocks interactively and identify relative strength/weakness.
```

---

# Important product rules

## Rule 1: Do not let AI replace the deterministic engine

AI can explain.

AI can educate.

AI can summarise.

AI can recommend what to inspect.

But the signal truth must come from the backend mathematics.

---

## Rule 2: Avoid AI slop

No generic filler like:

```text
“This stock may be worth monitoring due to market conditions.”
```

Instead:

```text
“RSI rose from 39 to 45, MACD histogram improved for 3 periods, and price is 5.1% above the 60-period low.”
```

---

## Rule 3: Build for actionability

Every screen should help the user do one of these:

```text
Review a buy opportunity
Avoid a bad entry
Monitor a holding
Compare alternatives
Understand a signal
Plan a trade
Learn a metric
Reduce risk
```

---

## Rule 4: Mobile is a first-class experience

The mobile app should not be an afterthought.

Mobile should be optimised for:

```text
Signal alerts
Quick review
Portfolio risk
Watchlist triggers
Ticker snapshots
```

Desktop should be optimised for:

```text
Dense analysis
Multi-chart comparisons
Portfolio modelling
Simulation
Deep ticker review
```

---

## Rule 5: The app should teach while being used

Education should not be separate from the workflow only.

If the user is looking at RSI, they should be able to tap:

```text
What does this mean?
```

If they see EV / EBITDA, they should be able to tap:

```text
Explain this metric.
```

If a strategy triggers, they should be able to see:

```text
Why this strategy cares about these metrics.
```

This makes the tool compound the user’s knowledge.

---

# Final roadmap summary

```text
Horizon 1:
Build the best technical-analysis console possible.
Dense charts, signal radar, portfolio, watchlist, comparison charts, mobile optimisation.

Horizon 2:
Add news, fundamentals, events, hype, calendar and company intelligence.

Horizon 3:
Add AI explanation, education hub, metric recommendations, simulation, strategy builder and trade journaling.

Horizon 4:
Connect to the trading bot layer with paper trading, broker integration, risk policies and eventually controlled automation.
```

The cleanest strategic framing is:

> **Horizon 1 tells us what the chart is doing.
> Horizon 2 tells us what the world is saying.
> Horizon 3 teaches us what it means and helps us plan.
> Horizon 4 helps us execute safely.**
