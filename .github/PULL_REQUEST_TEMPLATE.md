> **Before you open this PR:** Lyra is maintainer-driven - the usual path is to
> [fork and build your own](../CONTRIBUTING.md), and to share bugs or ideas on the
> [issue tracker](https://github.com/BrysonW24/vai-lyra-stock-tracker/issues). But if we
> talked this change through in an issue first, or you are one of the special ones
> (you know who you are), carry on below.

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
