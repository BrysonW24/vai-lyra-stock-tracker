# Contributing to Lyra

Thanks for taking a look. Lyra is a research-first momentum console, built and maintained by
one person - so contributing works a little differently here than in most repos:

- **Want your own Lyra? Fork it.** Your fork is yours: customize it, rebrand it, deploy it,
  point it at your own data. This is the intended path for builders, and the MIT license
  makes it clean.
- **Found a bug or have an idea? Open an issue.** Bug reports, feature ideas, and feedback
  are very welcome on the
  [issue tracker](https://github.com/BrysonW24/vai-lyra-stock-tracker/issues).
- **Code pull requests: it depends on who is asking.** The codebase is maintainer-driven,
  so a drive-by PR from a stranger will usually be closed with thanks and a pointer to the
  issue tracker. But if we have talked it through in an issue first - or you are one of the
  special ones (you know who you are) - the merge button has been known to move.

## Run it locally (no fork needed)

```bash
git clone https://github.com/BrysonW24/vai-lyra-stock-tracker.git
cd vai-lyra-stock-tracker
npm install && npm run dev      # runs on built-in demo data, no keys needed
```

Open `http://localhost:3042` and you are in. No accounts, no backend, no API keys required to
run against the demo data.

## Make it your own (fork it)

```bash
gh repo fork BrysonW24/vai-lyra-stock-tracker --clone    # or the Fork button on GitHub, then clone YOUR fork
cd vai-lyra-stock-tracker
npm install && npm run dev
```

From here it is your project: commit to your fork, wire up your own keys, deploy your own
instance. The guided path from demo to deployed is the
[walkthroughs](docs/walkthroughs/README.md) (Claude Code users can run the `/setup` skill
chain instead). To pull in upstream improvements later:
`git remote add upstream https://github.com/BrysonW24/vai-lyra-stock-tracker.git` then
`git pull --rebase upstream main` (the `gh repo fork --clone` path sets `upstream` for you).

## Design principles worth keeping

Your fork is free to diverge, but know what you are changing - the product stands on three
rules:

- **Research, not advice.** Nothing presents output as financial advice or a direct
  recommendation. Lyra surfaces setups and risks; the user always decides.
- **Deterministic first.** The scoring engine owns every number. An optional AI layer may
  *phrase* a result, but must never invent or override a value.
- **Dense and scannable.** The UI standard is compact: small type, tight tiles, one eye-line
  where possible. Match the surrounding density rather than adding whitespace.

## Project shape

- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - UI, grouped by feature
- `src/lib/` - data access, formatting, deterministic logic
- `workers/` - the Python scanner + intelligence workers
- `content/` - the **AI-native content layer** (editorial data as JSONL; see below)

## Updating content (no code change needed)

Editorial data (IPOs, smart money, commodities) lives in `content/*.jsonl` - one record per
line. To change a fact, edit the line and rebuild:

```bash
npm run content:build
```

The compile step (also run automatically on `dev` / `build`) turns the JSONL into importable
JSON under `src/lib/generated/`. See [`content/README.md`](content/README.md). Edit the
JSONL, not the generated files.

## Conventions

- **TypeScript strict.** No `any`, no `@ts-ignore` without a one-line reason.
- **Conventional commits:** `type(scope): description` (e.g. `feat(compare): add scrubber`).
- **Plain hyphens only.** Never use em dashes or en dashes in user-facing copy.
- **TanStack Query** for data fetching, **Zod** for runtime validation, **Tailwind** for styling.

## Checks to run before you ship (in your fork)

```bash
npm run type-check     # tsc, must be clean
npm run build          # production build, must pass
npm run test           # if your change touches tested logic
```

## Filing a good issue

- Say what you expected, what actually happened, and the smallest reproduction you have.
- Include your mode (`npm run doctor` tells you: demo / live / AI) and the app version from
  the landing-page badge.
- Feature ideas: describe the problem you are trying to solve, not just the feature - the
  problem is often more useful than the proposed shape.

## Security issues

Never open a public issue or PR containing vulnerability details - use the private path in
[SECURITY.md](SECURITY.md) instead.

## License

Lyra is [MIT licensed](LICENSE) - fork freely. In the rare case a code change is accepted
upstream, it lands under the same license.

Thank you.
