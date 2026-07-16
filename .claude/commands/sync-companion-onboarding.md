# /sync-companion-onboarding - keep the HTML Setup Companion in parity with the codebase

You are updating the **html** onboarding surface: the Setup Companion
(`docs/onboarding/setup-companion.html`), the in-app copy (`public/setup-companion.html`),
and its twins on the landing page (`src/components/landing/StackSection.tsx` +
`UltimateGoals.tsx`). Goal: what the companion SHOWS matches what the codebase IS.

Spec of record: the "Setup Companion - the spec" section of `ONBOARDING.md`. Read it first.

## Do

1. **Scope the drift.** Run `npm run check:onboarding` (or `... --json`). It flags stack tiles,
   goal cards, missing logos, and the served-copy sync. Also diff the stack against reality:
   - `package.json` dependencies + `CLAUDE.md` "Tech Stack" -> the 16 stack tiles (name, one-line
     role, cost badge). A new/removed core technology means a tile changes.
   - `COSTS.md` -> every cost badge on a tile (free / optional / paid + the dollar figure).
   - `src/lib/version.ts` -> nothing hardcoded; the landing badge is dynamic, the companion has
     no version string. If you ever add one, it must read, not hardcode.
2. **Edit the source companion only** (`docs/onboarding/setup-companion.html`). Keep the duo
   brand system, the flip-card structure, honest status badges (WhatsApp = architecture-only,
   live bot = destination), plain hyphens (never an em dash), and `prefers-reduced-motion`
   coverage. Logos stay embedded as data URIs; if you add a technology, embed a real logo, do
   not leave a glyph placeholder unless a real mark genuinely does not exist.
3. **Keep the landing twins in step.** The companion's stack tiles and 6 goal cards must tell the
   SAME story as `StackSection.tsx` / `UltimateGoals.tsx`. If you change one, change the other.
   Landing logos live in `public/logos/` - export any new one there.
4. **Never hand-copy the served file.** `npm run content:build` regenerates
   `public/setup-companion.html` from the source. Run it; do not `cp`.

## Gate (must pass before you are done)

- `npm run content:build` (syncs the served copy) then `npm run check:onboarding` -> `ok`.
- `npm run type-check` if you touched the landing `.tsx`.
- Open `docs/onboarding/setup-companion.html` in a browser at 375px and full width - the flip
  cards work, nothing overflows, animation is calm.

Then hand back to `/onboarding-parity` (or rebuild knowledge + commit if run standalone).
