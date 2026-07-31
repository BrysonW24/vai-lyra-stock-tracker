Your intuition is directionally right, but the optimisation target needs one important upgrade.

A stock trading at 20 cents is not automatically “cheaper” than one trading at $200. What matters is the company’s market capitalisation, enterprise value, share count, float, dilution risk and executable liquidity. The correct objective is also not simply “find the highest possible multiple.” It is:

Maximise probability-weighted long-term wealth growth per dollar at risk, per unit of time, after dilution, liquidity, slippage and failure risk.

For example, a trade with a 1% chance of returning 100 times your money and a 99% chance of going to zero has an expected gross multiple of:

0.01 \times 100 + 0.99 \times 0 = 1.0

That is zero expected profit before costs, despite the spectacular headline payoff. The real target is asymmetric opportunities whose probability is being underestimated, not merely stocks with lottery-ticket payoffs.

This is a legitimate problem to attack because long-run stock outcomes are extremely concentrated: research covering more than 64,000 global stocks found that a majority underperformed one-month US Treasury bills over their full lifetimes, while the top 2.4% accounted for all net global stock-market wealth creation in the sample. That means there really are rare super-winners—but it also means false positives will vastly outnumber them. 

The correct Lyra objective

Lyra should estimate a distribution of possible outcomes, not one bullish score.

For every candidate and horizon, it should estimate something like:

P(company survives 36 months)
P(stock reaches +100% within 12 months)
P(stock reaches 5x within 36 months)
P(stock reaches 10x within 60 months)
P(stock suffers -80%, delisting or destructive dilution)
Expected time to catalyst
Expected maximum drawdown
Expected executable return after spread and slippage
Opportunity archetype
Prediction uncertainty
Capital-efficiency percentile

The best final ranking target is therefore closer to:

\text{Capital-Efficient Opportunity Score}
=
\frac{
\text{Expected log wealth growth}
\times
\text{confidence}
\times
\text{survival probability}
}{
\text{time to payoff}
\times
\text{liquidity penalty}
\times
\text{ruin risk}
}

The exact formula would be learned and calibrated, but that is the conceptual target.

⸻

The complete no-ceiling model universe

There is no finite list of every conceivable model, but the following is the comprehensive practical universe I would consider for Lyra.

1. Human-designed domain scorecards

These are deterministic models rather than machine-learning models, but they provide the essential foundation.

Examples:

* ten-domain Emerging Winner scorecard
* weighted evidence completeness
* contract quality score
* balance-sheet survivability score
* thematic bottleneck score
* traction score
* smart-money sponsorship score
* manipulation-risk score

They are valuable because every later model needs structured, inspectable inputs. They also provide a fallback when machine-learning confidence is low.

Role in Lyra: baseline, explainability layer and safety backbone.

⸻

2. Logistic, ordinal and multinomial classification

These are simple statistical classifiers.

Binary logistic regression

Predicts:

Winner vs non-winner
10x vs not 10x
Survives vs fails

Ordinal regression

Predicts ordered stages:

0 — weak
1 — interesting but incomplete
2 — strong emerging candidate
3 — breakout archetype
4 — exceptional asymmetric candidate

Multinomial regression

Predicts distinct archetypes:

AI infrastructure enabler
Government-backed strategic technology
Platform adoption breakout
Defence beneficiary
Space supply-chain winner
Resource bottleneck
Turnaround
Speculative narrative

Elastic-net logistic regression

Adds feature selection and protects against extreme overfitting.

Role: highly interpretable benchmark and reality check against more complex models.

⸻

3. Generalised additive and interpretable boosting models

Examples:

* GAMs
* Explainable Boosting Machines
* monotonic GAMs
* spline-based logistic models

These can capture nonlinear effects while remaining understandable.

For example:

Government score helps until 75, then adds little.
Liquidity below 30 creates a severe penalty.
Revenue growth above 40% becomes increasingly valuable.
Dilution above 20% sharply reduces winner probability.

Role: transparent nonlinear benchmark, useful for showing how each domain changes probability.

⸻

4. Decision trees and forest models

Single decision trees

Useful for discovering human-readable rules:

Theme fit > 78
AND cash runway > 18 months
AND revenue growth > 35%
AND volume acceleration > 1.8x
→ high historical winner concentration

Random Forest

Stable, nonlinear classifier and regression baseline.

Extra Trees

More randomised forest that can expose unusual interactions.

Quantile Regression Forest

Predicts the distribution of outcomes rather than only the mean.

Random Survival Forest

Predicts time until:

* breakout
* failure
* delisting
* dilution
* acquisition

Generalised Random Forest

Can estimate heterogeneous effects and conditional quantiles, making it useful for questions such as “which kinds of companies benefit most from a government award or sector-policy shift?” 

Role: robust benchmark, survival modelling, quantiles and interpretable interactions.

⸻

