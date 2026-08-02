// Token drift check: the canonical table in lyra-ux/TOKENS.md must agree with BOTH mirrors
// (src/styles/lyra-tokens.css and tailwind.config.ts) on every hex value, and all three files
// must state the same version. Run: node lyra-ux/check-tokens.mjs   (CI-friendly: exit 1 on drift)
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const md = read('lyra-ux/TOKENS.md');
const css = read('src/styles/lyra-tokens.css');
const tw = read('tailwind.config.ts');

let failed = false;
const fail = (msg) => { console.error('DRIFT: ' + msg); failed = true; };

// 1. Version agreement.
const mdVersion = md.match(/version:\s*(\d+\.\d+\.\d+)/)?.[1];
const cssVersion = css.match(/v(\d+\.\d+\.\d+)/)?.[1];
const twVersion = tw.match(/v(\d+\.\d+\.\d+)/)?.[1];
if (!mdVersion) fail('TOKENS.md has no version header');
if (mdVersion !== cssVersion) fail(`version mismatch: TOKENS.md ${mdVersion} vs lyra-tokens.css ${cssVersion}`);
if (mdVersion !== twVersion) fail(`version mismatch: TOKENS.md ${mdVersion} vs tailwind.config.ts ${twVersion}`);

// 2. Every palette row in the md table exists with the same hex in both mirrors.
const rows = [...md.matchAll(/`(--lyra-[a-z0-9-]+)`\s*\|[^|]*\|\s*`(#[0-9a-fA-F]{6})`/g)];
if (rows.length < 20) fail(`only ${rows.length} palette rows parsed from TOKENS.md - table format changed?`);
for (const [, varName, hex] of rows) {
  const cssRe = new RegExp(`${varName}:\\s*${hex};`, 'i');
  if (!cssRe.test(css)) fail(`${varName} ${hex} missing or different in lyra-tokens.css`);
  if (!tw.toLowerCase().includes(hex.toLowerCase())) fail(`${hex} (${varName}) missing from tailwind.config.ts`);
}

// 3. No hex in the CSS mirror that the md table does not know about (orphan values).
const cssHexes = [...css.matchAll(/--lyra-[a-z0-9-]+:\s*(#[0-9a-fA-F]{6})/g)].map((m) => m[1].toLowerCase());
const mdHexes = new Set(rows.map(([, , h]) => h.toLowerCase()));
for (const h of cssHexes) {
  if (!mdHexes.has(h)) fail(`lyra-tokens.css carries ${h} which is not in the TOKENS.md palette table`);
}

if (failed) {
  console.error('\nToken drift detected. Fix all three files together and bump the version.');
  process.exit(1);
}
console.log(`OK: tokens v${mdVersion} - TOKENS.md, lyra-tokens.css and tailwind.config.ts agree (${rows.length} palette tokens).`);
