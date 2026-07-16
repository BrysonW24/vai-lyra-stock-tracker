'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DualLauncher } from '@/components/DualLauncher';
import { RatingPrompt } from '@/components/RatingPrompt';
import {
  ArrowLeftRight,
  BarChart3,
  Banknote,
  Bell,
  Bot,
  Bookmark,
  BriefcaseBusiness,
  CalendarDays,
  Calculator,
  Coins,
  FileText,
  Gem,
  FlaskConical,
  Gauge,
  GitCompare,
  Globe,
  GraduationCap,
  Landmark,
  Megaphone,
  Microscope,
  Network,
  Newspaper,
  PieChart,
  Radar,
  Rocket,
  Rss,
  ScrollText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Workflow,
  Wand2,
  ReceiptText,
  Telescope,
  Fingerprint,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DashboardData } from '@/types/scanner';
import { relativeTime } from '@/lib/format';
import { APP_VERSION } from '@/lib/version';
import { BrandLogo } from '@/components/BrandLogo';
import { AlertStatusBadge } from '@/components/AlertStatusBadge';
import { AccountMenu } from '@/components/AccountMenu';
import { captureInteraction } from '@/lib/twin/capture';

// Full section map. Desktop shows it as an icon rail (scrollable, with visible group
// dividers); below xl the same list renders as an always-on, horizontally-scrollable
// bottom bar so every surface (Education included) is permanently reachable without
// opening a menu. `group` renders as a divider on the rail whenever it changes - the
// grouping used to live only in comments, which left 32 identical dots to memorise.
const navItems = [
  // -- Yours --
  { href: '/', label: 'Command', short: 'Command', icon: Gauge, group: 'yours' },
  { href: '/portfolio', label: 'Portfolio', short: 'Portfolio', icon: BriefcaseBusiness, group: 'yours' },
  { href: '/trades', label: 'Trade Log', short: 'Trades', icon: ReceiptText, group: 'yours' },
  { href: '/watchlist', label: 'Watchlist', short: 'Watchlist', icon: Star, group: 'yours' },
  { href: '/twin', label: 'Your Twin', short: 'Twin', icon: Fingerprint, group: 'yours' },
  // Investigation surfaces - research, not daily-driver, so they sit after the personal surfaces
  // (were #2/#3, which over-promoted them on the mobile bottom bar before they earned it).
  { href: '/findings', label: 'Findings', short: 'Find', icon: Telescope, group: 'investigate' },
  { href: '/graph', label: 'Investigation Graph', short: 'Graph', icon: Network, group: 'investigate' },
  { href: '/charts', label: 'Charts', short: 'Charts', icon: PieChart, group: 'investigate' },
  { href: '/saved', label: 'Saved', short: 'Saved', icon: Bookmark, group: 'investigate' },
  { href: '/wire', label: 'Live Wire', short: 'Wire', icon: Rss, group: 'investigate' },
  { href: '/intelligence', label: 'Intelligence', short: 'Intel', icon: Newspaper, group: 'investigate' },
  { href: '/calendar', label: 'Calendar', short: 'Calendar', icon: CalendarDays, group: 'investigate' },
  // -- Signals --
  { href: '/radar', label: 'Signal Radar', short: 'Radar', icon: Radar, group: 'signals' },
  { href: '/smart-money', label: 'Smart Money', short: 'Smart $', icon: Banknote, group: 'signals' },
  // -- Research --
  { href: '/themes', label: 'World Radar', short: 'Themes', icon: Globe, group: 'research' },
  { href: '/supply-chain', label: 'Supply Chain', short: 'Chain', icon: Workflow, group: 'research' },
  { href: '/small-caps', label: 'Small Caps', short: 'SmCaps', icon: Microscope, group: 'research' },
  { href: '/investors', label: 'Investor Radar', short: 'Funds', icon: Landmark, group: 'research' },
  { href: '/awards', label: 'Gov Awards', short: 'Awards', icon: ScrollText, group: 'research' },
  { href: '/flows', label: 'Capital Flows', short: 'Flows', icon: ArrowLeftRight, group: 'research' },
  { href: '/filings', label: 'Filings & Evidence', short: 'Filings', icon: FileText, group: 'research' },
  { href: '/ipos', label: 'IPO Radar', short: 'IPOs', icon: Rocket, group: 'research' },
  { href: '/commodities', label: 'Commodities', short: 'Commod', icon: Gem, group: 'research' },
  { href: '/fundamentals', label: 'Fundamentals', short: 'Fundies', icon: BarChart3, group: 'research' },
  // -- Analysis tools --
  { href: '/comparison', label: 'Comparison Lab', short: 'Compare', icon: GitCompare, group: 'analysis' },
  { href: '/simulation', label: 'Simulation Lab', short: 'Simulate', icon: Calculator, group: 'analysis' },
  { href: '/strategy-lab', label: 'Strategy Lab', short: 'Strategy', icon: FlaskConical, group: 'analysis' },
  { href: '/calculators', label: 'Calculators', short: 'Calc', icon: Coins, group: 'analysis' },
  // -- Trading layer --
  { href: '/paper-bot', label: 'Paper Bot', short: 'Paper Bot', icon: Bot, group: 'trading' },
  { href: '/trading', label: 'Live Bot', short: 'Live Bot', icon: ShieldCheck, group: 'trading' },
  // -- Learn & settings --
  { href: '/education', label: 'Education', short: 'Learn', icon: GraduationCap, group: 'learn' },
  { href: '/whats-new', label: "What's New", short: 'New', icon: Sparkles, group: 'learn' },
  { href: '/settings', label: 'Strategy Rules', short: 'Rules', icon: SlidersHorizontal, group: 'learn' },
];

