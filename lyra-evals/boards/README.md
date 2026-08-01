# Model Eval Boards

Versioned visual boards for the Emerging Winner model evaluation. One board per model
generation, so the whole history of "what changed and what it did" stays walkable.

## Index

| board | covers | corpus | headline |
|---|---|---|---|
| `model-eval-board-v1.html` | generation 1 state | `ef1b5c52` | real-v1 promoted at holdout 1.72x; synthetic champion + reference refuted |
| `model-eval-board-v2-vs-v1.html` | generation 2 vs 1 head-to-head | `ef1b5c52` -> `a297e8ad` | frozen champion 1.72x -> 1.94x on richer data; retrained challenger refused |

## Conventions

- **Naming:** `model-eval-board-v{N}-vs-v{N-1}.html` for the comparison board of generation N
  (v1 kept its original single-generation name). Boards are immutable once their generation closes;
  the next generation gets a new file.
- **Narrative + numbers:** every number on a board traces to `../model-metrics-history.jsonl`
  (keyed by corpus sha) or a snapshot in `../generations/gen-NNN/`. The per-generation story lives
  in `../generations/GENERATION-LOG.md`.
- **Graphs must be visible without JavaScript.** Boards draw charts with inline JS, then
  `prerender-board.mjs` bakes the resulting SVGs into the HTML. **Run it before any board ships**:

  ```
  node lyra-evals/boards/prerender-board.mjs lyra-evals/boards/<board>.html
  ```

  It executes the board's own chart code, injects the SVGs, and exits non-zero if any chart panel
  would render empty (or contains NaN/undefined coordinates). A board that fails this gate does
  not ship. The runtime script stays in the file so hover tooltips work where JS runs.
- **Honesty rules carried by every board:** random-sample slice is the headline; CI overlap is
  stated whenever a delta is claimed; champion dev numbers are labelled in-sample-flattered after
  promotion; refused challengers are shown with their numbers; unstable results (e.g. the gen-2
  tier flip) are flagged as open questions, never conclusions.

## Producing the next board

Follow `.claude/commands/model-generation-eval.md` (`/model-generation-eval`) - it walks the whole
cycle: verify the generation's records, extract both generations' numbers, build the comparison
board from the previous one, pre-render + verify graphs, cross-check every number against sources,
append the GENERATION-LOG entry, snapshot reports into `../generations/gen-NNN/`, and republish
the artifact.
