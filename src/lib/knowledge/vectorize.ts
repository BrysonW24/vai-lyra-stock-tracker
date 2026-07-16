/**
 * Deterministic, offline vector layer for the knowledge retriever - the semantic-ish half of the
 * hybrid retriever. It builds a sparse TF-IDF vector per document over TWO feature families:
 *  - word features   `w:<token>`  - exact term overlap (what pure lexical already does)
 *  - char-trigram    `g:<tri>`     - fuzzy overlap, so "deploy"~"deploying", "supabase"~"supabase's",
 *                                    and typos partially match WITHOUT any embedding model or network.
 *
 * Cosine similarity over these vectors gives a morphology/typo-robust semantic-ish score. Everything
 * is pure and computed in-process from the compiled corpus, so it runs identically in demo, tests,
 * and every deploy, and a query always yields the same score. No embeddings, no model, no network -
 * the knowledge-layer doctrine is preserved, just made smarter.
 */

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'did', 'do', 'does', 'for',
  'from', 'get', 'has', 'have', 'how', 'i', 'in', 'is', 'it', 'its', 'me', 'my', 'need', 'now',
  'of', 'on', 'or', 'set', 'that', 'the', 'this', 'to', 'today', 'tomorrow', 'up', 'use',
  'want', 'was', 'we', 'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with', 'work',
  'yesterday', 'you', 'your',
]);

/** Light plural/3rd-person stem, applied identically to corpus and query (consistent, not clever). */
function stem(t: string): string {
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9.$]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[.$]+|[.$]+$/g, ''))
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
    .map(stem)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/** Padded character trigrams of a token: "macd" -> "^ma","mac","acd","cd$". */
function trigrams(token: string): string[] {
  const padded = `^${token}$`;
  const out: string[] = [];
  for (let i = 0; i + 3 <= padded.length; i++) out.push(padded.slice(i, i + 3));
  return out;
}

/** Char-trigram features are worth less than an exact word match, but catch morphology/typos. */
const TRIGRAM_WEIGHT = 0.4;

/** Raw feature counts for a piece of text: word features (weight 1) + trigram features (downweighted). */
function featureCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (f: string, w: number) => counts.set(f, (counts.get(f) ?? 0) + w);
  for (const tok of tokens(text)) {
    add(`w:${tok}`, 1);
    for (const tri of trigrams(tok)) add(`g:${tri}`, TRIGRAM_WEIGHT);
  }
  return counts;
}

export interface DocVector {
  weights: Map<string, number>;
  norm: number;
}

export interface VectorIndex {
  idf: Map<string, number>;
  vectors: Map<string, DocVector>;
}

function toVector(counts: Map<string, number>, idf: Map<string, number>): DocVector {
  const weights = new Map<string, number>();
  let sumSq = 0;
  for (const [f, c] of counts) {
    const w = c * (idf.get(f) ?? 0);
    if (w === 0) continue;
    weights.set(f, w);
    sumSq += w * w;
  }
  return { weights, norm: Math.sqrt(sumSq) };
}

/** Build an in-process TF-IDF vector index over the given documents. Deterministic. */
export function buildVectorIndex(docs: Array<{ id: string; text: string }>): VectorIndex {
  const rawCounts = docs.map((d) => ({ id: d.id, counts: featureCounts(d.text) }));
  const df = new Map<string, number>();
  for (const { counts } of rawCounts) {
    for (const f of counts.keys()) df.set(f, (df.get(f) ?? 0) + 1);
  }
  const n = rawCounts.length;
  const idf = new Map<string, number>();
  for (const [f, d] of df) idf.set(f, Math.log((n + 1) / (d + 1)) + 1);

  const vectors = new Map<string, DocVector>();
  for (const { id, counts } of rawCounts) vectors.set(id, toVector(counts, idf));
  return { idf, vectors };
}

/** Vectorize free text against an index's idf (for a query). */
export function vectorizeQuery(text: string, index: VectorIndex): DocVector {
  return toVector(featureCounts(text), index.idf);
}

/** Cosine similarity in [0,1] between two sparse vectors (0 when either is empty). */
export function cosine(a: DocVector, b: DocVector): number {
  if (a.norm === 0 || b.norm === 0) return 0;
  // Iterate the smaller map for the dot product.
  const [small, large] = a.weights.size <= b.weights.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [f, w] of small.weights) {
    const o = large.weights.get(f);
    if (o) dot += w * o;
  }
  return dot / (a.norm * b.norm);
}