5. Gradient-boosted decision trees

This is still the best first production family.

Examples:

* LightGBM
* XGBoost
* CatBoost
* NGBoost
* LambdaMART

These are strong for Lyra’s mixed tabular inputs:

* market data
* technical indicators
* fundamentals
* policy scores
* themes
* contract activity
* hiring
* patents
* dilution
* liquidity
* investor activity
* text-derived features

Machine-learning asset-pricing research found tree-based and neural-network models among the strongest approaches, with nonlinear interactions materially improving forecasts and momentum, liquidity and volatility repeatedly appearing among the important predictors. 

Special variants

NGBoost: predicts a full probability distribution.

CatBoost: strong when there are many categorical features such as industry, country, archetype, agency and contract class.

LambdaMART: directly optimises ranking rather than classification accuracy.

Role: champion model for Winner Classification and research-queue ranking.

⸻

6. Support Vector Machines

Variants:

* linear SVM
* kernel SVM
* one-class SVM
* ranking SVM

Useful when the winner/non-winner boundary is complex but data volume is moderate.

Best use: small historical datasets, one-class winner-profile detection and anomaly detection.

Limitation: harder to calibrate and explain than boosted trees.

⸻

7. Nearest-neighbour and historical analogue models

Examples:

* k-nearest neighbours
* weighted nearest neighbours
* adaptive nearest neighbours
* historical case matching
* dynamic time warping similarity
* approximate nearest-neighbour embedding search

This is extremely aligned with your idea.

Lyra could say:

“This stock’s current 10-domain pattern is most similar to five historical companies six months before their major rerating.”

Outputs:

Nearest historical winners
Nearest historical failures
Winner-to-failure similarity ratio
What is present now that was present then
What is missing

Role: powerful user-facing explanation model.

⸻

8. Metric-learning and prototype models

Examples:

* Siamese neural networks
* triplet-loss models
* prototypical networks
* supervised contrastive learning
* neural metric learning

These models learn what “similar” should mean.

Rather than manually defining distance between two companies, they learn an embedding where:

* historical winners move close together
* failed speculative companies cluster elsewhere
* different archetypes form distinct regions

A candidate might receive:

82% similarity to strategic-tech winner prototype
48% similarity to speculative-pump prototype

Role: winner-archetype similarity engine.

⸻

9. Unsupervised clustering and archetype discovery

These models discover winner types without requiring all categories to be designed in advance.

Examples:

* k-means
* Gaussian mixture models
* hierarchical clustering
* HDBSCAN
* spectral clustering
* latent class analysis
* self-organising maps
* non-negative matrix factorisation
* topic modelling over company features
* deep embedded clustering

They could reveal patterns such as:

Cluster A — government-backed deep-tech
Cluster B — product-led adoption breakout
Cluster C — infrastructure bottleneck
Cluster D — speculative promotion with weak fundamentals
Cluster E — distressed turnaround

Role: discover unknown winner archetypes and failure archetypes.

⸻

10. Autoencoders and representation learning

Examples:

* standard autoencoder
* denoising autoencoder
* variational autoencoder
* sparse autoencoder
* masked-feature autoencoder
* contrastive encoder

These compress hundreds or thousands of raw inputs into a smaller latent representation.

Useful for:

* reducing feature noise
* detecting unusual companies
* learning hidden company states
* generating embeddings for similarity search
* identifying candidates unlike the current market consensus

Role: feature learning and anomaly discovery.

⸻

11. Positive-unlabelled learning

This is particularly relevant because your labels are imperfect.

Historical winners are clear positives, but “non-winners” are not always true negatives:

* some did not have enough time
* some were acquired
* some had the right structure but were hit by external shocks
* some have not matured yet

Positive-unlabelled models learn from:

Known winners
+
A large pool of unknown examples

Methods include:

* PU bagging
* non-negative PU risk estimation
* biased SVM
* PU boosted trees
* deep PU learning

Role: model rare winners without pretending every other stock is a genuine negative.

⸻

12. Weak supervision models

A large historical dataset will contain noisy, incomplete labels. Weak supervision combines multiple imperfect labelling rules.

Examples of label functions:

Rule A: top-decile 3-year return
Rule B: reached 5x before -80%
Rule C: positive free-cash-flow inflection + large rerating
Rule D: acquired at major premium
Rule E: top wealth creator in sector

The weak-supervision layer estimates which rules are reliable and produces probabilistic labels.

Role: create a large training set before perfect human labels exist.

⸻

13. Multi-task neural networks

One shared model predicts multiple related outcomes:

Survival probability
2x probability
5x probability
10x probability
Dilution probability
Time to catalyst
Archetype
Expected drawdown

This is better than training completely independent models because the tasks share information.

For example, balance-sheet weakness may help predict both dilution and failure, while adoption helps predict both revenue growth and rerating.

