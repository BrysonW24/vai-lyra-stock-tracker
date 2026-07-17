#!/usr/bin/env node
/**
 * Knowledge pipeline - compiles the repo's own reference docs (walkthroughs, runbooks,
 * COSTS, README, ...) into retrievable chunks at src/lib/generated/knowledge.json, so the
 * in-app AI can answer questions about Lyra itself (setup, deployment, costs, how the score
 * works) with grounded, citable facts instead of guessing.
 *
 * Chunking: one chunk per markdown heading section (## / ###); long sections split on
 * paragraph boundaries. Deterministic output (stable ids, stable order) so the generated
 * file only changes when the docs change.
 *
 *   node scripts/build-knowledge.mjs   (also runs automatically after build-content.mjs)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'src', 'lib', 'generated');

/** Curated sources - the docs a user would ask the in-app AI about. Order = output order. */
const SOURCES = [
  'README.md',
  'QUICKSTART.md',
  'ONBOARDING.md',
  'AGENT-ONBOARDING.md',
  'COSTS.md',
  // TODO(joint pass): add 'DATA-ECONOMICS.md' + 'LOOPS.md' so the copilot can answer cost/loop
  // questions - blocked on extending the labelled eval set in src/lib/knowledge/__tests__ first:
  // adding them today flips one eval query's top-1 under the hybrid rerank (recall@1 0.917 ->
  // 0.833) and reds the hybrid>=lexical quality gate. Corpus and eval set must move together.
  'SECURITY.md',
  'DISCLAIMER.md',
  'docs/walkthroughs/01-what-is-lyra.md',
  'docs/walkthroughs/02-run-it-yourself.md',
  'docs/walkthroughs/03-go-live-supabase.md',
  'docs/walkthroughs/04-deploy-your-own.md',
  'docs/walkthroughs/05-understand-the-score.md',
  'docs/walkthroughs/06-alerts-on-your-phone.md',
  'docs/runbooks/coolify-deploy.md',
  'docs/tradingview-copilot.md',
];

const MAX_CHUNK_CHARS = 1800;

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

/** Drop markdown noise that hurts retrieval without losing commands or tables. */
function cleanText(text) {
  return text
    .replace(/<img[^>]*>/g, '')
    .replace(/<\/?p[^>]*>/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // keep link text, drop URLs
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitLong(text) {
  if (text.length <= MAX_CHUNK_CHARS) return [text];
  const parts = [];
  let current = '';
  for (const para of text.split(/\n\n+/)) {
    if (current && current.length + para.length + 2 > MAX_CHUNK_CHARS) {
      parts.push(current.trim());
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const chunks = [];
for (const source of SOURCES) {
  const path = join(root, source);
  if (!existsSync(path)) {
    console.error(`knowledge: MISSING source ${source} - update SOURCES in scripts/build-knowledge.mjs`);
    process.exitCode = 1;
    continue;
  }
  const raw = readFileSync(path, 'utf8');
  const docTitle = raw.match(/^#\s+(.+)$/m)?.[1]?.replace(/[#*`]/g, '').trim() ?? source;

  // Split the doc into heading-led sections. The preamble before the first ## stays with the title.
  const sections = raw.split(/\n(?=##\s)/);
  for (const section of sections) {
    const headingMatch = section.match(/^#{2,3}\s+(.+)$/m);
    const heading = headingMatch ? headingMatch[1].replace(/[#*`]/g, '').trim() : docTitle;
    const body = cleanText(section.replace(/^#{1,3}\s+.+$/m, ''));
    if (body.length < 80) continue; // navigation stubs and empty sections carry no facts
    for (const [i, part] of splitLong(body).entries()) {
      chunks.push({
        id: `${slug(source)}--${slug(heading)}${i > 0 ? `--${i}` : ''}`,
        source,
        docTitle,
        heading,
        text: part,
      });
    }
  }
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'knowledge.json'), `${JSON.stringify({ version: 1, chunks }, null, 2)}\n`);
console.log(`knowledge: ${chunks.length} chunks from ${SOURCES.length} docs -> src/lib/generated/knowledge.json`);
