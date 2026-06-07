'use client';

/**
 * Glass Portfolio Stack - layered transparent cards showing portfolio tiles.
 * Used on portfolio input screen to visualize holdings.
 */

export function GlassPortfolioStack() {
  const holdings = [
    { symbol: 'NVDA', value: 12000, color: '#60a5fa' },
    { symbol: 'AMD', value: 5000, color: '#f3a33a' },
    { symbol: 'MSFT', value: 8500, color: '#43d18b' },
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
                fill="#0d141c"
                stroke={holding.color}
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
                fill={holding.color}
                opacity={opacity}
              />

              {/* Ticker */}
              <text
                x={cardX + 12}
                y={73 + yOffset}
                fontSize="12"
                fill="#eef3f8"
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
                fill={holding.color}
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
                fill="#263241"
              />
              <rect
                x={cardX + 12}
                y={82 + yOffset}
                width={(cardWidth - 24) * (holdings.length - idx) / holdings.length}
                height="3"
                rx="1.5"
                fill={holding.color}
                opacity={opacity}
              />
            </g>
          );
        })}

        {/* Title */}
        <text x="150" y="30" textAnchor="middle" fontSize="14" fill="#dbe5ee" fontWeight="bold">
          Portfolio holdings
        </text>
      </svg>
    </div>
  );
}