// Lyra colour ramp - nav icons ascend through the brand palette and descend back
// (ping-pong), so the rail reads as one continuous Lyra gradient wave.
const LYRA_RAMP = ['#3b5bdb', '#5bc8ff', '#43d18b', '#f3a33a', '#f0758a', '#a78bfa'];
function rampColor(index: number): string {
  const period = LYRA_RAMP.length * 2 - 2;
  const pos = index % period;
  return LYRA_RAMP[pos < LYRA_RAMP.length ? pos : period - pos];
}

interface AppShellProps {
  data: DashboardData;
  children: ReactNode;
}

// Hourly cadence; treat anything older than ~2x cadence as stale so a dead cron
// stops wearing a confident green "Live" badge. Returns hours-since-scan so the
// label can say exactly how old the data is. Kept local to AppShell on purpose -
// format.ts is owned by another process.
const STALE_AFTER_HOURS = 2;

function scanFreshness(finishedAt: string): { stale: boolean; hoursAgo: number } {
  const finished = new Date(finishedAt).getTime();
  if (!Number.isFinite(finished)) return { stale: true, hoursAgo: 0 };
  const hoursAgo = (Date.now() - finished) / 3_600_000;
  return { stale: hoursAgo > STALE_AFTER_HOURS, hoursAgo };
}

