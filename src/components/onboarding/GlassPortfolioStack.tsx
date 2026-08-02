'use client';

/**
 * Glass Portfolio Stack - layered transparent cards showing portfolio tiles.
 * Used on portfolio input screen to visualize holdings.
 */

export function GlassPortfolioStack() {
  // Per-card identity colours are design tokens, resolved via CSS variables (applied
  // through style props because SVG presentation attributes cannot carry var()).
  const holdings = [
    { symbol: 'NVDA', value: 12000, color: 'var(--lyra-blue-focus)' },
    { symbol: 'AMD', value: 5000, color: 'var(--lyra-accent)' },
    { symbol: 'MSFT', value: 8500, color: 'var(--lyra-positive)' },
  ];

  return (
    <div className="flex items-center justify-center w-full h-full min-h-[300px]">
      <svg viewBox="0 0 300 300" className="w-full max-w-xs h-auto" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="stackGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Stacked cards */}
        {holdings.map((holding, idx) => {
          const yOffset = idx * 40;
          const opacity = 0.7 - idx * 0.1;
          const cardWidth = 200 - idx * 15;
          const cardX = 150 - cardWidth / 2;

          return (
            <g key={holding.symbol}>
              {/* Card background */}
              <rect
                x={cardX}
                y={60 + yOffset}
                width={cardWidth}
                height="35"
                rx="4"
                className="fill-panel"
                style={{ stroke: holding.color }}
                strokeWidth="1"
                opacity={opacity}
                filter="url(#stackGlow)"
              />

              {/* Color accent bar */}
              <rect
                x={cardX}
                y={60 + yOffset}
                width="4"
                height="35"
                rx="4"
                style={{ fill: holding.color }}
                opacity={opacity}
              />

              {/* Ticker */}
              <text
                x={cardX + 12}
                y={73 + yOffset}
                fontSize="12"
                className="fill-ink"
                fontWeight="bold"
                fontFamily="monospace"
              >
                {holding.symbol}
              </text>

              {/* Value */}
              <text
                x={cardX + cardWidth - 8}
                y={73 + yOffset}
                textAnchor="end"
                fontSize="11"
                style={{ fill: holding.color }}
                fontWeight="bold"
                fontFamily="monospace"
              >
                ${(holding.value / 1000).toFixed(1)}k
              </text>

              {/* Progress bar */}
              <rect
                x={cardX + 12}
                y={82 + yOffset}
                width={cardWidth - 24}
                height="3"
                rx="1.5"
                className="fill-line-strong"
              />
              <rect
                x={cardX + 12}
                y={82 + yOffset}
                width={(cardWidth - 24) * (holdings.length - idx) / holdings.length}
                height="3"
                rx="1.5"
                style={{ fill: holding.color }}
                opacity={opacity}
              />
            </g>
          );
        })}

        {/* Title */}
        <text x="150" y="30" textAnchor="middle" fontSize="14" className="fill-ink-title" fontWeight="bold">
          Portfolio holdings
        </text>
      </svg>
    </div>
  );
}
