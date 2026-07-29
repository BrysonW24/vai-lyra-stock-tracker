# growth/ - Lyra growth surfaces + experiments

Landing configuration, acquisition experiments, and growth-loop assets. A stable technical folder
(not a `lyra-*` operating domain) - see [`../lyra-folder-convention.md`](../lyra-folder-convention.md).
Founder-facing campaign/channel strategy lives in [`../lyra-marketing/`](../lyra-marketing/); this
folder holds the machine-readable growth config and experiment records.

Expected artifacts (mirrors `vd-mobile-apps/_template/growth/`):

- `landing.yaml` - landing-page copy/config blocks the site build reads.
- Experiment records (one file per experiment: hypothesis, variant, metric, result).

Note: Lyra's live landing surface renders from `src/app/welcome/` + `src/components/landing/`; this
folder is the config/experiment home, not the rendered page.
