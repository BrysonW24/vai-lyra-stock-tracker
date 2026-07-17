"""Scout worker: registry loading, feed parsing, deterministic attachment, clustering.

The scout is the noticing half of the self-learning loop - these tests pin the
properties that keep it honest: sources gate on env keys, parsing never raises,
attachment is conservative (two-letter tickers never match bare), and only signal that
recurs across INDEPENDENT sources becomes an idea candidate.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from workers.scout.attach import attach, detect_symbols
from workers.scout.cluster import cluster_unmapped
from workers.scout.providers import ScoutItem, demo_items, item_id, parse_feed_xml
from workers.scout.sources import ScoutSource, active_sources, load_sources


def src(**over) -> ScoutSource:
    base = dict(
        id="rss-test", kind="rss", name="Test", target="https://example.com/feed",
        niches=("broad",), why="", access="open", cadence="nightly",
    )
    base.update(over)
    return ScoutSource(**base)


def item(title: str, summary: str = "", source_id: str = "s1") -> ScoutItem:
    return ScoutItem(
        id=item_id(None, title), source_id=source_id, source_kind="rss", url=None,
        title=title, summary=summary, published_at=datetime.now(tz=timezone.utc),
    )


class TestSources:
    def test_registry_loads_and_every_row_is_valid(self):
        sources = load_sources()
        assert len(sources) >= 50  # the curated registry is substantial
        for s in sources:
            assert s.kind in {"api", "rss", "x", "crawl"}
            assert s.id.startswith(f"{s.kind}-")

    def test_open_sources_active_env_gated_sources_wait(self, monkeypatch):
        monkeypatch.delenv("SOME_FAKE_KEY", raising=False)
        rows = [src(id="rss-a"), src(id="api-b", kind="api", access="env:SOME_FAKE_KEY"), src(id="x-c", kind="x", access="gated:x-api")]
        assert [s.id for s in active_sources(rows)] == ["rss-a"]
        monkeypatch.setenv("SOME_FAKE_KEY", "k")
        assert [s.id for s in active_sources(rows)] == ["rss-a", "api-b"]

    def test_x_sources_never_activate_without_credentials(self):
        rows = [src(id="x-someone", kind="x", access="gated:x-api")]
        assert active_sources(rows) == []


class TestFeedParsing:
    def test_rss2(self):
        xml = """<rss version="2.0"><channel><item>
          <title>DOE announces award</title><link>https://x.test/a</link>
          <description>Funding news.</description>
          <pubDate>Wed, 16 Jul 2026 10:00:00 GMT</pubDate>
        </item></channel></rss>"""
        items = parse_feed_xml(xml, src())
        assert len(items) == 1
        assert items[0].title == "DOE announces award"
        assert items[0].published_at is not None

    def test_atom(self):
        xml = """<feed xmlns="http://www.w3.org/2005/Atom"><entry>
          <title>Atom entry</title><link href="https://x.test/b"/>
          <summary>Body.</summary><updated>2026-07-16T10:00:00Z</updated>
        </entry></feed>"""
        items = parse_feed_xml(xml, src())
        assert len(items) == 1
        assert items[0].url == "https://x.test/b"

    def test_garbage_degrades_to_empty(self):
        assert parse_feed_xml("not xml at all", src()) == []

    def test_untitled_entries_are_skipped(self):
        xml = "<rss><channel><item><description>no title</description></item></channel></rss>"
        assert parse_feed_xml(xml, src()) == []


class TestAttach:
    def test_theme_phrase_attaches(self):
        a = attach("Uranium enrichment capacity expands", "New centrifuge cascades online.")
        assert "nuclear-uranium" in a.matched_themes

    def test_unrelated_text_is_unmapped(self):
        a = attach("Local bakery wins pie contest", "The crust was praised by judges.")
        assert a.unmapped

    def test_two_letter_ticker_never_matches_bare(self):
        # EU (enCore Energy) as the political entity must not attach as a ticker.
        assert "EU" not in detect_symbols("The EU announced new trade policy today")

    def test_dollar_prefixed_ticker_matches(self):
        assert "EU" in detect_symbols("Watching $EU after the uranium contract news")

    def test_known_long_symbol_matches_bare(self):
        syms = detect_symbols("POWL reported record backlog this quarter")
        assert "POWL" in syms


class TestCluster:
    def test_recurring_entity_across_sources_promotes(self):
        items = [
            item("Commonwealth Fusion Systems raises new round", source_id="s1"),
            item("Commonwealth Fusion Systems signs utility deal", source_id="s2"),
            item("Milestone for Commonwealth Fusion Systems plant", source_id="s3"),
        ]
        out = cluster_unmapped(items)
        assert len(out) == 1
        assert "Commonwealth Fusion Systems" in out[0].title
        assert out[0].dedupe_key.startswith("scout-vertical-")
        assert len(out[0].evidence) == 3
        assert 0 < out[0].confidence <= 90

    def test_single_source_drumbeat_is_ignored(self):
        items = [item(f"Commonwealth Fusion Systems item {i}", source_id="s1") for i in range(5)]
        assert cluster_unmapped(items) == []

    def test_below_min_items_is_ignored(self):
        items = [
            item("Commonwealth Fusion Systems raises", source_id="s1"),
            item("Commonwealth Fusion Systems signs", source_id="s2"),
        ]
        assert cluster_unmapped(items) == []

    def test_demo_items_exercise_the_loop_shape(self):
        assert len(demo_items()) >= 3


class TestDeterminism:
    def test_item_id_is_stable(self):
        assert item_id("https://a.test/x", "Title") == item_id("https://a.test/x", "Title")
        assert item_id("https://a.test/x", "Title") != item_id("https://a.test/y", "Title")


class TestOrchestratorDemoPath:
    def test_run_scout_worker_demo_mode_completes(self, monkeypatch):
        """The full orchestrator must run clean with NO Supabase client - the demo
        promise. Pinned because a refactor once left the demo branch referencing a
        variable only computed on the live path (UnboundLocalError on every keyless run)."""
        from workers.scout import main as scout_main

        class NoRepo:
            client = None

        # Keep the demo path off the network: no active sources -> demo_items().
        monkeypatch.setattr(scout_main, "active_sources", lambda registry=None: [])
        summary = scout_main.run_scout_worker(object(), NoRepo())
        assert summary["status"] == "ok"
        assert summary["items_fetched"] >= 3
        assert summary["items_persisted"] == 0


class FakeLiveRepo:
    client = object()  # truthy is all the orchestrator checks


class TestOrchestratorLivePath:
    """Live-path plumbing with the sinks monkeypatched out - pins the window, the
    saturation flag, retention pruning, and the single shared cluster path."""

    def _run(self, monkeypatch, window):
        from workers.scout import main as scout_main

        monkeypatch.setattr(scout_main, "active_sources", lambda registry=None: [])
        monkeypatch.setattr(scout_main, "_persist_items", lambda repo, items, attachments: len(items))
        monkeypatch.setattr(scout_main, "_prune_old_items", lambda repo: 0)
        monkeypatch.setattr(scout_main, "_load_recent_unmapped", lambda repo, days=14: window)
        monkeypatch.setattr(scout_main, "_file_ideas", lambda repo, candidates: len(candidates))
        return scout_main.run_scout_worker(object(), FakeLiveRepo())

    def test_window_saturation_is_loud_not_silent(self, monkeypatch, caplog):
        """A window read that fills WINDOW_LIMIT means the oldest signal is being dropped.
        That must flag the summary and land an ERROR in the nightly log - silent
        truncation weakens clustering with no red anywhere (the pattern HARNESS.md bans)."""
        from workers.scout import main as scout_main

        window = [item(f"Filler entry {i}", source_id=f"s{i % 7}") for i in range(scout_main.WINDOW_LIMIT)]
        with caplog.at_level(logging.ERROR):
            summary = self._run(monkeypatch, window)
        assert summary["window_saturated"] is True
        assert any("SATURATED" in r.message for r in caplog.records)

    def test_unsaturated_window_stays_quiet(self, monkeypatch):
        summary = self._run(monkeypatch, [])
        assert summary["status"] == "ok"
        assert summary["window_saturated"] is False
        assert summary["items_pruned"] == 0

    def test_live_and_demo_share_one_cluster_path(self, monkeypatch):
        """The same drumbeat that promotes in TestCluster must flow through the live
        orchestrator into ideas_filed - one pipeline, where mode only changes the
        window and the sinks. Guards against the two-path fork ever reappearing."""
        window = [
            item("Commonwealth Fusion Systems raises new round", source_id="s1"),
            item("Commonwealth Fusion Systems signs utility deal", source_id="s2"),
            item("Milestone for Commonwealth Fusion Systems plant", source_id="s3"),
        ]
        summary = self._run(monkeypatch, window)
        assert summary["idea_candidates"] == 1
        assert summary["ideas_filed"] == 1

    def test_prune_runs_on_the_live_path(self, monkeypatch):
        from workers.scout import main as scout_main

        pruned_with: list[object] = []

        def fake_prune(repo):
            pruned_with.append(repo)
            return 42

        monkeypatch.setattr(scout_main, "active_sources", lambda registry=None: [])
        monkeypatch.setattr(scout_main, "_persist_items", lambda repo, items, attachments: len(items))
        monkeypatch.setattr(scout_main, "_prune_old_items", fake_prune)
        monkeypatch.setattr(scout_main, "_load_recent_unmapped", lambda repo, days=14: [])
        monkeypatch.setattr(scout_main, "_file_ideas", lambda repo, candidates: 0)
        summary = scout_main.run_scout_worker(object(), FakeLiveRepo())
        assert summary["items_pruned"] == 42
        assert len(pruned_with) == 1
