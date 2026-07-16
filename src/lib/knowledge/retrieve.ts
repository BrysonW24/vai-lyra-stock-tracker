/**
 * Deterministic retrieval over Lyra's own docs (the knowledge layer).
 *
 * The corpus is compiled at build time by scripts/build-knowledge.mjs from the walkthroughs,
 * runbooks, COSTS.md and the other reference docs into src/lib/generated/knowledge.json.
 * Retrieval is plain lexical scoring - no embeddings, no network, no model - so it runs
 * identically in demo mode, tests, and every deploy, and a given query always returns the
 * same chunks. The AI layer then PHRASES from these chunks and cites the source doc; it
 * remains the engine-explains-AI-phrases contract, extended from dashboard numbers to
 * product knowledge.
 */
import knowledgeData from '@/lib/generated/knowledge.json';

export interface KnowledgeChunk {
  id: string;
  source: string;
  docTitle: string;
  heading: string;
  text: string;
}

export interface KnowledgeHit extends KnowledgeChunk {
  score: number;
}

const CHUNKS: KnowledgeChunk[] = (knowledgeData as { chunks: KnowledgeChunk[] }).chunks;

/** Words that carry no signal for matching a question to a doc section. Time words are
 *  included deliberately: "today"/"now" appear in both market questions and doc headings
 *  ("works today") and were the main source of false-positive retrieval. */
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'did', 'do', 'does', 'for',
  'from', 'get', 'has', 'have', 'how', 'i', 'in', 'is', 'it', 'its', 'me', 'my', 'need', 'now',
  'of', 'on', 'or', 'set', 'that', 'the', 'this', 'to', 'today', 'tomorrow', 'up', 'use',
  'want', 'was', 'we', 'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with', 'work',
  'yesterday', 'you', 'your',
]);

/** Light plural/3rd-person stem so "works" matches "work" and "alerts" matches "alert".
 *  Applied identically to corpus and query, so it only has to be consistent, not clever. */
function stem(t: string): string {
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9.$]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[.$]+|[.$]+$/g, ''))
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
    .map(stem)
    .filter((t) => !STOPWORDS.has(t)); // catch stems of stopwords too ("works" -> "work")
}

interface IndexedChunk {
  chunk: KnowledgeChunk;
  headingTokens: Set<string>;
  bodyCounts: Map<string, number>;
}

interface KnowledgeIndex {
  chunks: IndexedChunk[];
  /** Inverse document frequency per token - rare product terms (macd, coolify, supabase)
   *  score high; words that appear across the whole corpus (works, today, app) fade out. */
  idf: Map<string, number>;
}

/** Index once per process - the corpus is a static import, so this is cheap and stable. */
let index: KnowledgeIndex | null = null;
function getIndex(): KnowledgeIndex {
  if (!index) {
    const chunks = CHUNKS.map((chunk) => {
      const bodyCounts = new Map<string, number>();
      for (const t of tokenize(chunk.text)) bodyCounts.set(t, (bodyCounts.get(t) ?? 0) + 1);
      return {
        chunk,
        headingTokens: new Set(tokenize(`${chunk.docTitle} ${chunk.heading}`)),
        bodyCounts,
      };
    });
    const df = new Map<string, number>();
    for (const c of chunks) {
      const seen = new Set([...c.headingTokens, ...c.bodyCounts.keys()]);
      for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
    }
    const n = chunks.length;
    const idf = new Map<string, number>();
    for (const [t, d] of df) idf.set(t, Math.log((n + 1) / (d + 1)));
    index = { chunks, idf };
  }
  return index;
}

/** Minimum total score for a chunk to count as a confident hit (idf-weighted units). */
const MIN_SCORE = 4;

/**
 * Rank chunks for a query. Per matched token the contribution is idf-weighted, so a rare
 * product term outweighs any number of common words; heading hits are worth more than body
 * hits (a section titled for the topic beats a passing mention), repeated body hits get a
 * dampened bonus. A result must match at least two distinct query tokens (or one for a
 * single-token query) AND clear the score floor, so portfolio/market questions return
 * nothing instead of noise.
 */
export function retrieveKnowledge(query: string, k = 3): KnowledgeHit[] {
  const queryTokens = [...new Set(tokenize(query))];
  if (queryTokens.length === 0) return [];
  // Coverage floor: a chunk must match most of a short query (both words of a two-word
  // question) and at least 3 tokens of a long one - a lone incidental word ("NVDA" in a
  // doc example) can never carry a portfolio question into the knowledge base.
  const n = queryTokens.length;
  const minMatches = n <= 2 ? n : Math.min(3, Math.ceil(n / 2));
  const { chunks, idf } = getIndex();

  const hits: KnowledgeHit[] = [];
  for (const { chunk, headingTokens, bodyCounts } of chunks) {
    let score = 0;
    let matches = 0;
    for (const token of queryTokens) {
      const inHeading = headingTokens.has(token);
      const bodyCount = bodyCounts.get(token) ?? 0;
      if (!inHeading && bodyCount === 0) continue;
      matches += 1;
      const weight = idf.get(token) ?? 0;
      if (inHeading) score += 2.5 * weight;
      if (bodyCount > 0) score += weight * (1 + Math.min(1.5, Math.log1p(bodyCount)));
    }
    // Mild length normalisation: a sprawling chunk (long tables) accrues term-frequency
    // bonuses everywhere; damp it so a focused section on the topic wins.
    score /= 1 + chunk.text.length / 6000;
    if (matches >= minMatches && score >= MIN_SCORE) hits.push({ ...chunk, score: Math.round(score * 100) / 100 });
  }

  return hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, k);
}

const MAX_BLOCK_CHARS = 2400;
const MAX_CHUNK_CHARS = 800;

/**
 * Format retrieved chunks as a KNOWLEDGE prompt block, or '' when the question is not about
 * Lyra itself (no confident hits) - portfolio questions stay lean, product questions get
 * grounded, citable facts. The block instructs the model to cite the doc it drew from.
 */
export function buildKnowledgeBlock(query: string): string {
  const hits = retrieveKnowledge(query, 3);
  if (hits.length === 0) return '';

  const lines: string[] = [
    'KNOWLEDGE (from Lyra\'s own documentation - use ONLY if relevant to the question, and name the source doc when you draw on it):',
  ];
  let used = lines[0].length;
  for (const hit of hits) {
    let text = hit.text;
    if (text.length > MAX_CHUNK_CHARS) {
      const cut = text.lastIndexOf(' ', MAX_CHUNK_CHARS);
      text = `${text.slice(0, cut > 0 ? cut : MAX_CHUNK_CHARS)} ...`;
    }
    const entry = `[${hit.source} - ${hit.heading}] ${text}`;
    if (used + entry.length > MAX_BLOCK_CHARS) break;
    lines.push(entry);
    used += entry.length;
  }
  return lines.length > 1 ? lines.join('\n') : '';
}
