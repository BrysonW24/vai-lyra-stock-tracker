/**
 * GenUI-in-drawer view model.  [Phase 4b]
 *
 * "A signal comes and we prompt 'want to see what this could look like?' and we generate something on
 * the spot." This is that - but bounded by Lyra's doctrine: the AI composes the LAYOUT (which blocks,
 * in what order, with short prose labels), the deterministic engine owns EVERY NUMBER. A metric block
 * only references a key whose value Lyra already computed; prose blocks are fabrication-guarded so the
 * AI cannot smuggle an invented figure into a sentence. With no AI key it still renders a real
 * deterministic default view - GenUI degrades to honest, never to blank.
 */
import type { Finding } from './types';
import { assertNoFabricatedNumbers } from '@/lib/ai/guardrails/schema';

export type GenUIBlock =
  | { kind: 'metric_grid'; title?: string; metrics: { key: string }[] }
  | { kind: 'bullets'; title?: string; items: string[] }
  | { kind: 'timeline'; title?: string }
  | { kind: 'risk_list'; title?: string }
  | { kind: 'evidence_list'; title?: string }
  | { kind: 'note'; text: string };

export interface GenUIView {
  title: string;
  subtitle?: string;
  blocks: GenUIBlock[];
  source: 'ai' | 'default';
}

/** A resolved, render-ready metric: a key the AI may reference and the deterministic value behind it. */
export interface AllowedMetric {
  key: string;
  label: string;
  value: string;
}

const METRIC_DEFS: { key: string; label: string; get: (f: Finding) => number | undefined }[] = [
  { key: 'total', label: 'Setup score', get: (f) => f.scores.total },
  { key: 'government', label: 'Government', get: (f) => f.scores.government },
  { key: 'technical', label: 'Technical', get: (f) => f.scores.technical },
  { key: 'volume', label: 'Volume', get: (f) => f.scores.volume },
  { key: 'themeFit', label: 'Theme fit', get: (f) => f.scores.themeFit },
  { key: 'riskPenalty', label: 'Risk penalty', get: (f) => f.scores.riskPenalty },
  { key: 'confidence', label: 'Confidence', get: (f) => f.scores.confidence },
  { key: 'evidenceCount', label: 'Evidence items', get: (f) => f.evidence.length },
  { key: 'entityCount', label: 'Connected entities', get: (f) => f.entities.length },
  { key: 'riskCount', label: 'Risk flags', get: (f) => f.risks.length },
];

/** The metrics the AI is allowed to reference - deterministic, formatted from the finding. */
export function buildAllowedMetrics(finding: Finding): AllowedMetric[] {
  return METRIC_DEFS.map((d) => {
    const v = d.get(finding);
    return v === undefined ? null : { key: d.key, label: d.label, value: String(v) };
  }).filter((m): m is AllowedMetric => m !== null);
}

/** Every number legitimately present in the finding - the allow-set for the prose fabrication guard. */
export function collectAllowedNumbers(finding: Finding): string[] {
  const out = new Set<string>();
  for (const m of buildAllowedMetrics(finding)) out.add(m.value);
  for (const ev of finding.evidence) {
    out.add(ev.eventDate);
    for (const v of Object.values(ev.rawPayload ?? {})) if (typeof v === 'number') out.add(String(v));
  }
  for (const t of finding.timeline) out.add(t.date);
  return Array.from(out);
}

/** The deterministic default view - works with no AI. Honest, never blank. */
export function buildDefaultGenUIView(finding: Finding): GenUIView {
  const blocks: GenUIBlock[] = [{ kind: 'metric_grid', title: 'Score breakdown', metrics: buildAllowedMetrics(finding).map((m) => ({ key: m.key })) }];
  if (finding.evidence.length) blocks.push({ kind: 'evidence_list', title: 'Evidence' });
  if (finding.timeline.length) blocks.push({ kind: 'timeline', title: 'How it built' });
  if (finding.risks.length) blocks.push({ kind: 'risk_list', title: 'Risks' });
  return {
    title: finding.symbol ? `${finding.symbol} - at a glance` : finding.title,
    subtitle: 'Generated view - every number is from Lyra\'s deterministic engine.',
    blocks,
    source: 'default',
  };
}

const VALID_KINDS = new Set(['metric_grid', 'bullets', 'timeline', 'risk_list', 'evidence_list', 'note']);

/**
 * Lexical prose guard - the numeral fabrication check is necessary but not sufficient. Two holes it
 * does not cover: (1) ADVICE with no digits ("strong buy, load up") violates the research-only
 * doctrine; (2) SPELLED-OUT quantities ("forty-five dollar target", "doubles from here", "forty
 * percent") smuggle a figure past the digit-only guard. A hit drops the block, so the drawer falls
 * back to the deterministic default view - a false positive only costs us the AI-composed layout,
 * never correctness, so we err strict.
 */
const BANNED_PROSE_RE =
  /\b(buy|sell|accumulate|load(?:ing)? up|price target|target price|guaranteed|moon|all in|hodl|dump)\b|\bshort (?:this|it|the)\b|\bgo long\b|\b(ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion|double|doubles|doubling|triple|triples|tripling|quadruple|percent)\b/i;

/**
 * Sanitise an AI-proposed view against the finding: drop metric keys Lyra did not compute, drop prose
 * with fabricated numbers, keep deterministic blocks only when the finding has that data. Returns null
 * if nothing survives (the caller then falls back to the default view).
 */