Role: consolidated Emerging Winner Engine.

⸻

14. Mixture-of-experts models

Different specialists handle different archetypes.

Example experts:

* AI infrastructure expert
* quantum expert
* robotics expert
* defence expert
* space expert
* biotech expert
* commodity/resource expert
* turnaround expert

A gating model decides which experts should assess each company.

Output:

70% weight: defence-tech expert
20% weight: space-infrastructure expert
10% weight: general small-cap expert

Role: avoid forcing one universal pattern across fundamentally different businesses.

⸻

15. Learning-to-rank models

This is essential because Lyra’s real product problem is:

“Which five companies deserve research first?”

Not merely:

“Is this stock a winner or not?”

Models:

* LambdaMART
* RankNet
* ListNet
* ListMLE
* pairwise ranking SVM
* Plackett-Luce models
* neural ranking
* graph-aware ranking
* multi-objective Pareto ranking

Stock-selection research has explicitly argued for ranking models because ordinary classification or regression does not directly optimise which stocks should be selected. Graph-ranking approaches can also incorporate relationships between companies. 

Role: order the research queue by expected value and confidence.

⸻

16. Survival and time-to-event models

These answer when, not just whether.

Cox proportional hazards

Estimates time to a first event.

Accelerated failure-time models

Estimate how features accelerate or delay a breakout.

Random Survival Forest

Nonlinear time-to-event modelling.

DeepSurv

Neural survival model.

DeepHit

Supports competing risks.

Multi-state models

Track transitions:

Unknown
→ Emerging
→ Confirmed
→ Breakout
→ Mature
or
Unknown
→ Weakening
→ Dilutive financing
→ Failure

Competing-risk model

Models mutually competing events:

+100% breakout
5x breakout
Acquisition
-80% collapse
Major dilution
Delisting
No event

Role: estimate time to reward and time to failure.

⸻

17. First-passage and barrier-event models

Designed specifically for:

Which barrier is hit first?
+20%
+100%
5x
10x
-30%
-80%

Methods:

* triple-barrier labels
* competing barrier classifiers
* first-passage stochastic models
* neural first-passage models
* barrier-aware survival models

Role: convert vague “winner” labels into an executable event sequence.

⸻

18. Quantile and distributional-return models

Mean-return prediction is insufficient for extremely skewed small-cap outcomes.

Models:

* quantile regression
* quantile regression forest
* NGBoost
* distributional neural networks
* mixture-density networks
* normalising flows
* Bayesian posterior predictive models
* distributional boosting

Outputs:

10th percentile return
Median return
90th percentile return
99th percentile return
Probability of total loss
Probability of 10x

Role: estimate full upside/downside asymmetry.

⸻

19. Extreme-value and tail models

These explicitly focus on rare extreme outcomes.

Examples:

* generalised Pareto distributions
* peak-over-threshold models
* extreme-value mixture models
* tail-index estimators
* conditional EVT
* neural extreme-value models

These could separately model the tail probability of:

* 10x winners
* 100x winners
* catastrophic collapse

Long-horizon individual-stock returns are extremely positively skewed, which is exactly why tail modelling is relevant—but also why estimates become unstable without very large samples. 

Role: tail-probability layer, never the sole production model.

⸻

20. Bayesian hierarchical models

These share statistical strength across related categories:

Company
inside industry
inside theme
inside country
inside policy regime
inside market regime

A quantum company with little history can borrow information from:

* quantum peers
* strategic-technology firms
* government-funded deep-tech companies
* similar capital structures

Models:

* hierarchical logistic regression
* Bayesian multilevel survival models
* dynamic Bayesian models
* Bayesian additive regression trees
* Bayesian neural networks

Role: few-data sectors and uncertainty-aware inference.

⸻

21. Bayesian networks and probabilistic graphical models

These encode causal or probabilistic dependency chains.

Example:

Government funding
→ hiring acceleration
→ R&D expansion
→ product progress
→ customer traction
→ revenue inflection
→ institutional sponsorship
→ rerating

Outputs can show:

* probability propagation
* missing evidence
* alternative pathways
* sensitivity to assumptions

Role: explainable thesis graph and scenario analysis.

⸻

22. Gaussian-process models

Useful where data is limited and uncertainty matters.

Variants:

* Gaussian-process classification
* Gaussian-process regression
* sparse GPs
* deep kernel learning
* multi-task GPs

Role: small sample, high-quality scientific/quantum/biotech datasets where knowing uncertainty is as important as the point prediction.

⸻

23. Classical time-series and state-space models

Still useful as baselines and regime components.

Models:

* ARIMA
* VAR
* Bayesian VAR
* GARCH
* stochastic volatility
* Kalman filter
* dynamic linear models
* structural time-series models
* dynamic factor models

Role: model macro, volatility, factor and company-state evolution.

⸻

24. Hidden Markov and regime-switching models

