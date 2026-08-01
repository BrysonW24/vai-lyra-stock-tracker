-- 057: the option-4 label conjuncts land on the emerging-winner outcomes ledger.
--
-- dataset.label_from_outcome has carried these seams (inert, defaulting to pass) since the ledger
-- shipped: winner = first-touch +100% AND still listed at horizon end AND dollar-liquidity grew.
-- The maturation job (workers/emerging_winner/outcome_job.py) now writes them, so the live label
-- tightens automatically - no relabel, no retrain, exactly as the seam was designed.
--
-- Additive only: existing rows read NULL = "not yet measured", which the labeler treats as pass -
-- byte-identical behaviour to before this migration.

alter table public.emerging_winner_outcomes
  add column if not exists still_listed boolean,
  add column if not exists liquidity_grew boolean;

comment on column public.emerging_winner_outcomes.still_listed is
  'Option-4 conjunct: the name demonstrably traded to the horizon end (false = went dark mid-window, the delisting proxy). NULL = not yet measured (labeler treats as pass).';
comment on column public.emerging_winner_outcomes.liquidity_grew is
  'Option-4 conjunct: 20-day average dollar volume at the horizon end >= at entry (durable emergence, not a transient spike). NULL = not yet measured (labeler treats as pass).';