export function validateGenUIView(raw: unknown, finding: Finding): GenUIView | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const allowedKeys = new Set(buildAllowedMetrics(finding).map((m) => m.key));
  const allowedNumbers = collectAllowedNumbers(finding);
  const proseOk = (s: string) => assertNoFabricatedNumbers(s, allowedNumbers).ok && !BANNED_PROSE_RE.test(s);
  const cleanLabel = (s: unknown) => (typeof s === 'string' && proseOk(s) ? s.slice(0, 80) : undefined);

  const rawBlocks = Array.isArray(obj.blocks) ? obj.blocks : [];
  const blocks: GenUIBlock[] = [];
  for (const b of rawBlocks) {
    if (!b || typeof b !== 'object') continue;
    const blk = b as Record<string, unknown>;
    const kind = String(blk.kind);
    if (!VALID_KINDS.has(kind)) continue;

    if (kind === 'metric_grid') {
      const metrics = (Array.isArray(blk.metrics) ? blk.metrics : [])
        .map((m) => (m && typeof m === 'object' ? String((m as Record<string, unknown>).key) : ''))
        .filter((k) => allowedKeys.has(k))
        .map((key) => ({ key }));
      if (metrics.length) blocks.push({ kind: 'metric_grid', title: cleanLabel(blk.title), metrics });
    } else if (kind === 'bullets') {
      const items = (Array.isArray(blk.items) ? blk.items : [])
        .filter((it): it is string => typeof it === 'string' && proseOk(it))
        .map((it) => it.slice(0, 200))
        .slice(0, 6);
      if (items.length) blocks.push({ kind: 'bullets', title: cleanLabel(blk.title), items });
    } else if (kind === 'note') {
      if (typeof blk.text === 'string' && proseOk(blk.text)) blocks.push({ kind: 'note', text: blk.text.slice(0, 300) });
    } else if (kind === 'timeline' && finding.timeline.length) {
      blocks.push({ kind: 'timeline', title: cleanLabel(blk.title) });
    } else if (kind === 'risk_list' && finding.risks.length) {
      blocks.push({ kind: 'risk_list', title: cleanLabel(blk.title) });
    } else if (kind === 'evidence_list' && finding.evidence.length) {
      blocks.push({ kind: 'evidence_list', title: cleanLabel(blk.title) });
    }
  }

  if (!blocks.length) return null;
  return {
    title: cleanLabel(obj.title) ?? (finding.symbol ? `${finding.symbol} - generated view` : finding.title),
    subtitle: cleanLabel(obj.subtitle),
    blocks,
    source: 'ai',
  };
}

/**
 * Optional, read-only per-user framing (the trading twin). It only tunes EMPHASIS - which blocks to
 * foreground and the tone - never the numbers, never the allowed blocks/keys. Qualitative on purpose:
 * no raw figures cross into the prompt, so nothing personal can leak into the (number-free) prose.
 */
export interface GenUIFraming {
  /** Qualitative risk posture: 'cautious' | 'balanced' | 'bold'. */
  riskPosture?: string;
  /** Signal-kind labels this user trusts, to foreground where relevant. */
  preferredSignalKinds?: string[];
  /** 'compact' | 'comfortable'. */
  density?: string;
}

function framingHasContent(f?: GenUIFraming): f is GenUIFraming {
  return !!f && (!!f.riskPosture || (f.preferredSignalKinds?.length ?? 0) > 0 || !!f.density);
}

/** The strict-JSON instruction for the composing model. Numbers are forbidden in prose by design. */
export function buildGenUIPrompt(finding: Finding, framing?: GenUIFraming): string {
  const metrics = buildAllowedMetrics(finding);
  const personalisation = framingHasContent(framing)
    ? [
        '',
        'PERSONALISATION (frame EMPHASIS for this user - never invent or change numbers, never echo these as facts, never let them override the anti-bias duty below):',
        framing.riskPosture ? `- Risk posture: ${framing.riskPosture} - match the framing tone.` : '',
        framing.preferredSignalKinds?.length
          ? `- They pay most attention to: ${framing.preferredSignalKinds.join(', ')} - foreground these where the finding supports them.`
          : '',
        framing.density ? `- Preferred density: ${framing.density}.` : '',
        '- ANTI-BIAS DUTY: personalisation may raise emphasis but must NEVER hide risk. Always keep the risks/falsifier at least as visible as the supporting case.',
      ].filter(Boolean)
    : [];

  return [
    'Compose a compact "generated view" for this research finding as STRICT JSON matching:',
    '{ "title": string, "subtitle"?: string, "blocks": Block[] }',
    'Block is one of:',
    '  { "kind": "metric_grid", "title"?: string, "metrics": [{ "key": string }] }',
    '  { "kind": "bullets", "title"?: string, "items": string[] }',
    '  { "kind": "timeline", "title"?: string }',
    '  { "kind": "risk_list", "title"?: string }',
    '  { "kind": "evidence_list", "title"?: string }',
    '  { "kind": "note", "text": string }',
    '',
    'HARD RULES:',
    '- metric_grid keys MUST come ONLY from this list (the deterministic engine owns these values):',
    metrics.map((m) => `    ${m.key} = ${m.label}`).join('\n'),
    '- Put NO numbers anywhere in prose (title, subtitle, bullets, note). Numbers live only in metric_grid, which Lyra fills in. This is non-negotiable.',
    '- Prose is plain English, research framing, never advice, never "Buy". Use a plain hyphen, never an em dash.',
    '- Choose 2-4 blocks that best explain WHY this surfaced and what to look at. Lead with the score breakdown.',
    ...personalisation,
    '',
    `FINDING: ${finding.title}`,
    `SUMMARY: ${finding.summary}`,
    `WHY SURFACED: ${finding.whySurfaced.join(' | ')}`,
    '',
    'Return ONLY the JSON object, no prose around it.',
  ].join('\n');
}