These classify hidden market/company regimes.

Possible states:

Dormant
Evidence accumulating
Early institutional interest
Momentum confirmation
Crowded acceleration
Distribution
Collapse

Methods:

* Hidden Markov Models
* Markov-switching regression
* switching state-space models
* hierarchical HMMs
* neural HMMs

Role: identify when the same company features mean different things in different regimes.

⸻

25. Change-point detection

These detect structural breaks earlier than ordinary trend models.

Methods:

* Bayesian online change-point detection
* CUSUM
* Page-Hinkley
* kernel change-point detection
* neural change detectors
* ruptures/segmentation models

Signals:

* hiring suddenly accelerates
* government awards begin appearing
* margins inflect
* revenue mix changes
* insider behaviour changes
* volume regime shifts

Role: detect “something materially changed” before consensus notices.

⸻

26. Point-process and Hawkes models

These model clusters of events.

Events could include:

* contracts
* insider purchases
* patent grants
* hires
* partnerships
* filings
* news mentions
* volume shocks

A Hawkes-style model can represent self-exciting cascades:

Contract win
→ analyst coverage
→ institutional interest
→ volume growth
→ further attention

Role: model event acceleration and catalyst cascades.

⸻

27. TCN, GRU and LSTM models

These learn sequence patterns:

* momentum buildup
* volume expansion
* repeated support
* score acceleration
* volatility compression
* post-event drift

Examples:

* GRU
* LSTM
* bidirectional LSTM
* temporal convolutional network
* CNN-LSTM hybrid
* attention-LSTM

Role: understand the shape and evolution of a setup.

⸻

28. Temporal Fusion Transformer

TFT combines:

* static company variables
* historical observations
* known future events
* macro context
* multiple forecast horizons

It also provides attention and feature-selection outputs. The original architecture was developed specifically for interpretable multi-horizon forecasting with mixed static, known-future and historical inputs. 

Role: multi-horizon probability model.

⸻

29. Modern time-series foundation architectures

Potential models:

* PatchTST
* Informer
* Autoformer
* FEDformer
* TimesNet
* N-BEATS
* N-HiTS
* DeepAR
* DeepState
* TiDE
* Temporal Mamba / state-space sequence models
* TimesFM-style foundation models
* Chronos-style pretrained models
* Moirai-style universal forecasters

Role: temporal challengers and pretrained feature encoders.

⸻

30. Self-supervised time-series models

These learn useful patterns before labelled winners are introduced.

Training tasks:

* mask and reconstruct time windows
* contrast similar and dissimilar regimes
* predict future latent states
* identify augmented versions of the same setup
* pretrain across thousands of stocks

Models:

* contrastive predictive coding
* TS2Vec
* masked time-series transformer
* self-supervised TCN
* hypergraph pretraining

Recent graph-stock research has used self-supervised pretraining before fine-tuning for stock ranking, which is highly relevant when true winner labels are scarce. 

Role: learn market representations from much larger unlabelled datasets.

⸻

31. Knowledge-graph embedding models

These embed companies and relationships.

Models:

* TransE
* TransH
* RotatE
* ComplEx
* DistMult
* node2vec
* DeepWalk
* LINE

Relations:

supplies
depends on
contracted by
invested in
competes with
shares customer
shares theme
shares commodity

Role: relationship embeddings and link prediction.

⸻

32. Static graph neural networks

Models:

* GCN
* GraphSAGE
* GAT
* graph isomorphism networks
* graph pooling networks

They learn from company and relationship networks.

Role: identify connected beneficiaries and systemic exposure.

⸻

33. Multi-relational graph neural networks

Models:

* R-GCN
* Heterogeneous Graph Transformer
* HAN
* relational GAT
* CompGCN

These distinguish relationships such as:

Supplier relationship ≠ common theme ≠ government contract ≠ shared investor

Role: Lyra’s supply-chain and contract intelligence.

⸻

34. Dynamic and temporal graph neural networks

Models:

* TGN
* TGAT
* DySAT
* EvolveGCN
* temporal graph transformer
* multi-relational dynamic GNN

These allow relationships to appear, strengthen and disappear over time.

Research has proposed multi-relational dynamic graph models specifically to capture evolving relationships across stocks, economic indicators, financial reports, news and sentiment. 

Role: discover second-order winners as networks evolve.

⸻

35. Hypergraph models

Ordinary graphs connect pairs. Hypergraphs connect groups.

Example:

Defence contract
links simultaneously to:
agency
prime contractor
subcontractors
technology
region
programme
commodity

Models:

* hypergraph neural networks
* hypergraph attention
* spatiotemporal hypergraphs
* dynamic hypergraphs

Role: complex programme, ecosystem and supply-chain relationships.

⸻

36. Graph-diffusion and network-propagation models

These model how demand, capital or risk spreads through a network.

Examples:

