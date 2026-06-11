-- 019_ai_native_evidence.sql
-- Evidence + AI audit layer for the AI-native research platform.
--
-- WHAT THIS LAYER IS: every claim an AI surface makes must be traceable back to a
-- concrete piece of evidence. Raw source material lands in source_documents, is split
-- into source_chunks, and is linked to canonical entities (companies, tickers,
-- investors, themes, supply-chain nodes) via entity_links. Every LLM invocation is
-- recorded in ai_runs (model, prompt version, input hash, inputs/outputs, confidence,
-- which documents and entities it saw), and every claim the model makes is pinned to
-- evidence via ai_citations. research_dossiers are the living synthesis artifacts
-- (thesis, bull/bear case, what-would-prove-wrong). user_research_notes and
-- research_tasks are the operator's private research workflow.
--
-- GUARDRAILS: AI never generates orders and never originates notifications - it only
-- explains and synthesizes over evidence that deterministic code selected. ai_runs and
-- ai_citations are append-only audit records: clients may read (and insert their own
-- runs) but never update or delete them.
--
-- ACCESS MODEL: shared intelligence tables (source_documents, source_chunks,
-- entity_registry, entity_links, ai_citations, research_dossiers) are read-only to
-- authenticated users; backend workers write them with the SERVICE ROLE key, which
-- bypasses RLS. user_research_notes and research_tasks are owner-only. ai_runs are
-- readable by their owner, and system runs (user_id is null) are readable by any
-- authenticated user.
--
-- Idempotent: create table if not exists, drop-policy-then-create, guarded do-blocks.

-- ---------------------------------------------------------------------------
-- Source documents: one row per raw piece of evidence ingested.
-- ---------------------------------------------------------------------------
create table if not exists public.source_documents (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in (
    'news', 'filing', 'transcript', 'government_contract', 'investor_filing',
    'press_release', 'user_upload', 'research_note', 'webhook_message'
  )),
  source_name text,
  source_url text,
  published_at timestamptz,
  fetched_at timestamptz default now(),
  raw_text text,
  clean_text text,
  -- Content checksum (e.g. sha256 of raw_text) so ingestion can dedupe re-fetches.
  checksum text,
  language text default 'en',
  -- 0-100 deterministic quality score for the source itself (publisher reputation,
  -- primary vs secondary, recency) - feeds citation confidence downstream.
  source_quality_score int check (source_quality_score between 0 and 100),
  created_at timestamptz default now()
);

create index if not exists idx_source_documents_type_published
  on public.source_documents(source_type, published_at desc);
create index if not exists idx_source_documents_checksum
  on public.source_documents(checksum);

-- ---------------------------------------------------------------------------
-- Source chunks: retrieval-sized slices of a document.
-- ---------------------------------------------------------------------------
create table if not exists public.source_chunks (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references public.source_documents(id) on delete cascade,
  chunk_index int not null,
  chunk_text text not null,
  token_count int,
  -- NOTE: stored as jsonb (array of floats) for portability. Swap this column to
  -- pgvector `vector(n)` once the pgvector extension is enabled on the project;
  -- until then similarity search happens application-side or via the AI gateway.
  embedding jsonb,
  created_at timestamptz default now(),
  unique(source_document_id, chunk_index)
);

create index if not exists idx_source_chunks_document
  on public.source_chunks(source_document_id);

-- ---------------------------------------------------------------------------
-- Entity registry: canonical things evidence can be about.
-- ---------------------------------------------------------------------------
create table if not exists public.entity_registry (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in (
    'company', 'ticker', 'investor', 'theme', 'supply_chain_node',
    'commodity', 'government_agency', 'person', 'exchange'
  )),
  canonical_name text not null,
  -- jsonb array of alternate names/spellings used during extraction matching.
  aliases jsonb default '[]',
  ticker_symbol text,
  exchange text,
  country text,
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_entity_registry_type_name
  on public.entity_registry(entity_type, canonical_name);
create index if not exists idx_entity_registry_ticker
  on public.entity_registry(ticker_symbol);

-- ---------------------------------------------------------------------------
-- Entity links: which document/chunk mentions which entity, and how it was found.
-- ---------------------------------------------------------------------------
create table if not exists public.entity_links (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid references public.source_documents(id) on delete cascade,
  source_chunk_id uuid references public.source_chunks(id) on delete cascade,
  entity_id uuid not null references public.entity_registry(id) on delete cascade,
  -- 0-1 how relevant the document/chunk is to the entity.
  relevance_score numeric,
  -- The exact text span that supports the link.
  evidence_text text,
  extraction_method text check (extraction_method in ('deterministic', 'ai', 'manual')),
  -- 0-1 extractor confidence; deterministic matches should be 1.
  confidence_score numeric,
  created_at timestamptz default now()
);

create index if not exists idx_entity_links_entity
  on public.entity_links(entity_id);
create index if not exists idx_entity_links_document
  on public.entity_links(source_document_id);

-- ---------------------------------------------------------------------------
-- AI runs: append-only audit record of every LLM invocation.
-- user_id null = system run (scheduled workers); non-null = a user-triggered run.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  agent_name text not null,
  model_provider text,
  model_name text,
  prompt_version text,
  -- Hash of the fully-rendered input so identical runs can be detected/deduped.
  input_hash text,
  input_payload jsonb,
  output_payload jsonb,
  -- 0-1 model/aggregate confidence in the output, where the agent reports one.
  confidence_score numeric,
  -- Evidence scope the run was allowed to see - frozen for auditability.
  source_document_ids uuid[],
  entity_ids uuid[],
  status text not null default 'completed',
  error_message text,
  created_at timestamptz default now()
);

