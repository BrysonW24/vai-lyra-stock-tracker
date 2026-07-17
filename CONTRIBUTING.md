# Contributing to Lyra

Thanks for taking a look. Lyra is a research-first momentum console, and contributions that
keep it fast, honest, and dense are very welcome. This guide gets you productive in a few
minutes.

## Quick start

**Just running it locally?** A plain clone is fine:

```bash
git clone https://github.com/BrysonW24/vai-lyra-stock-tracker.git
cd vai-lyra-stock-tracker
npm install && npm run dev      # runs on built-in demo data, no keys needed
```

**Contributing a change?** Work from a fork - you cannot push branches to this repo directly:

```bash
gh repo fork BrysonW24/vai-lyra-stock-tracker --clone    # or the Fork button on GitHub, then clone YOUR fork
cd vai-lyra-stock-tracker
npm install
git checkout -b feat/my-change
# ...make your change...
git push -u origin feat/my-change     # pushes to your fork
```

Then open a pull request against `BrysonW24/vai-lyra-stock-tracker` `main`. To keep a
button-forked clone current, add the source as `upstream` and rebase on it:
`git remote add upstream https://github.com/BrysonW24/vai-lyra-stock-tracker.git` then
`git pull --rebase upstream main` (the `gh repo fork --clone` path sets `upstream` up for you).

Open http://localhost:3042 and you are in. No accounts, no backend, no API keys required to
develop against the demo data.

## Ground rules (please read)

- **Research, not advice.** Do not add features that present output as financial advice or a
  direct recommendation. Lyra surfaces setups and risks; the user always decides. Keep the
  "not advice" framing intact.
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

## Before you open a PR

```bash
npm run type-check     # tsc, must be clean
npm run build          # production build, must pass
npm run test           # if your change touches tested logic
```

Keep PRs focused, fill in the pull-request template (it loads automatically when you open a
PR), and describe what you verified.

## Security issues

Never open a public issue or PR containing vulnerability details - use the private path in
[SECURITY.md](SECURITY.md) instead.

## License

By contributing, you agree that your contributions are licensed under the repository's
[MIT License](LICENSE).

Thank you.
