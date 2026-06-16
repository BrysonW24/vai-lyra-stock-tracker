export interface ParsedTradeIntent {
  side: 'buy';
  symbol: string;
  notional: number;
}

function parseAmount(raw: string, suffix?: string): number {
  const base = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(base) || base <= 0) return 0;
  const mult = suffix?.toLowerCase() === 'm' ? 1_000_000 : suffix?.toLowerCase() === 'k' ? 1_000 : 1;
  return base * mult;
}

const AMOUNT = String.raw`\$?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*([kKmM])?`;
const SYMBOL = String.raw`([A-Za-z][A-Za-z0-9.\-]{0,11})`;

const BUY_PATTERNS: RegExp[] = [
  new RegExp(String.raw`\b(?:i\s+)?(?:made|placed|logged|recorded)?\s*(?:a\s+)?(?:trade|buy|purchase|position|investment)\s+(?:of|for)?\s*${AMOUNT}\s+(?:to|into|in|of)\s+${SYMBOL}\b`, 'i'),
  new RegExp(String.raw`\b(?:i\s+)?(?:bought|purchased|added|invested|allocated|put)\s+${AMOUNT}\s+(?:to|into|in|of)?\s+${SYMBOL}\b`, 'i'),
  new RegExp(String.raw`\b(?:i\s+)?(?:bought|purchased|added)\s+${SYMBOL}\s+(?:for|with|at)?\s*${AMOUNT}\b`, 'i'),
];

export function parseTradeLogIntent(text: string): ParsedTradeIntent | null {
  const input = text.trim();
  if (!input || /\b(sell|sold|short|option|call|put option|live|margin)\b/i.test(input)) return null;

  for (const pattern of BUY_PATTERNS) {
    const match = input.match(pattern);
    if (!match) continue;

    const symbolFirst = /^[A-Za-z]/.test(match[1]) && !/^[0-9]/.test(match[1]);
    const symbol = symbolFirst ? match[1] : match[3];
    const amountRaw = symbolFirst ? match[2] : match[1];
    const suffix = symbolFirst ? match[3] : match[2];
    const notional = parseAmount(amountRaw, suffix);
    if (symbol && notional > 0) {
      return { side: 'buy', symbol: symbol.toUpperCase(), notional };
    }
  }

  return null;
}
