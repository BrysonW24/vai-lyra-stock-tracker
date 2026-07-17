"""Schema pin: the intelligence worker's writes vs migration 049.

The worker wrote one shape while the migrations built another for MONTHS - every write
rejected, "fetched 25 news items but persisted 0", invisible until v0.47.0 made worker
persistence loud. Migration 049 aligned the tables; these pins make the alignment
falsifiable WITHOUT a database: every column the worker writes, and every ON CONFLICT
target it names, must appear in the migration SQL that claims to support it. Rename a
column or a conflict target on either side and this goes red in unit tests, not in a
production night.
"""

import re
from pathlib import Path

MIGRATION = Path("supabase/migrations/049_align_news_intelligence.sql").read_text()
WORKER = Path("workers/intelligence_worker/main.py").read_text()


def migration_columns_for(table: str) -> set[str]:
    """Column names 049 adds or creates for a table (add column + create-table body)."""
    columns: set[str] = set()
    for match in re.finditer(rf"alter table public\.{table} add column if not exists (\w+)", MIGRATION):
        columns.add(match.group(1))
    create = re.search(rf"create table if not exists public\.{table} \((.*?)\);", MIGRATION, re.DOTALL)
    if create:
        for line in create.group(1).splitlines():
            word = line.strip().split(" ")[0]
            if word and word.isidentifier():
                columns.add(word)
    return columns


def worker_record_keys(anchor: str) -> set[str]:
    """The dict-literal keys of the worker's record containing `anchor` - bounded at the
    record's closing brace so keys from the next dict never bleed in."""
    start = WORKER.index(anchor)
    end = WORKER.index("}", start)
    return set(re.findall(r'"(\w+)":', WORKER[start:end]))


def worker_conflict_target(table: str) -> set[str]:
    match = re.search(rf'table\("{table}"\)\.upsert\([^)]*on_conflict="([^"]+)"', WORKER, re.DOTALL)
    assert match, f"no upsert with on_conflict found for {table}"
    return set(match.group(1).split(","))


class TestNewsItemsAlignment:
    def test_every_written_column_exists_in_the_migration(self):
        written = worker_record_keys('"headline": item["headline"]')
        # url and published_at come from 014's original shape; 049 adds the rest.
        legacy_014 = {"url", "published_at", "sentiment", "source"}
        assert written - legacy_014 <= migration_columns_for("news_items")

    def test_conflict_target_is_backed_by_the_full_unique_index(self):
        target = worker_conflict_target("news_items")
        index = re.search(
            r"create unique index if not exists ux_news_items_headline_source\s+"
            r"on public\.news_items\(([^)]+)\)",
            MIGRATION,
        )
        assert index, "the (headline, source) unique index is gone from 049"
        assert target == {c.strip() for c in index.group(1).split(",")}
        # The 041/044 lesson: a partial index cannot back ON CONFLICT.
        assert "where" not in (index.group(0).lower())


class TestTickerNewsMapAlignment:
    def test_every_written_column_exists_in_the_migration(self):
        written = worker_record_keys('"ticker": item["ticker"]')
        legacy_014 = {"relevance_score"}
        assert written - legacy_014 <= migration_columns_for("ticker_news_map")

    def test_conflict_target_matches_the_unique_index(self):
        target = worker_conflict_target("ticker_news_map")
        assert target == {"ticker", "headline", "source"}
        assert "ux_ticker_news_map_ticker_headline_source" in MIGRATION

    def test_legacy_not_nulls_are_relaxed(self):
        # The worker supplies neither news_id nor symbol; without these drops every
        # insert still fails after the columns align.
        assert "alter column news_id drop not null" in MIGRATION
        assert "alter column symbol drop not null" in MIGRATION


class TestHypeScoresAlignment:
    def test_table_exists_in_migrations_at_all(self):
        # It only ever lived in legacy sql/007 - a migrations-built database had NO
        # hype_scores table, so the worker's upsert had nothing to hit.
        assert "create table if not exists public.hype_scores" in MIGRATION

    def test_every_written_column_exists(self):
        written = worker_record_keys('"hype_score": hype_score.hype_score')
        assert written <= migration_columns_for("hype_scores")

    def test_conflict_target_ticker_is_unique(self):
        assert worker_conflict_target("hype_scores") == {"ticker"}
        assert re.search(r"ticker text not null unique", MIGRATION)