* personalised PageRank
* graph diffusion
* heat-kernel propagation
* graph signal processing
* learned diffusion neural networks

Role: trace how a major AI, defence or space investment may flow into suppliers and enablers.

⸻

37. Link-prediction models

These estimate future relationships:

Which small cap is likely to win a contract?
Which supplier is likely to partner with a hyperscaler?
Which company may enter a strategic supply chain?
Which fund may establish a position?

Models:

* graph autoencoders
* link-prediction GNNs
* knowledge-graph completion
* temporal link prediction

Role: anticipate evidence that has not yet appeared publicly as a confirmed relationship.

⸻

38. Financial NLP classifiers

Models:

* FinBERT-style models
* domain-specific transformers
* sentence classifiers
* document classifiers
* textual entailment
* sentiment models
* uncertainty and risk-language classifiers

Documents:

* 10-K / 10-Q / 8-K
* annual reports
* earnings calls
* government procurement
* patents
* press releases
* investor presentations

Role: turn unstructured documents into structured domain signals.

⸻

39. Event extraction models

These extract specific facts rather than broad sentiment.

Examples:

Company won contract
Company increased capacity
Company entered partnership
Company lost customer
Company raised capital
Company received grant
Company launched product
Company hired key specialist

Methods:

* named-entity recognition
* event extraction
* relation extraction
* semantic role labelling
* LLM structured extraction with validation

Role: evidence ingestion.

⸻

40. Claim verification and evidence-consistency models

These assess whether promotional claims are supported.

Examples:

* textual entailment
* contradiction detection
* cross-document fact consistency
* press-release-to-filing comparison
* source-authority classification
* provenance scoring

Role: distinguish genuine operating progress from promotional language.

⸻

41. Document embedding and semantic retrieval models

Models:

* sentence transformers
* domain embeddings
* late-interaction retrieval
* ColBERT-style retrieval
* hybrid semantic/keyword search

Uses:

* find historical companies with similar filings
* compare current contract language with past major awards
* retrieve analogous business models
* identify thematic relationships

Role: Lyra evidence search and historical analogues.

⸻

42. Patent-intelligence models

Potential signals:

* patent volume
* patent quality
* citation velocity
* inventor concentration
* technical novelty
* proximity to strategic fields
* assignee networks

Models:

* patent embeddings
* citation graph networks
* novelty scoring
* technology-topic models
* inventor mobility graphs

Role: detect deep-tech capability before revenue is obvious.

⸻

43. Hiring and labour-intelligence models

Inputs:

* role counts
* seniority
* specialist skills
* geography
* growth rate
* employee churn
* key-person movement
* job-description language

Models:

* hiring velocity classification
* skill embedding models
* organisational graph models
* change-point detection
* workforce survival models

Role: detect investment and operational expansion before financial statements reveal it.

⸻

44. Product-adoption and alternative-data models

Possible data:

* web traffic
* app downloads
* active users
* developer activity
* GitHub commits
* cloud usage
* customer reviews
* product pricing
* shipping/import data
* satellite imagery
* geolocation
* card transactions
* search trends

Models:

* multimodal classifiers
* computer vision
* time-series forecasting
* diffusion detection
* latent growth models

Role: measure real-world traction earlier than reported revenue.

⸻

45. Audio and behavioural models

Inputs from earnings calls or presentations:

* hesitation
* vocal stress
* certainty
* pacing
* question avoidance
* management-team interaction

Models:

* acoustic transformers
* speech emotion models
* multimodal text/audio encoders

Role: management-communication quality and inconsistency detection.

⸻

46. Multimodal fusion models

These combine:

* numerical features
* time series
* graphs
* text
* images
* audio
* event sequences

Architectures:

* late fusion
* early fusion
* cross-attention
* multimodal transformers
* mixture of modality experts

Role: ultimate company-state representation.

⸻

47. Causal forests and heterogeneous-effect models

Instead of asking:

“Did stocks with contracts rise?”

ask:

“For which kinds of companies did receiving this type of contract materially improve outcomes?”

Models:

* causal forests
* generalised random forests
* Bayesian causal forests
* meta-learners
* double machine learning

Role: estimate which catalysts genuinely change probabilities.

⸻

48. Difference-in-differences and event studies

Useful for:

* government funding
* tariff changes
* defence programmes
* regulation
* tax credits
* industry subsidies
* index inclusion

Role: measure whether an event historically caused a meaningful rerating relative to a control group.

⸻

49. Synthetic-control models

Construct a synthetic comparison company or portfolio to estimate:

What would probably have happened without the contract, policy, partnership or capital investment?

Role: causal validation of catalysts.

⸻

50. Uplift and treatment-response models

Predict:

Which companies benefit most if:
interest rates fall
defence spending rises
AI capex increases
a subsidy appears
a commodity price moves

Role: scenario-specific winner ranking.

⸻

