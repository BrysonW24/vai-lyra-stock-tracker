import type { EconomyVerdict } from '@/lib/economy/types';
import { VERDICT_LABEL, VERDICT_TONE } from '@/components/economy/economy-format';

/** A verdict, as a quiet chip. The label is always text - colour is never the only signal. */
export function VerdictChip({ verdict, prefix }: { verdict: EconomyVerdict; prefix?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${VERDICT_TONE[verdict]}`}
    >
      {prefix && <span className="text-ink-3">{prefix}</span>}
      {VERDICT_LABEL[verdict]}
    </span>
  );
}
