#!/usr/bin/env node
/**
 * Branded first-run splash - the Lyra wordmark in the tri-gradient, "by Vivacity.ai",
 * printed right before `next dev` hands you the localhost URL. Nothing ships unbranded,
 * even the terminal.
 *
 * Zero dependencies (Node builtins only). It MUST always exit 0: `dev` runs it as
 * `node scripts/splash.mjs && next dev`, so a throw here can never be allowed to stop
 * the dev server from starting. Colour is truecolor ANSI, gracefully skipped when the
 * output is not a TTY or NO_COLOR is set.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

try {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, '..');

  // Version comes from package.json, which `npm run release` keeps in lockstep with version.ts.
  let version = '';
  try {
    version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version || '';
  } catch {
    /* version is decoration; never fatal */
  }

  const useColor =
    (Boolean(process.stdout.isTTY) || Boolean(process.env.FORCE_COLOR)) &&
    !process.env.NO_COLOR &&
    process.env.TERM !== 'dumb';

  // The Lyra tri-gradient (matches src/lib/version.ts / the landing page / the companion).
  const STOPS = [
    [0x3b, 0x5b, 0xdb], // #3b5bdb
    [0x43, 0xd1, 0x8b], // #43d18b
    [0xf3, 0xa3, 0x3a], // #f3a33a
  ];

  const lerp = (a, b, t) => Math.round(a + (b - a) * t);
  function gradientAt(t) {
    const x = Math.max(0, Math.min(1, t));
    if (x <= 0.5) {
      const l = x / 0.5;
      return [0, 1, 2].map((i) => lerp(STOPS[0][i], STOPS[1][i], l));
    }
    const l = (x - 0.5) / 0.5;
    return [0, 1, 2].map((i) => lerp(STOPS[1][i], STOPS[2][i], l));
  }

  const RESET = useColor ? '\x1b[0m' : '';
  const fg = ([r, g, b]) => `\x1b[38;2;${r};${g};${b}m`;
  const DIM = useColor ? '\x1b[2m' : '';
  const BLUE = useColor ? fg([0x1e, 0x63, 0xff]) : '';

  // ANSI-Shadow "LYRA".
  const banner = [
    '██╗   ██╗   ██╗   ██████╗    █████╗ ',
    '██║   ╚██╗ ██╔╝   ██╔══██╗  ██╔══██╗',
    '██║    ╚████╔╝    ██████╔╝  ███████║',
    '██║     ╚██╔╝     ██╔══██╗  ██╔══██║',
    '███████╗ ██║      ██║  ██║  ██║  ██║',
    '╚══════╝ ╚═╝      ╚═╝  ╚═╝  ╚═╝  ╚═╝',
  ];
  const width = Math.max(...banner.map((l) => [...l].length));

  // Colour each glyph by its horizontal position so the gradient sweeps left to right.
  const paint = (line) => {
    if (!useColor) return line;
    const chars = [...line];
    let out = '';
    for (let x = 0; x < chars.length; x++) {
      const ch = chars[x];
      if (ch === ' ') {
        out += ch;
        continue;
      }
      out += fg(gradientAt(x / (width - 1))) + ch;
    }
    return out + RESET;
  };

  const tag = `research-grade oversold-recovery radar${version ? `  ·  v${version}` : ''}`;
  const lines = [
    '',
    ...banner.map((l) => '  ' + paint(l)),
    '',
    `  ${DIM}by${RESET} ${BLUE}Vivacity.ai${RESET}   ${DIM}${tag}${RESET}`,
    '',
  ];

  process.stdout.write(lines.join('\n') + '\n');
} catch {
  // Decoration only - never block the dev server.
}

process.exit(0);
