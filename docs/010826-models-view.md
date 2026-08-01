Yes — your diagnosis is right. The current page is an **internal model catalogue**, not a usable model-running experience.

It makes every model look equally important, mixes live and theoretical capabilities, and asks the user to read a wall of architecture before they can do anything meaningful.

The page should become a **Model Lab** built around one simple flow:

> **Choose the question → choose where to look → run the model → watch it work → inspect the results.**

# 1. Replace the page with three clear states

## State A — Configure

The entire first screen should fit above the fold.

### Header

**Model Lab**

> Choose what you want Lyra to predict, define where it should search, and watch the evidence form.

### Main configuration panel

#### Model

Show only models that can meaningfully produce an output:

* **Oversold Recovery** — Live
* **Emerging Winner** — Shadow-live
* **Historical Analogue** — Shadow-live
* **Risk Gate Review** — Shadow-live

Anything merely designed should not appear beside runnable models. Put those in a secondary **Roadmap & methods** drawer.

#### Outcome

The available outcome options should change when the model changes.

For Emerging Winner:

* Multi-bagger within 12 months
* Top-decile return within 12 months
* Composite quality winner
* True moonshot within 24 months

For Oversold Recovery:

* Recovery score
* +20% before -10%
* Momentum strengthening
* Risk of invalidation

#### Archetypes / verticals

Use selectable chips:

* AI infrastructure
* Semiconductors
* Robotics
* Quantum
* Space
* Defence
* Government-backed technology
* Energy infrastructure
* Cybersecurity
* Turnaround

Allow multiple selections and include:

* `All verticals`
* `Only my watchlist`
* `Only my portfolio`

#### Universe

* Micro cap
* Small cap
* Small + micro
* Lyra tracked universe
* Watchlist
* Portfolio

#### Optional ticker

```text
Ticker symbol — optional
e.g. BKSY
```

Place an information icon beside it:

> Leave this blank to scan the selected universe. Add a ticker to run the selected model against one specific company and receive a deeper company-level explanation.

#### Available data sources

When the model is selected, show the exact sources it can use:

```text
✓ Market and volume data
✓ Lyra deterministic signals
✓ Theme and supply-chain mappings
✓ Company fundamentals
✓ Government and contract evidence
○ Insider activity — limited
○ Hiring history — not yet connected
```

This should update dynamically based on:

* model selection
* ticker
* vertical
* available backend connections

### Model summary panel

On desktop, place this to the right of configuration.

```text
Emerging Winner

Status             Shadow-live
Predicts           Multi-bagger potential
Default horizon    12 months
Universe           US small and micro caps
Explainability     SHAP + domain breakdown
Last model version Reference-v1
Estimated runtime  15–40 seconds
```

Then show:

**What this model looks for**

* structural quality
* genuine thematic exposure
* policy or contract support
* traction
* survivability
* sponsorship
* technical confirmation

The primary CTA becomes:

```text
Run Emerging Winner Model
```

Not simply `Run model`.

# 2. Show the model actually working

When the button is pressed, the configuration should collapse into a compact run summary and the page should transition into a live execution view.

This is the part that makes the product feel powerful.

## Live run timeline

```text
1  Resolving candidate universe
2  Loading point-in-time evidence
3  Building company feature profiles
4  Calculating domain scores
5  Running Emerging Winner classifier
6  Applying survivability and risk gates
7  Ranking qualified candidates
8  Generating grounded explanations
9  Saving the prediction ledger
```

Each step should visibly move through:

* Queued
* Running
* Complete
* Warning
* Failed

Alongside the timeline, show real counters:

```text
Companies considered          428
Companies with sufficient data 317
Source records loaded         9,842
Features calculated           146 per company
Companies passing risk gates  63
Deep-research candidates      12
```

Do not fake terminal-style activity. Every animation should correspond to a real backend stage or event.

## Expandable step details

A user can click any active/completed step:

### Building company feature profiles

```text
Sources used
• Market history
• Latest fundamentals
• Government awards
• Theme membership
• Supply-chain relationships
• Risk and liquidity metrics

Output
317 point-in-time company feature vectors
```

### Running the classifier

```text
Model       LightGBM reference-v1
Target      ≥100% within 12 months
Features    146
Calibration Isotonic
Inference   Batch
```

This gives transparency without turning the whole page into documentation.

