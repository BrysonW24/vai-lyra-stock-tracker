/**
 * Prose guard - the output-side check for FREE-TEXT AI surfaces (chat, brief). The structured
 * paths (agent runs, GenUI) already enforce "the engine owns numbers" mechanically; before this
 * module, chat and brief returned raw model text with the doctrine enforced only by a system-prompt
 * sentence. guardProse() closes that gap: derive the numeral allow-set from the exact grounding the
 * model saw, strip any sentence carrying a fabricated figure (digit or spelled-out), then run the
 * full guardrails engine (injection echo, grounding, regulated advice, content safety) on what
 * remains. Callers refuse when the verdict still blocks.
 *
 * Two rules were added on 2026-11-06, with the move to open-weight models (the same two the
 * workers' guard gained): ADVICE IS LOOKED FOR IN THE WHOLE ANSWER, before anything is stripped -
 * a sentence deleted for an invented figure must not carry its advice out with it and leave the
 * rest to be sent as though the model had behaved - and A SENTENCE THAT FORECASTS IS REMOVED.
 */
import { assertNoFabricatedNumbers } from '@/lib/ai/guardrails/schema';
import { adviceFindings, evaluateGuardrails, predictionFindings, type GuardrailVerdict } from '@/lib/ai/guardrails/engine';

/** Every numeral (int/decimal, with optional thousands separators) present in a string. */
export function numeralsIn(text: string): string[] {
  return text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
}

/**
 * Unit-aware numeral tokens for a grounding allow-set (audit V5). For every numeral it emits the
 * bare value AND - when the numeral carries a magnitude unit the grounding always writes explicitly
 * (a % suffix, an x multiple, or a $ prefix) - the unit-qualified token too. Feeding this to
 * assertNoFabricatedNumbers lets the guard hold a percentage/multiple claim to its own unit: a bare
 * score of 82 in the grounding no longer licenses "up 82%" in the output (the value-set collision
 * the audit flagged), while a genuinely grounded "12%" or "1.5x" still passes. Bare numerals keep
 * value-based grounding so plain restated numbers are never over-stripped.
 */
export function groundedNumberTokens(text: string): string[] {
  const re = /(\$)?(\d[\d,]*(?:\.\d+)?)(%|[xX](?![a-zA-Z]))?/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const [, dollar, value, suffix] = m;
    out.push(value);
    if (suffix === '%') out.push(`${value}%`);
    else if (suffix) out.push(`${value}x`);
    if (dollar) out.push(`$${value}`);
  }
  return out;
}

/** Split text into sentences on terminal punctuation, keeping each sentence's own text. */
export function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
}

/**
 * Spelled-out figures ("forty percent", "doubles from here") smuggle a number past the digit-only
 * fabrication guard. The grounding always provides figures as digits, so a spelled-out magnitude
 * claim in model output is treated as fabricated. Mirrors GenUI's BANNED_PROSE_RE number tail.
 */
const SPELLED_FIGURE_RE =
  /\b(?:(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion)[\s-]*percent|double[sd]?|doubling|triple[sd]?|tripling|quadruple[sd]?)\b/i;

/**
 * Strip every sentence that contains a fabricated figure - a digit numeral absent from the
 * grounding, or a spelled-out magnitude claim. Removing the sentence beats surfacing an invented
 * number; the remaining prose still reads. Returns the cleaned text plus what was flagged.
 */
export function stripFabricatedSentences(
  text: string,
  allowedNumbers: string[],
): { text: string; fabricated: string[] } {
  const digitCheck = assertNoFabricatedNumbers(text, allowedNumbers);
  const hasSpelled = SPELLED_FIGURE_RE.test(text);
  if (digitCheck.ok && !hasSpelled) return { text, fabricated: [] };

  const fabricated: string[] = [];
  const kept = splitSentences(text).filter((sentence) => {
    const sentenceCheck = assertNoFabricatedNumbers(sentence, allowedNumbers);
    if (!sentenceCheck.ok) {
      fabricated.push(...sentenceCheck.fabricated);
      return false;
    }
    const spelled = sentence.match(SPELLED_FIGURE_RE);
    if (spelled) {
      fabricated.push(spelled[0]);
      return false;
    }
    return true;
  });
  return { text: kept.join(' '), fabricated };
}

/** Remove every sentence that forecasts. Returns the rest and why each removed sentence went. */
export function stripPredictions(text: string): { text: string; removed: string[] } {
  if (predictionFindings(text).length === 0) return { text, removed: [] };
  const removed: string[] = [];
  const kept = splitSentences(text).filter((sentence) => {
    const why = predictionFindings(sentence);
    if (why.length === 0) return true;
    removed.push(...why);
    return false;
  });
  return { text: kept.join(' '), removed };
}

export interface GuardedProse {
  /** False when the guarded text must not reach the user (caller refuses / falls back). */
  ok: boolean;
  /** The text to ship when ok - fabricated-figure and forecasting sentences already removed. */
  text: string;
  verdict: GuardrailVerdict;
  /** Figures that were stripped (digits or spelled-out claims). Empty when nothing was removed. */
  strippedFigures: string[];
  /** Why each forecasting sentence was removed (labels, never the sentence). Empty when none was. */
  removedPredictions: string[];
}

/**
 * Guard a free-text model answer against the grounding it was generated from. The allow-set is
 * every numeral in `groundingTexts` (system context, facts block, chat history - the user's own
 * figures are legitimate to echo). Fabrication is repaired by sentence-stripping; advice /
 * injection-echo / empty-after-strip still block.
 */
export function guardProse(text: string, groundingTexts: string[]): GuardedProse {
  // Unit-aware allow-set (audit V5): holds "82%" to a grounded 82%, not to a bare score of 82.
  const allowedNumbers = groundedNumberTokens(groundingTexts.join('\n'));

  // Advice anywhere in what the model wrote blocks the answer - checked before any sentence is
  // stripped, so a stripped sentence cannot take its advice with it.
  if (adviceFindings(text).length > 0) {
    return { ok: false, text: '', verdict: evaluateGuardrails({ text, allowedNumbers }), strippedFigures: [], removedPredictions: [] };
  }

  const stripped = stripFabricatedSentences(text, allowedNumbers);
  const described = stripPredictions(stripped.text);
  const candidate = described.text.trim();
  if (candidate.length === 0) {
    return {
      ok: false,
      text: '',
      verdict: evaluateGuardrails({ text, allowedNumbers }),
      strippedFigures: stripped.fabricated,
      removedPredictions: described.removed,
    };
  }

  const verdict = evaluateGuardrails({ text: candidate, allowedNumbers });
  return {
    ok: verdict.decision !== 'block',
    text: candidate,
    verdict,
    strippedFigures: stripped.fabricated,
    removedPredictions: described.removed,
  };
}
