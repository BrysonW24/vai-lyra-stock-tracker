// "The stack" from the Setup Companion, ported to the landing page: every technology
// in the build with an honest cost badge. Logos live in public/logos/ (shared with the
// companion). Server component - no interactivity needed.

type Badge = 'free' | 'opt' | 'paid';

const BADGE_CLASS: Record<Badge, string> = {
  free: 'text-[#189a66] bg-[#e7f6ef] border-[#c3e8d5]',
  opt: 'text-[#1E63FF] bg-[#eaf1ff] border-[#cdddff]',
  paid: 'text-[#b45a1d] bg-[#fdf3e4] border-[#f2d4ae]',
};

interface Tile {
  name: string;
  role: string;
  logo?: string; // path under public/, else the glyph renders
  glyph?: string;
  badge: Badge;
  cost: string;
}

const TILES: Tile[] = [
  { name: 'Next.js 15', role: 'The web app - dashboard, API, middleware. TypeScript strict.', logo: '/logos/nextdotjs.svg', badge: 'free', cost: 'free · OSS' },
  { name: 'React 19', role: 'The dense, real-time console UI.', logo: '/logos/react.svg', badge: 'free', cost: 'free · OSS' },
  { name: 'Tailwind CSS', role: 'The trading-desk design system.', logo: '/logos/tailwindcss.svg', badge: 'free', cost: 'free · OSS' },
  { name: 'Supabase', role: 'Your Postgres + auth. You own the project.', logo: '/logos/supabase.svg', badge: 'free', cost: 'free tier' },
  { name: 'Python scanner', role: 'pandas + ta - every indicator. No AI in the numbers.', logo: '/logos/python.svg', badge: 'free', cost: 'free · OSS' },
  { name: 'GitHub Actions', role: 'Runs the scanner hourly. Free in public repos.', logo: '/logos/githubactions.svg', badge: 'free', cost: '$0 public repo' },
  { name: 'Market data', role: 'yfinance free, Finnhub as backup.', glyph: '📈', badge: 'free', cost: '$0 hobby use' },
  { name: 'Vercel', role: 'One-command hosting. Free Hobby tier.', logo: '/logos/vercel.svg', badge: 'opt', cost: 'optional · $0' },
  { name: 'Docker + Coolify', role: 'Or self-host on your own server - Dockerfile included.', logo: '/logos/docker.svg', badge: 'opt', cost: 'optional · ~$12/mo' },
  { name: 'Redis (Upstash)', role: 'Serverless cache. Falls back to in-memory.', logo: '/logos/upstash.svg', badge: 'opt', cost: 'optional · $0 tier' },
  { name: 'Telegram Bot', role: 'Urgent setups straight to your phone.', logo: '/logos/telegram.svg', badge: 'opt', cost: 'optional · $0' },
  { name: 'Slack', role: 'Feedback + alerts piped into your channel.', logo: '/logos/slack.svg', badge: 'opt', cost: 'optional · $0' },
  { name: 'OpenAI (or BYOK)', role: 'Plain-English explanations. Any provider works.', logo: '/logos/openai.svg', badge: 'paid', cost: '~US$0.50/mo' },
  { name: 'Anthropic Claude', role: "First-class in Lyra's gateway - paste a key, done.", logo: '/logos/anthropic-claude.svg', badge: 'opt', cost: 'optional · BYOK' },
  { name: 'TradingView', role: 'Live charts + one-click Pine backtests.', logo: '/logos/tradingview.svg', badge: 'free', cost: 'free widget' },
  { name: 'Web Push (VAPID)', role: 'Browser-native alerts. No vendor account.', glyph: '🔔', badge: 'free', cost: '$0 standard' },
];

export function StackSection({ soloMode = false }: { soloMode?: boolean }) {
  const tiles = soloMode
    ? TILES.filter(
        (tile) =>
          ![
            'Supabase',
            'GitHub Actions',
            'Telegram Bot',
            'Slack',
            'Web Push (VAPID)',
          ].includes(tile.name),
      )
    : TILES;
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#1E63FF]">{soloMode ? 'The Solo stack' : 'The stack'}</p>
      <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#0E1E3A] md:text-3xl">
        Every technology in the build - <span className="text-[#1E63FF]">and what it costs you</span>.
      </h2>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.name}
            className="flex flex-col gap-1.5 rounded-2xl border border-[#0E1E3A]/10 bg-white/70 p-3.5 shadow-[0_8px_24px_rgba(14,30,58,0.05)] backdrop-blur-md transition hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(14,30,58,0.10)]"
          >
            <div className="flex items-center gap-2.5">
              {t.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.logo} alt="" width={20} height={20} className="h-5 w-5 shrink-0 object-contain" />
              ) : (
                <span className="text-[16px] leading-none">{t.glyph}</span>
              )}
              <h3 className="text-[13px] font-semibold text-[#0E1E3A]">{t.name}</h3>
            </div>
            <p className="flex-1 text-[11.5px] leading-snug text-[#5A6B82]">{t.role}</p>
            {/* whitespace-nowrap + tighter mobile sizing: pills must never wrap into two
                broken lines inside the 2-column grid at 375px */}
            <span className={`self-start whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.03em] sm:text-[9.5px] sm:tracking-[0.06em] ${BADGE_CLASS[t.badge]}`}>
              {t.cost}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[12px] text-[#8290a0]">
        Full pricing with free-tier limits and gotchas:{' '}
        <a
          href="https://github.com/BrysonW24/vai-lyra-stock-tracker/blob/main/COSTS.md"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-[#1E63FF] hover:underline"
        >
          COSTS.md
        </a>
        . {soloMode
          ? 'Solo stays accountless and uses browser-local storage; provider AI is optional BYOK.'
          : 'Demo mode is $0 forever; a fully live, always-on setup runs on free tiers.'}
      </p>
    </div>
  );
}