51. Causal knowledge graphs

Combine:

* graph structure
* causal hypotheses
* evidence
* temporal order
* intervention modelling

Role: trace plausible causal paths rather than mere correlation.

⸻

52. Scenario and counterfactual simulators

Outputs:

If AI capex doubles, what changes?
If government funding is cut, which thesis breaks?
If copper rises 40%, who benefits and who suffers?
If rates remain high, who runs out of cash?

Methods:

* Monte Carlo
* Bayesian simulation
* causal simulation
* structural models
* graph propagation
* agent-based models

Role: thesis stress testing.

⸻

53. Anomaly-detection models

Examples:

* Isolation Forest
* one-class SVM
* local outlier factor
* autoencoder reconstruction error
* robust covariance
* density estimation

Finds companies with unusual combinations such as:

tiny market cap
rapid contract growth
increasing specialist hiring
improving technical structure
low analyst coverage

Role: surface opportunities outside known archetypes.

⸻

54. Novelty-detection models

Closely related to anomaly detection, but focused on candidates unlike anything the model has previously seen.

Outputs:

High opportunity score
High novelty
Low confidence
Needs human investigation

Role: prevent the system from discarding genuinely new opportunity types.

⸻

55. Pump-and-dump and manipulation classifiers

This is non-negotiable for microcaps.

Signals:

* low float
* sudden social activity
* coordinated wording
* promotional newsletter activity
* unusual volume
* low disclosure quality
* repeated reverse splits
* insider selling
* financing patterns
* price/attention divergence

ASIC has warned that pump-and-dump operators target low-liquidity small caps because rumours can have an outsized price impact, and it has increased surveillance combining trading and social-media data.  The SEC likewise warns that low trading volumes and limited public information make microcaps especially risky and easier to manipulate. 

Research also suggests that intense social activity around lottery-like stocks can precede retail buying pressure and lower subsequent returns, so “attention” should not automatically be treated as positive evidence. 

Role: subtract false hype from genuine traction.

⸻

56. Bankruptcy, delisting and survivability models

Models:

* Altman-style statistical models
* hazard models
* survival forests
* boosted failure classifiers
* deep competing-risk models

Signals:

* cash runway
* debt
* covenant pressure
* operating cash burn
* auditor warnings
* exchange compliance
* financing dependence

Role: first gate before upside prediction.

⸻

57. Dilution and financing-risk models

Predict:

Probability of capital raise
Expected new share count
Likely discount
Potential dilution
Time until cash exhaustion

This is vital because a company may grow operationally while existing shareholders are diluted.

Role: convert company success into shareholder-return probability.

⸻

58. Liquidity and execution models

Predict:

* spread
* market impact
* fill probability
* exit capacity
* slippage
* days required to liquidate

A 100x mark-to-market outcome is irrelevant if the position cannot be entered or exited at realistic prices.

Role: transform theoretical return into executable return.

⸻

59. Options-implied probability models

For optionable small/mid caps:

* implied volatility surface
* skew
* risk-neutral density
* options-flow imbalance
* unusual open interest
* dealer positioning

Role: market-implied expectation and catalyst pricing.

⸻

60. Short-interest and squeeze models

Inputs:

* short interest
* days to cover
* borrow cost
* float
* options positioning
* catalyst proximity
* retail attention

Role: distinguish fundamental winner potential from temporary mechanical squeeze potential.

⸻

61. Insider and institutional-flow models

Models:

* insider transaction classifier
* 13F change model
* ownership network
* strategic-investor similarity
* hidden accumulation detection

Role: sponsorship and informed-capital signals, while respecting filing delays.

⸻

62. Regime-aware models

Models:

* regime-switching ensemble
* conditional mixture-of-experts
* macro state classifier
* Bayesian regime model
* dynamic factor model

Examples:

Risk-on growth
Risk-off
Inflation shock
Rate-cut cycle
Defence/geopolitical escalation
Commodity squeeze
AI-capex acceleration

Role: adjust which winner archetypes are relevant now.

⸻

63. Market microstructure models

If Lyra eventually uses intraday data:

* limit-order-book transformer
* order-flow imbalance model
* DeepLOB-style networks
* volume profile models
* liquidity-state classifiers
* trade-sign models

Role: entry timing, execution and manipulation detection—not long-horizon winner discovery.

⸻

64. Reinforcement-learning models

RL should not be the stock-discovery model. It belongs later in the allocation and decision layer.

Potential uses:

* position sizing
* rebalancing
* staged entries
* exit policy
* exploration versus exploitation
* research-budget allocation

Models:

* deep Q networks
* actor-critic
* PPO
* SAC
* offline RL
* model-based RL

Role: policy optimisation after prediction models are proven.

⸻

65. Contextual bandits

Useful for deciding:

Which candidate should Lyra investigate next?
Which alert should be shown?
Which domain needs more evidence?
Which research action has the highest information value?

