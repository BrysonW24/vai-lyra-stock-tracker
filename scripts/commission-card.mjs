#!/usr/bin/env node
/**
 * Write a PRIVATE commissioning card into this clone once setup reaches a healthy deploy.
 *
 *   npm run commission -- --minutes 14 --url https://your-lyra.vercel.app --name Sam
 *
 * Produces commission/card.svg (a branded receipt) and COMMISSIONED.md (its plain-text twin).
 * Both are gitignored - this is a local keepsake, never shared anywhere. If --url is given, the
 * card's version + mode are read from that deploy's /api/health; otherwise they come from
 * package.json and --mode. All string-building lives in ./lib/commission-card.mjs (pure + tested).
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCommissionSvg, buildCommissionMarkdown } from './lib/commission-card.mjs';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    out[key] = next && !next.startsWith('--') ? argv[++i] : 'true';
  }
  return out;
}
const val = (v) => (v && v !== 'true' ? v : undefined);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));

let version = '';
try {
  version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version || '';
} catch {
  /* version is decorative here; never fatal */
}

let mode = val(args.mode);
const deployedUrl = val(args.url) || '';

// Best-effort: read the real version + mode straight from the deploy's health probe.
if (deployedUrl) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${deployedUrl.replace(/\/$/, '')}/api/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const health = await res.json();
      if (health.version) version = health.version;
      if (health.mode) mode = health.mode;
    }
  } catch {
    /* offline or not deployed yet - fall back to package.json + --mode */
  }
}

const data = {
  name: val(args.name),
  minutes: val(args.minutes),
  version,
  mode,
  date: new Date(),
  deployedUrl,
};

const outDir = resolve(root, val(args.out) || 'commission');
mkdirSync(outDir, { recursive: true });
const svgPath = resolve(outDir, 'card.svg');
const mdPath = resolve(root, 'COMMISSIONED.md');
writeFileSync(svgPath, buildCommissionSvg(data));
writeFileSync(mdPath, buildCommissionMarkdown(data));

console.log(
  `\nCommissioning card written (private - gitignored):\n  ${svgPath}\n  ${mdPath}\n\n  Open it:  open ${svgPath}\n`,
);
