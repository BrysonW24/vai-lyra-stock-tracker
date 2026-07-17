## What changed

<!-- One or two sentences. Link the issue if there is one. -->

## Why

<!-- The problem this solves or the behaviour it improves. -->

## How I verified it

- [ ] `npm run type-check` is clean
- [ ] `npm run build` passes
- [ ] `npm run test` passes (required if the change touches tested logic)
- [ ] `npm run lint` is clean

## Ground rules (see CONTRIBUTING.md)

- [ ] Research framing intact - nothing presents output as financial advice
- [ ] The deterministic engine owns every number; AI only phrases results
- [ ] Copy uses plain hyphens, never em/en dashes
- [ ] If shippable code changed (`src` / `supabase` / `workers` / `public`): version bumped via `RELEASES` in `src/lib/version.ts` + `npm run release`
