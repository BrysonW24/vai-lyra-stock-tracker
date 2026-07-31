import { Sparkles } from 'lucide-react';

/**
 * Canonical "this text was written by an AI" label, shown above every AI-generated narration
 * (Daily Brief phrasing, signal explainer). Makes the AI-generated nature explicit for the EU AI
 * Act Article 50 transparency obligation (in force 2026-08-02): a user must be able to tell that
 * copy was produced by an AI. The deterministic engine still owns every number - the AI only
 * phrases them - so this is a disclosure, not a disclaimer. Kept in one place so it never drifts.
 */
export function AiGeneratedLabel({ size = 12 }: { size?: number }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f3a33a]">
      <Sparkles size={size} /> Lyra · AI-generated
    </div>
  );
}
