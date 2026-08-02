interface DonutSlice {
  label: string;
  value: number;
}

const RAMP = ['#3b5bdb', '#5bc8ff', '#43d18b', '#f3a33a', '#f0758a', '#a78bfa'];

/**
 * Portfolio composition donut - pure SVG, server-safe. Shows the top holdings by weight
 * with the remainder folded into "Other", plus a colour-keyed legend with percentages.
 */
export function PortfolioDonut({ slices, size = 128 }: { slices: DonutSlice[]; size?: number }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) {
    return <p className="text-[11px] text-ink-3">Add holdings to see your composition.</p>;
  }

  const sorted = [...slices].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 6);
  const otherValue = sorted.slice(6).reduce((sum, s) => sum + s.value, 0);
  const segments = [
    ...top.map((s, i) => ({ label: s.label, value: s.value, color: RAMP[i % RAMP.length] })),
    ...(otherValue > 0 ? [{ label: 'Other', value: otherValue, color: '#3a4754' }] : []),
  ];

  const stroke = 13;
  const r = size / 2 - stroke / 2;
  const circumference = 2 * Math.PI * r;
  let cumulative = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#17202a" strokeWidth={stroke} />
        {segments.map((seg) => {
          const fraction = seg.value / total;
          const dash = `${fraction * circumference} ${circumference}`;
          const offset = -cumulative * circumference;
          cumulative += fraction;
          return (
            <circle
              key={seg.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={offset}
            />
          );
        })}
      </svg>
      <div className="min-w-0 flex-1 space-y-1">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: seg.color }} />
            <span className="min-w-0 flex-1 truncate text-ink-title">{seg.label}</span>
            <span className="text-ink-3">{Math.round((seg.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
