// Token drift check (v1.1.0 themed): the canonical table in lyra-ux/TOKENS.md must agree with both
// mirrors (src/styles/lyra-tokens.css and tailwind.config.ts) on every value, for BOTH themes.
// Enforces: version agreement; each token's dark hex + rgb-channel triplet in the :root block; each
// token's light hex + rgb-channel triplet in the :root[data-theme="light"] block; the rgb triplets
// are the exact channel decomposition of their hex; and tailwind references var(--lyra-x-rgb).
// Run: node lyra-ux/check-tokens.mjs   (exit 1 on drift)
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const md = read('lyra-ux/TOKENS.md');
const css = read('src/styles/lyra-tokens.css');
const tw = read('tailwind.config.ts');

let failed = false;
const fail = (msg) => { console.error('DRIFT: ' + msg); failed = true; };

const hexToRgb = (hex) => {
  const n = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)).join(' ');
};

// Extract a flat CSS block's body by its selector (no nested braces in lyra-tokens.css).
const block = (selectorLiteral) => {
  const i = css.indexOf(selectorLiteral);
  if (i < 0) return null;
  const open = css.indexOf('{', i);
  const close = css.indexOf('}', open);
  return open < 0 || close < 0 ? null : css.slice(open + 1, close);
};

// 1. Version agreement.
const mdVersion = md.match(/version:\s*(\d+\.\d+\.\d+)/)?.[1];
const cssVersion = css.match(/v(\d+\.\d+\.\d+)/)?.[1];
const twVersion = tw.match(/v(\d+\.\d+\.\d+)/)?.[1];
if (!mdVersion) fail('TOKENS.md has no version header');
if (mdVersion !== cssVersion) fail(`version mismatch: TOKENS.md ${mdVersion} vs lyra-tokens.css ${cssVersion}`);
if (mdVersion !== twVersion) fail(`version mismatch: TOKENS.md ${mdVersion} vs tailwind.config.ts ${twVersion}`);

const darkBlock = block(':root {') ?? block(':root{');
const lightBlock = block(":root[data-theme='light']") ?? block(':root[data-theme="light"]');
if (!darkBlock) fail('cannot find the :root (dark default) block in lyra-tokens.css');
if (!lightBlock) fail('cannot find the :root[data-theme="light"] block in lyra-tokens.css');

// 2. Every palette row: `--lyra-x` | twname | `#dark` | `#light` | role.
const rows = [...md.matchAll(/`(--lyra-[a-z0-9-]+)`\s*\|[^|]*\|\s*`(#[0-9a-fA-F]{6})`\s*\|\s*`(#[0-9a-fA-F]{6})`/g)];
if (rows.length < 20) fail(`only ${rows.length} palette rows parsed from TOKENS.md - table format changed?`);

const checkVar = (blk, blkName, varName, hex) => {
  const hexRe = new RegExp(`${varName}:\\s*${hex}\\s*;`, 'i');
  if (blk && !hexRe.test(blk)) fail(`${varName} ${hex} missing or different in ${blkName}`);
  const rgbRe = new RegExp(`${varName}-rgb:\\s*([0-9]{1,3} [0-9]{1,3} [0-9]{1,3})\\s*;`);
  const m = blk && blk.match(rgbRe);
  if (!m) { fail(`${varName}-rgb missing in ${blkName}`); return; }
  const want = hexToRgb(hex);
  if (m[1] !== want) fail(`${varName}-rgb is "${m[1]}" in ${blkName} but ${hex} decodes to "${want}"`);
};

for (const [, varName, darkHex, lightHex] of rows) {
  checkVar(darkBlock, ':root (dark)', varName, darkHex);
  checkVar(lightBlock, ':root[data-theme=light]', varName, lightHex);
  // Tailwind must consume the rgb channel var (not a baked hex) so utilities re-theme.
  if (!tw.includes(`--lyra-${varName.replace('--lyra-', '')}-rgb`)) {
    fail(`tailwind.config.ts does not reference var(${varName}-rgb) - utilities for this token will not theme`);
  }
}

if (failed) {
  console.error('\nToken drift detected. Fix all three files together and bump the version.');
  process.exit(1);
}
console.log(`OK: tokens v${mdVersion} - TOKENS.md, lyra-tokens.css and tailwind.config.ts agree across dark + light (${rows.length} palette tokens).`);
