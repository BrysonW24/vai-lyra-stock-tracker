import type { SignalStatus } from '@/types/scanner';
import { statusClass, statusLabel } from '@/lib/format';

interface StatusBadgeProps {
  status: SignalStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded border px-2 py-1 font-mono text-[11px] font-semibold ${statusClass(status)}`}>
      {statusLabel(status)}
    </span>
  );
}