# 3. Results should become the hero

After completion, the run timeline contracts into a small success strip:

```text
Run completed in 24.6 seconds
428 reviewed · 63 passed · 12 surfaced
```

The results experience should have a ranked list on the left and a details drawer on the right.

## Candidate result card

```text
BKSY                                    Rank #1

Strong candidate
Government-backed strategic technology

Winner probability       18%
Universe baseline          3%
Opportunity percentile   96th
Confidence               Medium-high

Strongest domains
Government & policy · Theme strength · Traction

Primary risk
Liquidity and customer concentration

Evidence
14 source records · 3 recent catalysts
```

Actions:

```text
Open finding
Save
Watchlist
Compare
Ask Lyra
Paper Bot
```

## Finding drawer

Clicking a result opens:

* Why it surfaced
* Domain breakdown
* Model drivers
* Evidence and sources
* Historical analogues
* Missing evidence
* Risks and invalidation conditions
* Prediction provenance
* Model version and timestamp

That preserves the Wiz-style investigation depth you wanted without overwhelming the main page.

# 4. Simplify the information architecture

The current page contains useful information, but it belongs in different places.

## Main tab: Run

Only:

* configuration
* live run
* results

## Secondary tab: Previous runs

Show:

* timestamp
* selected model
* outcome
* universe
* candidate count
* model version
* saved results

## Secondary tab: Models & methods

Move the large technical catalogue here:

* always-on deterministic backbone
* model cards
* designed model families
* model roadmap
* implementation states
* source paths
* technical documentation

This keeps the engineering honesty without making it the primary experience.

# 5. Use four unambiguous availability states

Replace vague badges such as `Built, not surfaced`.

Use:

* **Live** — real model and real output
* **Shadow-live** — real execution, results logged, not yet promoted
* **Reference** — deterministic or illustrative output, not learned
* **Planned** — architecture exists, implementation does not

A planned model should never have a `Run model` CTA. It gets:

```text
View model design
```

# 6. Recommended first-run experience

The default setup should immediately demonstrate Lyra’s differentiated direction:

```text
Model       Emerging Winner
Outcome     Multi-bagger, 12 months
Universe    US small + micro caps
Verticals   AI infrastructure, robotics, quantum,
            space and defence
Ticker      Blank — scan universe
```

One click begins the run.

That feels much more powerful than asking a new user to interpret fourteen model cards.

# Proposed desktop layout

```text
┌───────────────────────────────────────────────────────────────┐
│ Model Lab                                      Previous Runs  │
│ Choose the question, define the search, watch Lyra investigate│
├─────────────────────────────┬─────────────────────────────────┤
│ MODEL                       │ EMERGING WINNER                 │
│ [ Emerging Winner       ▼ ] │ Shadow-live                    │
│                             │                                 │
│ OUTCOME                     │ Predicts                        │
│ [ Multi-bagger, 12mo    ▼ ] │ Structural multi-bagger fit    │
│                             │                                 │
│ VERTICALS                   │ Sources available               │
│ [AI infra] [Quantum] [...]  │ ✓ Market  ✓ Themes  ✓ Contracts│
│                             │ ○ Hiring history                │
│ UNIVERSE                    │                                 │
│ [Small + micro caps     ▼ ] │ Estimated runtime: 15–40 sec   │
│                             │                                 │
│ OPTIONAL TICKER       (?)   │                                 │
│ [                           ]│                                 │
│                             │                                 │
│ [ Run Emerging Winner Model ]                                │
└─────────────────────────────┴─────────────────────────────────┘
```

After clicking Run:

```text
┌────────────────────── MODEL RUNNING ──────────────────────────┐
│ 428 candidates · 9,842 evidence records · 146 features       │
│                                                               │
│ ✓ Resolve universe                                            │
│ ✓ Load evidence                                               │
│ ● Build feature profiles        241 / 317                     │
│ ○ Calculate domain scores                                    │
│ ○ Run classifier                                             │
│ ○ Apply risk gates                                           │
│ ○ Rank and explain                                           │
└───────────────────────────────────────────────────────────────┘
```

# The core product change

The page should stop saying:

> “Here are all the models we may eventually build.”

It should say:

> **“Tell Lyra what you want to discover. Watch it investigate. Inspect exactly why each company surfaced.”**

That transforms it from an architecture showcase into an actual product experience.