export function AppShell({ data, children }: AppShellProps) {
  const pathname = usePathname();
  // Boundary-aware: /paper-bot must not also light up /paper (startsWith without the '/' boundary).
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'));
  const navScrollRef = useRef<HTMLDivElement>(null);

  // Trading-twin cadence: one session_open per full load (deduped in the capture helper). Inert until
  // the user opts in - the server enforces the consent gate.
  useEffect(() => {
    captureInteraction({ eventType: 'session_open' });
  }, []);

  // What's New dot: only when THIS version has not been seen. A hardcoded always-on badge
  // trains users to ignore it - the whole point of the megaphone. Visiting /whats-new
  // stamps the version; state starts false so SSR and first client paint agree.
  const [hasUnseenRelease, setHasUnseenRelease] = useState(false);
  useEffect(() => {
    try {
      if (pathname === '/whats-new') {
        localStorage.setItem('lyra.seenVersion', APP_VERSION);
        setHasUnseenRelease(false);
      } else {
        setHasUnseenRelease(localStorage.getItem('lyra.seenVersion') !== APP_VERSION);
      }
    } catch {
      /* storage unavailable (private mode) - no dot beats a permanent dot */
    }
  }, [pathname]);

  // Each page renders its own AppShell, so the mobile bottom-nav re-mounts on every
  // navigation and its horizontal scroll resets to the start (Command first). Keep the
  // active tab scrolled into view so the user never has to scroll back to find it.
  useEffect(() => {
    const active = navScrollRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[#080a0d] text-[#eef3f8]">
      <aside className="glass-chrome fixed bottom-0 left-0 top-0 z-30 hidden w-[72px] flex-col border-r border-[#1b2530] xl:flex">
        <Link href="/" className="grid h-14 shrink-0 place-items-center border-b border-[#1b2530]">
          <BrandLogo size={30} />
        </Link>
        {/* overflow-y-auto is load-bearing: 32 items x 48px outruns a 1080p viewport, and a
            fixed aside without it silently CLIPS everything below the fold (Paper Bot,
            Education, Settings were unreachable from the rail). */}
        <nav className="mt-2 flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map((item, i) => (
            <div key={item.href} className="flex flex-col items-center">
              {i > 0 && item.group !== navItems[i - 1].group && (
                <span aria-hidden className="mb-1 mt-1 h-px w-7 shrink-0 bg-[#1b2530]" />
              )}
              <Link
                href={item.href}
                title={item.label}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={`group relative grid h-11 w-11 place-items-center rounded-md transition ${
                  isActive(item.href)
                    ? 'bg-[#23180b] text-[#f3a33a] ring-1 ring-[#f3a33a]/40'
                    : 'hover:bg-[#151c25]'
                }`}
              >
                <item.icon size={18} style={isActive(item.href) ? undefined : { color: rampColor(i) }} className={isActive(item.href) ? undefined : 'opacity-75 transition group-hover:opacity-100'} />
                <span className="pointer-events-none absolute left-14 z-20 hidden whitespace-nowrap rounded-md border border-[#263241] bg-[#101720] px-2 py-1 text-xs text-[#dbe5ee] shadow-xl group-hover:block group-focus-visible:block">
                  {item.label}
                </span>
              </Link>
            </div>
          ))}
        </nav>
      </aside>

      <div className="xl:pl-[72px]">
        <header className="glass-chrome sticky top-0 z-20 border-b border-[#1b2530]">
          <div className="flex h-14 items-center gap-3 px-3 md:px-5">
            <Link href="/" className="hidden min-w-[150px] items-center md:flex">
              <BrandLogo size={26} showWordmark />
            </Link>
            <Link href="/" aria-label="Lyra home" className="flex shrink-0 items-center md:hidden">
              <BrandLogo size={24} />
            </Link>
            <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-[#263241] bg-[#0d141c] px-2.5 py-1.5 lg:max-w-[380px]">
              <Search size={14} className="shrink-0 text-[#8190a0]" />
              <span className="truncate text-xs text-[#8190a0]">Search: NVDA</span>
            </div>

            {/* Market status: honest about demo vs live vs stale. Green pulse when the scan is
                live and fresh; amber static DEMO chip on sample data; amber/red "Stale" chip
                when the last scan failed/skipped or is older than ~2x the scan cadence, so a
                dead cron never keeps a confident green badge. */}
            {data.generatedFrom === 'demo' ? (
              <span
                title="Demo data - illustrative sample signals, not a live market scan"
                className="hidden items-center gap-1.5 rounded-md border border-[#5a4a1a] bg-[#231a08] px-2 py-1.5 font-mono text-[11px] text-[#f3a33a] sm:flex"
              >
                <span className="inline-flex h-2 w-2 rounded-full bg-[#f3a33a]" />
                DEMO
              </span>
            ) : (() => {
              const runFailed = data.latestRun.status === 'failed' || data.latestRun.status === 'skipped';
              const { stale, hoursAgo } = scanFreshness(data.latestRun.finishedAt);
              if (runFailed || stale) {
                const failed = runFailed;
                return (
                  <span
                    title={
                      failed
                        ? `Last scan ${data.latestRun.status} - data may be incomplete (${relativeTime(data.latestRun.finishedAt)})`
                        : `Stale - last scan ${relativeTime(data.latestRun.finishedAt)}, older than the ${STALE_AFTER_HOURS}h freshness window`
                    }
                    className={`hidden items-center gap-1.5 rounded-md border px-2 py-1.5 font-mono text-[11px] sm:flex ${
                      failed
                        ? 'border-[#5a1f1f] bg-[#2b0f0f] text-[#ff6b6b]'
                        : 'border-[#5a4a1a] bg-[#231a08] text-[#f3a33a]'
                    }`}
                  >
                    <span className={`inline-flex h-2 w-2 rounded-full ${failed ? 'bg-[#ff6b6b]' : 'bg-[#f3a33a]'}`} />
                    {failed
                      ? `Scan ${data.latestRun.status.toUpperCase()}`
                      : `Stale · ${hoursAgo >= 24 ? `${Math.round(hoursAgo / 24)}d` : `${Math.round(hoursAgo)}h`} ago`}
                  </span>
                );
              }
              return (
                <span
                  title={`Live · Last scan ${relativeTime(data.latestRun.finishedAt)} · ${data.latestRun.timeframe.toUpperCase()} timeframe`}
                  className="hidden items-center gap-1.5 rounded-md border border-[#1d4f3a] bg-[#0d251b] px-2 py-1.5 font-mono text-[11px] text-[#43d18b] sm:flex"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#43d18b] opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#43d18b]" />
                  </span>
                  {data.latestRun.timeframe.toUpperCase()} · {relativeTime(data.latestRun.finishedAt)}
                </span>
              );
            })()}

            <AlertStatusBadge />

            {/* Live Wire shortcut - signals first; the live feed is one tap from anywhere.
                Green pulse = signals are live. Sits to the right of the Live alert control. */}
            <Link
              href="/wire"
              title="Live Wire - the live signal feed"
              aria-label="Live Wire"
              className="relative grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#263241] bg-[#0d141c] text-[#a8b5c2] transition hover:border-[#1d4f3a] hover:text-[#43d18b]"
            >
              <Bell size={16} />
              <span className="absolute right-1.5 top-1.5 flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#43d18b] opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#43d18b]" />
              </span>
            </Link>

            {/* Megaphone -> in-product changelog (Wiz pattern). Amber dot = an UNSEEN release. */}
            <Link
              href="/whats-new"
              title="What's new"
              aria-label="What's new"
              className="relative grid h-9 w-9 place-items-center rounded-md border border-[#263241] bg-[#0d141c] text-[#a8b5c2] transition hover:text-[#eef3f8]"
            >
              <Megaphone size={16} />
              {hasUnseenRelease && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#f3a33a] ring-2 ring-[#0d141c]" />
              )}
            </Link>

            <Link
              href="/onboarding"
              title="Guided setup"
              aria-label="Guided setup"
              className="hidden h-9 w-9 place-items-center rounded-md border border-[#263241] bg-[#0d141c] text-[#a8b5c2] transition hover:text-[#eef3f8] sm:grid"
            >
              <Wand2 size={16} />
            </Link>

            <AccountMenu />
          </div>
        </header>

        {data.generatedFrom === 'demo' && (
          <div className="flex items-center justify-center gap-1.5 border-b border-[#5a4a1a]/50 bg-[#1a1407] px-3 py-1.5 text-center text-[11px] text-[#f3a33a] md:px-5">
            <span className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-[#f3a33a]" />
            <span>Demo data - signals shown are illustrative samples, not a live market scan. Connect a live data source to go live.</span>
          </div>
        )}

        <main className="px-3 py-2.5 md:px-5 md:py-4">{children}</main>

        <footer className="border-t border-[#1b2530] px-3 py-2 text-[10px] text-[#6f7d8a] md:px-5">
          Research only - not financial advice. Lyra never trades for you.
        </footer>
      </div>

      <nav
        className="glass-chrome fixed bottom-0 left-0 right-0 z-30 border-t border-[#1b2530] xl:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Primary"
      >
        <div ref={navScrollRef} className="no-scrollbar flex snap-x snap-proximity gap-1.5 overflow-x-auto px-3 py-2 scroll-px-3">
          {navItems.map((item, i) => (
            <Link
              href={item.href}
              key={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={`flex min-w-[73px] shrink-0 snap-start flex-col items-center gap-2 rounded-md px-2 py-3 text-[12px] font-medium transition ${
                isActive(item.href)
                  ? 'bg-[#23180b] text-[#f3a33a] ring-1 ring-[#f3a33a]/40'
                  : 'text-[#8190a0] active:bg-[#151c25]'
              }`}
            >
              <item.icon size={22} style={isActive(item.href) ? undefined : { color: rampColor(i) }} className={isActive(item.href) ? undefined : 'opacity-80'} />
              <span className="whitespace-nowrap">{item.short}</span>
            </Link>
          ))}
        </div>
      </nav>

      <DualLauncher />
      <RatingPrompt />
    </div>
  );
}
