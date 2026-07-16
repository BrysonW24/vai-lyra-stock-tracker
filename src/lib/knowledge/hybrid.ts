/**
 * Hybrid knowledge retriever - the A-tier upgrade over pure lexical retrieval. It keeps the lexical
 * layer's PRECISION (retrieveKnowledge is the admission gate: ticker/market/off-topic queries still
 * return nothing) and adds RANKING QUALITY from the deterministic vector layer (vectorize.ts). It
 * pulls a wider lexical candidate set, then reranks by a fused score - lexical relevance plus
 * char-trigram cosine - so a section that is semantically the best answer but lexically ranked 3rd
 * gets promoted into the top-k. Pure, offline, deterministic; no embeddings, no model, no network.
 *
 * This wraps retrieveKnowledge (stable public API) rather than editing it, so the lexical gate and
 * the vector rerank evolve independently. buildHybridKnowledgeBlock is a drop-in for the chat route.
 */
import knowledgeData from '@/lib/generated/knowledge.json';
import { retrieveKnowledge, type KnowledgeChunk, type KnowledgeHit } from './retrieve';
import { buildVectorIndex, vectorizeQuery, cosine, type VectorIndex } from './vectorize';

const CHUNKS: KnowledgeChunk[] = (knowledgeData as { chunks: KnowledgeChunk[] }).chunks;

let vindex: VectorIndex | null = null;
function getVectorIndex(): VectorIndex {
  if (!vindex) {
    // Heading + title carry more topical signal than body, so include them (title/heading repeated
    // to weight them) alongside the body text.
    vindex = buildVectorIndex(
      CHUNKS.map((c) => ({ id: c.id, text: `${c.docTitle} ${c.heading} ${c.heading} ${c.text}` })),
    );
  }
  return vindex;
}

export interface HybridHit extends KnowledgeHit {
  lexScore: number;
  cosine: number;
  fused: number;
}

/** Weight on lexical relevance vs cosine in the fused score. Lexical leads; cosine reranks. */
const LEX_WEIGHT = 0.6;
const COS_WEIGHT = 0.4;
const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Retrieve the top-k chunks for a query, reranked by fused lexical+cosine score. Precision is
 * inherited from retrieveKnowledge (an empty lexical result stays empty), so hybrid never introduces
 * noise into market/portfolio chat; it only improves the ORDER and top-k selection of real hits.
 */
export function retrieveHybrid(query: string, k = 3): HybridHit[] {
  // Wider candidate pool so the rerank can promote a lexically-lower but semantically-better chunk.
  const candidates = retrieveKnowledge(query, Math.max(k * 3, 9));
  if (candidates.length === 0) return [];

  const qv = vectorizeQuery(query, getVectorIndex());
  const maxLex = Math.max(...candidates.map((c) => c.score)) || 1;
  const scored: HybridHit[] = candidates.map((c) => {
    const cv = getVectorIndex().vectors.get(c.id);
    const cs = cv ? cosine(qv, cv) : 0;
    const lexNorm = c.score / maxLex;
    const fused = LEX_WEIGHT * lexNorm + COS_WEIGHT * cs;
    return { ...c, lexScore: c.score, cosine: round2(cs), fused: round2(fused) };
  });

  return scored.sort((a, b) => b.fused - a.fused || a.id.localeCompare(b.id)).slice(0, k);
}

const MAX_BLOCK_CHARS = 2400;
const MAX_CHUNK_CHARS = 800;

/**
 * Drop-in for buildKnowledgeBlock using the hybrid retriever. Same header + format + budget, so it
 * composes with the GROUNDING guardrail's "use ONLY the context" instruction identically; only the
 * ranking is smarter.
 */
export function buildHybridKnowledgeBlock(query: string): string {
  const hits = retrieveHybrid(query, 3);
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