create index if not exists idx_ai_runs_user_time
  on public.ai_runs(user_id, created_at desc);
create index if not exists idx_ai_runs_agent_time
  on public.ai_runs(agent_name, created_at desc);
create index if not exists idx_ai_runs_input_hash
  on public.ai_runs(input_hash);

-- ---------------------------------------------------------------------------
-- AI citations: every claim an AI run makes, pinned to its evidence.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_citations (
  id uuid primary key default gen_random_uuid(),
  ai_run_id uuid not null references public.ai_runs(id) on delete cascade,
  source_document_id uuid references public.source_documents(id) on delete cascade,
  source_chunk_id uuid references public.source_chunks(id) on delete set null,
  -- The claim as the AI phrased it.
  claim_text text not null,
  -- The supporting span from the source.
  evidence_text text,
  -- 0-1 how strongly the evidence supports the claim.
  confidence_score numeric,
  created_at timestamptz default now()
);

create index if not exists idx_ai_citations_run
  on public.ai_citations(ai_run_id);
create index if not exists idx_ai_citations_document
  on public.ai_citations(source_document_id);

-- ---------------------------------------------------------------------------
-- Research dossiers: living synthesis artifacts per entity/theme.
-- ---------------------------------------------------------------------------
create table if not exists public.research_dossiers (
  id uuid primary key default gen_random_uuid(),
  dossier_type text,
  entity_id uuid references public.entity_registry(id) on delete cascade,
  title text not null,
  thesis_summary text,
  bull_case text,
  bear_case text,
  -- jsonb arrays of { claim, source_document_id, weight } style records.
  key_evidence jsonb,
  key_risks jsonb,
  -- Falsifiability: the concrete observations that would invalidate the thesis.
  what_would_prove_wrong text,
  -- 0-1 synthesis confidence.
  confidence_score numeric,
  -- 0-1 decay score: how current the underlying evidence still is.
  freshness_score numeric,
  last_refreshed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_research_dossiers_entity
  on public.research_dossiers(entity_id);

-- ---------------------------------------------------------------------------
-- User research notes: the operator's private research inbox/workflow.
-- ---------------------------------------------------------------------------
create table if not exists public.user_research_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  related_entity_id uuid references public.entity_registry(id) on delete set null,
  note_text text not null,
  status text not null default 'inbox' check (status in (
    'inbox', 'researching', 'watching', 'dismissed', 'archived'
  )),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_user_research_notes_user_status
  on public.user_research_notes(user_id, status);

-- ---------------------------------------------------------------------------
-- Research tasks: actionable follow-ups attached to the research workflow.
-- ---------------------------------------------------------------------------
create table if not exists public.research_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  task_type text,
  related_entity_id uuid references public.entity_registry(id) on delete set null,
  priority text default 'medium',
  status text not null default 'open',
  due_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_research_tasks_user_status
  on public.research_tasks(user_id, status);

-- ---------------------------------------------------------------------------
-- RLS - owner-only CRUD for the user-private research tables.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  user_tables text[] := array[
    'user_research_notes', 'research_tasks'
  ];
begin
  foreach t in array user_tables loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('alter table public.%I enable row level security;', t);
      execute format('drop policy if exists %I on public.%I;', t || '_owner_sel', t);
      execute format('create policy %I on public.%I for select using (auth.uid() = user_id);', t || '_owner_sel', t);
      execute format('drop policy if exists %I on public.%I;', t || '_owner_ins', t);
      execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id);', t || '_owner_ins', t);
      execute format('drop policy if exists %I on public.%I;', t || '_owner_upd', t);
      execute format('create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t || '_owner_upd', t);
      execute format('drop policy if exists %I on public.%I;', t || '_owner_del', t);
      execute format('create policy %I on public.%I for delete using (auth.uid() = user_id);', t || '_owner_del', t);
    end if;
  end loop;
end $$;

-- ai_runs is an append-only audit log with one extra read rule: a user reads their own
-- runs, and system runs (user_id is null) are readable by any authenticated user.
-- Clients may insert runs they own; updates and deletes are intentionally NOT granted
-- so the audit trail cannot be rewritten from the frontend. Workers use the SERVICE
-- ROLE key and bypass RLS.
alter table public.ai_runs enable row level security;
drop policy if exists ai_runs_owner_or_system_sel on public.ai_runs;
create policy ai_runs_owner_or_system_sel on public.ai_runs
  for select to authenticated
  using (user_id is null or auth.uid() = user_id);
drop policy if exists ai_runs_owner_ins on public.ai_runs;
create policy ai_runs_owner_ins on public.ai_runs
  for insert to authenticated
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RLS - shared intelligence tables: authenticated read-only. Writes happen only
-- through backend workers using the SERVICE ROLE key (bypasses RLS).
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  intel_tables text[] := array[
    'source_documents', 'source_chunks', 'entity_registry',
    'entity_links', 'ai_citations', 'research_dossiers'
  ];
begin
  foreach t in array intel_tables loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('alter table public.%I enable row level security;', t);
      execute format('drop policy if exists %I on public.%I;', t || '_read', t);
      execute format('create policy %I on public.%I for select to authenticated using (true);', t || '_read', t);
    end if;
  end loop;
end $$;
