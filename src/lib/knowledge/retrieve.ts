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
 *
 * Fail-closed contract: questions about the MARKET or the user's money (tickers, buy/sell,
 * positions) must return NOTHING - doc chunks contain worked examples with invented numbers
 * that must never sit in the prompt next to a question about a real holding.
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

/** Words that carry no signal for matching a question to a doc section. Time words and
 *  question fillers ("much", "really") are included deliberately: they appear in both
 *  market questions and doc headings and were the main source of retrieval noise. */
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'did', 'do', 'does', 'for',
  'from', 'get', 'has', 'have', 'how', 'i', 'in', 'is', 'it', 'its', 'many', 'me', 'much',
  'my', 'need', 'now', 'of', 'on', 'or', 'please', 'pls', 'really', 'set', 'should', 'that',
  'the', 'this', 'to', 'today', 'tomorrow', 'up', 'use', 'want', 'was', 'we', 'what', 'when',
  'where', 'which', 'who', 'why', 'will', 'with', 'work', 'yesterday', 'you', 'your',
]);

/** Post-stem markers of a market/advice question. Any one of these fails retrieval closed:
 *  the knowledge base is about Lyra the product, never about what to do with money. */
const MARKET_INTENT = new Set([
  'bought', 'buy', 'buying', 'dip', 'hold', 'invest', 'investing', 'investment', 'portfolio',
  'position', 'sell', 'selling', 'share', 'sold', 'stock', 'ticker', 'worth',
]);

/** ALL-CAPS words that are product vocabulary, not stock tickers. */
const CAPS_ALLOW = new Set([
  'AI', 'API', 'BYOK', 'CLI', 'CSS', 'CSV', 'ENV', 'HTML', 'ID', 'IPO', 'JS', 'JSON', 'KV',
  'MACD', 'OS', 'OSS', 'RSI', 'SDK', 'SQL', 'TS', 'TTL', 'URL', 'VAPID', 'VOL', 'YAML',
]);

/** A 2-5 letter ALL-CAPS word that is not product vocabulary reads as a stock ticker
 *  (NVDA, AAPL, AMD) - the question is about the market, so retrieval fails closed. */
function looksLikeTickerQuestion(raw: string): boolean {
  const caps = raw.match(/\b[A-Z]{2,5}\b/g) ?? [];
  return caps.some((c) => !CAPS_ALLOW.has(c));
}

/** Light plural/3rd-person stem so "works" matches "work" and "alerts" matches "alert".
 *  Applied identically to corpus and query, so it only has to be consistent, not clever. */
function stem(t: string): string {
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    // "set up" / "set-up" / "set this up" all mean setup - otherwise the question
    // "how do I set this up?" tokenizes to nothing (set + up are stopwords)
    .replace(/\bset(?:[\s-]|\s+\w+\s+)?up\b/g, 'setup')
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
  /** Tokens of the source filename - "run" hitting 02-run-it-yourself.md is a strong signal. */
  slugTokens: Set<string>;
  bodyCounts: Map<string, number>;
}

interface KnowledgeIndex {
  chunks: IndexedChunk[];
  /** Inverse document frequency per token - rare product terms (macd, coolify, supabase)
   *  score high; words that appear across the whole corpus (lyra, app) fade out. */
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
        // strip the extension so "01-what-is-lyra.md" yields the token "lyra", not "lyra.md"
        slugTokens: new Set(tokenize(chunk.source.replace(/\.[a-z]+$/i, ''))),
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

/** Absolute score floor for a confident hit (idf-weighted units). */
const MIN_SCORE = 4;
/** Flat per-token bonus when a query token appears in the source FILENAME - the doc named
 *  for the question beats a passing mention, even when the token's idf is tiny ("lyra"). */
const SLUG_BONUS = 1.5;

/**
 * Rank chunks for a query. Retrieval fails closed for market/advice questions (intent
 * markers, ticker-shaped words). Per matched token the contribution is idf-weighted, so a
 * rare product term outweighs any number of common words; heading hits are worth more than
 * body hits; repeated body hits get a dampened bonus; filename hits get a flat bonus. A
 * result must match enough distinct query tokens AND clear a floor - absolute normally,
 * query-relative when every token is corpus-common (so "what is lyra?" still finds the
 * tour doc, whose every word is everywhere in the corpus).
 */
export function retrieveKnowledge(query: string, k = 3): KnowledgeHit[] {
  if (looksLikeTickerQuestion(query)) return [];
  const rawTokens = [...new Set(tokenize(query))];
  if (rawTokens.length === 0) return [];
  if (rawTokens.some((t) => MARKET_INTENT.has(t))) return [];
  const { chunks, idf } = getIndex();
  // Tokens absent from the whole corpus ("myself") can never match - excluding them from
  // the coverage requirement stops them vetoing the doc titled for the question.
  const queryTokens = rawTokens.filter((t) => idf.has(t));
  if (queryTokens.length === 0) return [];
  // Coverage floor: a chunk must match most of a short query (both words of a two-word
  // question) and at least 3 tokens of a long one - a lone incidental word in a doc
  // example can never carry an off-topic question into the knowledge base.
  const n = queryTokens.length;
  const minMatches = n <= 2 ? n : Math.min(3, Math.ceil(n / 2));
  // The best score this query could possibly produce (heading 2.5x + max body bonus 2.5x).
  const maxAchievable = queryTokens.reduce((s, t) => s + (idf.get(t) ?? 0) * 5, 0);

  const hits: KnowledgeHit[] = [];
  for (const { chunk, headingTokens, slugTokens, bodyCounts } of chunks) {
    let score = 0;
    let matches = 0;
    for (const token of queryTokens) {
      const inHeading = headingTokens.has(token);
      const bodyCount = bodyCounts.get(token) ?? 0;
      const inSlug = slugTokens.has(token);
      if (!inHeading && bodyCount === 0 && !inSlug) continue;
      matches += 1;
      const weight = idf.get(token) ?? 0;
      if (inHeading) score += 2.5 * weight;
      if (bodyCount > 0) score += weight * (1 + Math.min(1.5, Math.log1p(bodyCount)));
      if (inSlug) score += SLUG_BONUS;
    }
    // Mild length normalisation: a sprawling chunk (long tables) accrues term-frequency
    // bonuses everywhere; damp it so a focused section on the topic wins.
    score /= 1 + chunk.text.length / 6000;
    const fullMatch = matches === n;
    const clearsFloor = score >= MIN_SCORE || (fullMatch && score >= 0.55 * maxAchievable);
    if (matches >= minMatches && clearsFloor) {
      hits.push({ ...chunk, score: Math.round(score * 100) / 100 });
    }
  }

  return hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, k);
}

const MAX_BLOCK_CHARS = 2400;
const MAX_CHUNK_CHARS = 800;

/**
 * Format retrieved chunks as a KNOWLEDGE prompt block, or '' when the question is not about
 * Lyra itself (no confident hits) - portfolio questions stay lean, product questions get
 * grounded, citable facts. The header declares the block PART OF the grounded context so it
 * cannot conflict with the GROUNDING guardrail's "use ONLY the context" instruction.
 */
export function buildKnowledgeBlock(query: string): string {
  const hits = retrieveKnowledge(query, 3);
  if (hits.length === 0) return '';

  const lines: string[] = [
    'KNOWLEDGE (part of your grounded context - facts from Lyra\'s own documentation; use ONLY if relevant to the question, and name the source doc when you draw on it):',
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
