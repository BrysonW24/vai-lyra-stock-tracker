-- 016_seed_initial_data.sql
-- Seed shared reference data. Idempotent via on-conflict. The full ticker universe is
-- upserted by the scanner worker's universe loader; here we seed the universe groups
-- and a couple of education placeholders so the app has something to read on day one.

insert into public.stock_universes (code, name, description, is_default) values
  ('us_tech_100', 'US Tech 100', 'Core US technology universe scanned by Lyra.', true),
  ('semiconductors', 'Semiconductors', 'Chipmakers and semiconductor equipment.', false),
  ('ai_infrastructure', 'AI Infrastructure', 'Compute, networking and data-centre buildout.', false),
  ('cybersecurity', 'Cybersecurity', 'Security software and identity.', false),
  ('cloud_enterprise', 'Cloud & Enterprise', 'Cloud data and enterprise software.', false)
on conflict (code) do nothing;

insert into public.education_modules (slug, title, category, level, summary) values
  ('what-is-momentum', 'What is momentum?', 'foundations', 'beginner', 'How price momentum works and why it matters.'),
  ('reading-rsi', 'Reading RSI', 'indicators', 'beginner', 'What the RSI line is telling you.'),
  ('macd-explained', 'MACD explained', 'indicators', 'beginner', 'Reading the MACD histogram and signal line.'),
  ('what-is-a-setup', 'What is a setup?', 'foundations', 'beginner', 'How Lyra scores a setup 0-100 and what that means.')
on conflict (slug) do nothing;