Role: intelligently allocate limited research attention.

⸻

66. Optimal-stopping models

Determine when to:

* enter
* wait
* add
* stop researching
* close a paper position
* take partial profit

Methods:

* dynamic programming
* optimal stopping
* real-options models
* stopping-time neural networks

Role: timing layer after candidate discovery.

⸻

67. Portfolio-allocation models

These do not discover winners; they decide how much exposure a prediction deserves.

Potential methods:

* expected-log-growth optimisation
* fractional Kelly
* robust mean-variance
* CVaR optimisation
* risk parity
* hierarchical risk parity
* Bayesian portfolio optimisation
* distributionally robust optimisation
* scenario-weighted optimisation

Role: prevent a promising research system from becoming a ruinous concentration system.

⸻

68. Correlation and dependency models

Models:

* factor covariance
* dynamic conditional correlation
* graphical lasso
* copulas
* tail-dependence models
* graph covariance models

Role: recognise that ten “different” AI-infrastructure stocks may really be one concentrated bet.

⸻

69. Deep ensembles

Train multiple independently initialised versions of each model.

Outputs:

Mean probability
Model disagreement
Out-of-distribution uncertainty

Deep ensembles are a practical approach to uncertainty estimation and have shown an ability to produce higher uncertainty on out-of-distribution examples. 

Role: uncertainty and robustness.

⸻

70. Bayesian model averaging

Combines model predictions based on posterior credibility.

Role: ensemble that reflects model uncertainty rather than blindly averaging.

⸻

71. Stacking and super-learning

Combines:

Tree classifier
Archetype similarity
Temporal model
Graph model
Causal model
Risk models
Deterministic Lyra score

A meta-model learns when each constituent model is trustworthy.

Role: final prediction layer.

⸻

72. Mixture-of-regime ensembles

Different ensembles for different regimes:

Growth regime ensemble
Defence regime ensemble
Commodity regime ensemble
Risk-off ensemble

Role: adapt model weighting dynamically.

⸻

73. Conformal prediction

Wraps around existing models to produce empirically calibrated prediction sets or intervals.

Time-series conformal methods are specifically being developed to maintain useful coverage under temporal dependence and distribution shift. 

Role: communicate uncertainty honestly.

⸻

74. Calibration models

Methods:

* Platt scaling
* isotonic regression
* beta calibration
* temperature scaling
* spline calibration
* regime-specific calibration

Role: ensure that “30% probability” actually means approximately 30% over time.

⸻

75. Out-of-distribution detectors

These ask:

“Is this company or market regime unlike the training data?”

Methods:

* embedding distance
* ensemble disagreement
* Mahalanobis distance
* energy-based scoring
* density models
* conformal OOD detection

Role: refuse or downgrade predictions when the model has no reliable precedent.

⸻

76. Active-learning models

Select the examples where human research will improve the system most.

Examples:

High potential, low confidence
Models strongly disagree
Novel archetype
Important missing evidence

Role: direct Lyra analysts and users toward the most valuable research tasks.

⸻

77. Meta-learning and few-shot models

Useful for emerging fields with few historical examples:

* quantum
* AGI-specific infrastructure
* novel robotics categories
* new defence technologies

Methods:

* model-agnostic meta-learning
* prototypical networks
* few-shot Bayesian adaptation
* transfer learning

Role: adapt from related archetypes rather than waiting years for labels.

⸻

78. Transfer-learning models

Pretrain on:

* all global stocks
* private-company data
* venture-capital outcomes
* credit risk
* procurement events
* patents

Then fine-tune on small-cap public equities.

Role: overcome limited winner labels.

⸻

79. AutoML and architecture search

Tools:

* automated feature selection
* Bayesian hyperparameter optimisation
* model search
* neural architecture search
* ensemble search

Role: discover challengers—but always under strict walk-forward controls to avoid automated overfitting.

⸻

80. Generative scenario and world models

No-constraint moonshot models:

* generative time-series models
* diffusion models
* company digital twins
* synthetic macro scenarios
* generative graphs
* learned market world models

They could simulate thousands of futures:

Policy support rises
Competitor fails
Contract arrives
Capital raise occurs
Demand accelerates

Role: scenario generation, not direct unquestioned prediction.

⸻

81. Agent-based market simulations

Simulate:

* retail investors
* institutions
* insiders
* market makers
* short sellers
* government procurement
* competitors

Role: understand reflexive market dynamics and liquidity effects.

⸻

82. Multi-agent research systems

Specialised AI agents:

* technical analyst
* forensic accountant
* government-contract analyst
* patent analyst
* supply-chain analyst
* sceptical short seller
* manipulation investigator
* portfolio risk analyst

Their structured findings feed deterministic models rather than voting casually.

Role: research feature generation and thesis challenge.

⸻

The ultimate no-constraint Lyra architecture

I would not deploy one model. I would build a hierarchical model system.

Gate 1 — Legitimacy and survivability

Models:

* fraud/manipulation classifier
* cash-runway model
* bankruptcy/delisting model
* dilution model
* liquidity model

Question:

Can this company and its shareholders plausibly survive long enough to capture the upside?

⸻

Gate 2 — Emerging-winner structure

Models:

* ten-domain boosted-tree classifier
* ordinal winner-stage model
* historical analogue model
* prototype/metric-learning model

Question:

Does this resemble companies that became major winners before they were obvious?

⸻

Gate 3 — Opportunity archetype

Models:

* multi-label classifier
* clustering
* mixture of experts
* knowledge-graph embedding

Output:

Government-backed strategic technology
AI infrastructure bottleneck
Robotics adoption breakout
Quantum platform
Space/defence supplier

⸻

Gate 4 — Evidence and causal support

Models:

* NLP event extraction
* causal forest
* synthetic controls
* contract-impact model
* hiring/patent/adoption models

Question:

Is there real evidence that should increase the probability—or merely a compelling story?

⸻

Gate 5 — Timing and acceleration

Models:

* temporal transformer
* HMM/regime model
* change-point detector
* Hawkes/event cascade
* scanner momentum model

Question:

Is the thesis merely structurally attractive, or is something beginning to happen now?

⸻

Gate 6 — Relationship spillover

Models:

* dynamic heterogeneous GNN
* hypergraph
* graph diffusion
* link prediction

Question:

Is this a hidden second- or third-order beneficiary?

⸻

Gate 7 — Return distribution and time

Models:

* competing-risk survival
* quantile model
* distributional boosting
* extreme-value model

Outputs:

P(2x)
P(5x)
P(10x)
P(100x)
P(-80%)
Expected time to catalyst
Expected drawdown

⸻

Gate 8 — Final ranking and uncertainty

Models:

* learning-to-rank
* stacked ensemble
* deep ensemble
* conformal calibration
* OOD detector

Output:

Winner probability
Archetype
Percentile
Confidence
Model disagreement
Evidence completeness

⸻

Gate 9 — Capital allocation

Models:

* expected-log-growth optimisation
* robust allocation
* CVaR
* fractional Kelly
* correlation and capacity model

Question:

Even if the idea is attractive, how much risk could the hypothesis rationally justify?

This belongs in Paper Bot first—not live execution.

⸻

What Lyra should show the user

A final finding should look like:

Company: XYZ
Emerging Winner Classification
Strong candidate — 87th percentile
Archetype
Government-backed quantum infrastructure
Domain completeness
8 of 10 domains present
Outcome distribution
P(2x in 24 months): 34%
P(5x in 48 months): 12%
P(10x in 60 months): 4%
P(-80% / delisting): 18%
Survivability
Medium-high
Timing state
Evidence accumulating; market confirmation incomplete
Strongest domains
• Policy support
• Strategic theme fit
• Hiring acceleration
• Technical structure
• Contract evidence
Missing domains
• Institutional sponsorship
• Proven recurring revenue
Historical analogues
Three prior strategic-tech winners
Two failed promotional companies
Confidence
Medium
Model disagreement: moderate
Actions
Research | Compare | Watch | Ask Lyra | Paper Bot

What I would build first

Despite the no-constraint vision, the strongest first version is not the most complicated.

Production v1

1. Ten-domain deterministic feature system
2. CatBoost/LightGBM ordinal winner classifier
3. LambdaMART research-queue ranker
4. Survival/dilution/manipulation risk gates
5. Historical analogue retrieval
6. Calibrated probabilities and SHAP explanations
7. Immutable shadow-live prediction ledger

Production v2

8. Temporal sequence challenger
9. NLP evidence extraction
10. Causal contract/policy model
11. Positive-unlabelled learning
12. Full return-distribution model

Production v3

13. Dynamic heterogeneous graph neural network
14. Archetype-specific mixture of experts
15. Multimodal alternative-data model
16. Stacked uncertainty ensemble
17. Paper Bot allocation model

The key conclusion

Your intuition is sound provided Lyra does not confuse cheap-looking shares with cheap companies, or huge possible payoffs with attractive expected value.

The real mission should be:

Find legitimate, survivable, under-recognised companies with a small current valuation, evidence of an expanding future opportunity, an asymmetric payoff distribution, improving timing, and enough liquidity for the opportunity to be executable.

I would make the Emerging Winner Engine the flagship classifier, then place the earlier +20% timing model beneath it:

Emerging Winner Engine:
“Is this structurally the kind of company that can become exceptional?”
Timing Model:
“Is the market beginning to recognise it now?”
Allocation Model:
“How much hypothesis risk could the calibrated opportunity justify?”

That three-part system is substantially more intelligent than trying to train one model to guess the next 100-times winner.