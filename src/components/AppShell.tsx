'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DualLauncher } from '@/components/DualLauncher';
import { RatingPrompt } from '@/components/RatingPrompt';
import { DemoConversionCta } from '@/components/DemoConversionCta';
import { AiTrialSplash } from '@/components/AiTrialSplash';
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
  Trophy,
  Award,
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
  Pin,
  Radar,
  Rocket,
  Rss,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  BrainCircuit,
  Star,
  Workflow,
  Wand2,
  ReceiptText,
  Telescope,
  Fingerprint,
  Target,
  LayoutGrid,
  X,
  Activity,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DashboardData } from '@/types/scanner';
import { relativeTime } from '@/lib/format';
import { scanFreshness, STALE_AFTER_HOURS } from '@/lib/scan-freshness';
import { APP_VERSION } from '@/lib/version';
import { BrandLogo } from '@/components/BrandLogo';
import { AlertStatusBadge } from '@/components/AlertStatusBadge';
import { AccountMenu } from '@/components/AccountMenu';
import { TickerQuickSearch } from '@/components/TickerQuickSearch';
import { captureInteraction } from '@/lib/twin/capture';
import { NavCustomizer } from '@/components/NavCustomizer';
import { getPrimaryHrefs, setPrimaryHrefs, clearPrimaryHrefs, sanitizePrimaries } from '@/lib/nav-prefs';
import { isSupabaseConfigured } from '@/lib/supabase/client';

// The full section map, grouped BY JOB (what you're trying to do), not by data type. A slim set of
// daily-drivers (`primary`) stays permanently on the rail / bottom bar; everything else lives one
// tap away in the grouped Explore drawer, so the ~30 research surfaces stop shouting at once. The
// cockpit-led Command page owns the first screen; Explore is the door to the depth behind it.
type NavItem = { href: string; label: string; short: string; icon: LucideIcon; bucket: NavBucketId; primary?: boolean };
type NavBucketId = 'desk' | 'discover' | 'research' | 'practice' | 'learn';

const navItems: NavItem[] = [
  // YOUR DESK - what you own and act on
  { href: '/', label: 'Command', short: 'Home', icon: Gauge, bucket: 'desk', primary: true },
  { href: '/portfolio', label: 'Portfolio', short: 'Portfolio', icon: BriefcaseBusiness, bucket: 'desk', primary: true },
  { href: '/watchlist', label: 'Watchlist', short: 'Watchlist', icon: Star, bucket: 'desk', primary: true },
  { href: '/plan', label: 'Trade Plan', short: 'Plan', icon: Target, bucket: 'desk' },
  { href: '/trades', label: 'Trade Log', short: 'Trades', icon: ReceiptText, bucket: 'desk' },
  { href: '/twin', label: 'Your Twin', short: 'Twin', icon: Fingerprint, bucket: 'desk' },
  // DISCOVER - find the next opportunity
  { href: '/radar', label: 'Signal Radar', short: 'Radar', icon: Radar, bucket: 'discover' },
  { href: '/small-caps', label: 'Small Caps', short: 'SmCaps', icon: Microscope, bucket: 'discover' },
  { href: '/emerging-winners', label: 'Emerging Winners', short: 'Winners', icon: Award, bucket: 'discover' },
  { href: '/themes', label: 'World Radar', short: 'Themes', icon: Globe, bucket: 'discover' },
  { href: '/smart-money', label: 'Smart Money', short: 'Smart $', icon: Banknote, bucket: 'discover' },
  { href: '/investors', label: 'Investor Radar', short: 'Funds', icon: Landmark, bucket: 'discover' },
  { href: '/ipos', label: 'IPO Radar', short: 'IPOs', icon: Rocket, bucket: 'discover' },
  { href: '/calendar', label: 'Calendar', short: 'Calendar', icon: CalendarDays, bucket: 'discover' },
  { href: '/wire', label: 'Live Wire', short: 'Wire', icon: Rss, bucket: 'discover' },
  { href: '/findings', label: 'Findings', short: 'Find', icon: Telescope, bucket: 'discover' },
  // RESEARCH - dig into the evidence
  { href: '/intelligence', label: 'Intelligence', short: 'Intel', icon: Newspaper, bucket: 'research' },
  { href: '/filings', label: 'Filings & Evidence', short: 'Filings', icon: FileText, bucket: 'research' },
  { href: '/fundamentals', label: 'Fundamentals', short: 'Fundies', icon: BarChart3, bucket: 'research' },
  { href: '/supply-chain', label: 'Supply Chain', short: 'Chain', icon: Workflow, bucket: 'research' },
  { href: '/comparison', label: 'Comparison Lab', short: 'Compare', icon: GitCompare, bucket: 'research' },
  { href: '/charts', label: 'Charts', short: 'Charts', icon: PieChart, bucket: 'research' },
  { href: '/graph', label: 'Investigation Graph', short: 'Graph', icon: Network, bucket: 'research' },
  { href: '/awards', label: 'Gov Awards', short: 'Awards', icon: ScrollText, bucket: 'research' },
  { href: '/flows', label: 'Capital Flows', short: 'Flows', icon: ArrowLeftRight, bucket: 'research' },
  { href: '/commodities', label: 'Commodities', short: 'Commod', icon: Gem, bucket: 'research' },
  // PRACTICE - test ideas with no real money
  { href: '/paper-bot', label: 'Paper Bot', short: 'Paper Bot', icon: Bot, bucket: 'practice', primary: true },
  { href: '/trading', label: 'Live Bot', short: 'Live Bot', icon: ShieldCheck, bucket: 'practice' },
  { href: '/simulation', label: 'Simulation Lab', short: 'Simulate', icon: Calculator, bucket: 'practice' },
  { href: '/strategy-lab', label: 'Strategy Lab', short: 'Strategy', icon: FlaskConical, bucket: 'practice' },
  { href: '/track-record', label: 'Track Record', short: 'Record', icon: Trophy, bucket: 'practice' },
  { href: '/calculators', label: 'Calculators', short: 'Calc', icon: Coins, bucket: 'practice' },
  // LEARN & SET UP
  { href: '/education', label: 'Education', short: 'Learn', icon: GraduationCap, bucket: 'learn' },
  { href: '/settings', label: 'Strategy Rules', short: 'Rules', icon: SlidersHorizontal, bucket: 'learn' },
  { href: '/saved', label: 'Saved', short: 'Saved', icon: Bookmark, bucket: 'learn' },
  { href: '/usage', label: 'Your Activity', short: 'Activity', icon: Activity, bucket: 'learn' },
  { href: '/whats-new', label: "What's New", short: 'New', icon: Sparkles, bucket: 'learn' },
  { href: '/models', label: 'Models', short: 'Models', icon: BrainCircuit, bucket: 'learn' },
];

// Each job gets a Lyra accent - the drawer reads in colour, not a grey wall, and the colour codes the
// job so the eye learns "amber = my desk, cyan = discover, purple = research, green = practice".
const NAV_BUCKETS: { id: NavBucketId; label: string; blurb: string; color: string }[] = [
  { id: 'desk', label: 'Your desk', blurb: 'What you own and act on', color: '#f3a33a' },
  { id: 'discover', label: 'Discover', blurb: 'Find the next opportunity', color: '#5bc8ff' },
  { id: 'research', label: 'Research', blurb: 'Dig into the evidence', color: '#a78bfa' },
  { id: 'practice', label: 'Practice', blurb: 'Test ideas with no real money', color: '#43d18b' },
  { id: 'learn', label: 'Learn & set up', blurb: 'Get better, tune the rules', color: '#f0758a' },
];

const NAV_BY_HREF = new Map(navItems.map((item) => [item.href, item]));

// The bottom bar / rail defaults, and how far the user may customise it. Home stays optional now -
// the user owns the bar - but we keep at least one primary so the bar is never empty, and cap the
// count so it stays scannable next to the permanent Explore control.
const DEFAULT_PRIMARY_HREFS = navItems.filter((item) => item.primary).map((item) => item.href);
const MIN_PRIMARIES = 1;
const MAX_PRIMARIES = 5;
// The set of hrefs the primary bar may contain - the live section map keys. Bound once so the pure
// sanitizePrimaries (in nav-prefs, unit-tested) can validate/dedupe/clamp a stored bar.
const VALID_PRIMARY_HREFS: ReadonlySet<string> = new Set(NAV_BY_HREF.keys());
const sanitizePrimaryHrefs = (hrefs: string[]) => sanitizePrimaries(hrefs, VALID_PRIMARY_HREFS, MAX_PRIMARIES);

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

export function AppShell({ data, children }: AppShellProps) {
  const pathname = usePathname();
  const soloMode = !isSupabaseConfigured();
  // Boundary-aware: /paper-bot must not also light up /paper (startsWith without the '/' boundary).
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'));
  const navScrollRef = useRef<HTMLDivElement>(null);

  // Explore drawer: the ~30 non-daily surfaces live here, grouped by job. Close on navigation and on
  // Escape so it never traps the user. exploreActive lights the Explore control when the current route
  // is one of the drawer's surfaces (not a primary), so you always know you are "inside" Explore.
  const [exploreOpen, setExploreOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const closeExplore = () => {
    setExploreOpen(false);
    setCustomizing(false);
  };

  // The user's own bottom-bar layout. Null until loaded from storage, so SSR and the first client paint
  // both render the built-in defaults (no hydration mismatch); their saved layout swaps in after mount.
  const [customPrimaries, setCustomPrimaries] = useState<string[] | null>(null);
  useEffect(() => {
    const saved = getPrimaryHrefs();
    if (saved) {
      const clean = sanitizePrimaryHrefs(saved);
      if (clean.length >= MIN_PRIMARIES) setCustomPrimaries(clean);
    }
  }, []);

  const primaryHrefs = customPrimaries ?? DEFAULT_PRIMARY_HREFS;
  const primaryItems = primaryHrefs.map((href) => NAV_BY_HREF.get(href)).filter((i): i is NavItem => Boolean(i));

  // Persist an edited bar. Landing exactly on the defaults clears the override, so a future change to the
  // defaults still reaches the user; any other layout is saved as their explicit choice.
  const applyPrimaries = (hrefs: string[]) => {
    const clean = sanitizePrimaryHrefs(hrefs);
    if (clean.length < MIN_PRIMARIES) return;
    const isDefault =
      clean.length === DEFAULT_PRIMARY_HREFS.length && clean.every((h, i) => h === DEFAULT_PRIMARY_HREFS[i]);
    if (isDefault) {
      clearPrimaryHrefs();
      setCustomPrimaries(null);
    } else {
      setPrimaryHrefs(clean);
      setCustomPrimaries(clean);
    }
  };
  const resetPrimaries = () => {
    clearPrimaryHrefs();
    setCustomPrimaries(null);
  };

  const exploreActive = !primaryItems.some((item) => isActive(item.href));
  useEffect(() => {
    closeExplore();
  }, [pathname]);
  useEffect(() => {
    if (!exploreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      // Escape steps back one level: leave customise mode first, then close the drawer.
      if (e.key === 'Escape') setCustomizing((c) => (c ? false : (setExploreOpen(false), false)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exploreOpen]);

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
        {/* Slim rail: the daily-drivers, then one Explore door to everything else. The 30 research
            surfaces used to live here as an icon wall that outran the viewport - they now sit grouped
            in the Explore drawer, so the rail is scannable and the cockpit owns the screen. */}
        <nav className="mt-2 flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {primaryItems.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={`group relative grid h-11 w-11 place-items-center rounded-md transition ${
                isActive(item.href) ? 'bg-[#23180b] text-[#f3a33a] ring-1 ring-[#f3a33a]/40' : 'hover:bg-[#151c25]'
              }`}
            >
              <item.icon size={18} style={isActive(item.href) ? undefined : { color: rampColor(i) }} className={isActive(item.href) ? undefined : 'opacity-75 transition group-hover:opacity-100'} />
              <span className="pointer-events-none absolute left-14 z-20 hidden whitespace-nowrap rounded-md border border-[#263241] bg-[#101720] px-2 py-1 text-xs text-[#dbe5ee] shadow-xl group-hover:block group-focus-visible:block">
                {item.label}
              </span>
            </Link>
          ))}
          <span aria-hidden className="mb-1 mt-1 h-px w-7 shrink-0 bg-[#1b2530]" />
          <button
            type="button"
            onClick={() => setExploreOpen(true)}
            title="Explore everything"
            aria-haspopup="dialog"
            aria-expanded={exploreOpen}
            className={`group relative grid h-11 w-11 place-items-center rounded-md transition ${
              exploreActive ? 'bg-[#23180b] text-[#f3a33a] ring-1 ring-[#f3a33a]/40' : 'text-[#a8b5c2] hover:bg-[#151c25]'
            }`}
          >
            <LayoutGrid size={18} className={exploreActive ? undefined : 'opacity-75 transition group-hover:opacity-100'} />
            <span className="pointer-events-none absolute left-14 z-20 hidden whitespace-nowrap rounded-md border border-[#263241] bg-[#101720] px-2 py-1 text-xs text-[#dbe5ee] shadow-xl group-hover:block group-focus-visible:block">
              Explore everything
            </span>
          </button>
        </nav>
      </aside>

      <div className="xl:pl-[72px]">
        <header
          className="glass-chrome sticky top-0 z-20 border-b border-[#1b2530]"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex h-14 items-center gap-3 px-3 md:px-5">
            <Link href="/" className="hidden min-w-[150px] items-center md:flex">
              <BrandLogo size={26} showWordmark />
            </Link>
            <Link href="/" aria-label="Lyra home" className="flex shrink-0 items-center md:hidden">
              <BrandLogo size={24} />
            </Link>
            <TickerQuickSearch />

            {/* Market status: honest about demo vs live vs stale. Green pulse when the scan is
                live and fresh; amber static DEMO chip on sample data; amber/red "Stale" chip
                when the last scan failed/skipped or is older than ~2x the scan cadence, so a
                dead cron never keeps a confident green badge. */}
            {data.generatedFrom === 'demo' ? (
              <span
                title={
                  soloMode
                    ? 'Solo mode - device-local book and settings; market scores refresh from public prices when available'
                    : 'Demo data - illustrative sample signals, not a live market scan'
                }
                className="hidden items-center gap-1.5 rounded-md border border-[#5a4a1a] bg-[#231a08] px-2 py-1.5 font-mono text-[11px] text-[#f3a33a] sm:flex"
              >
                <span className="inline-flex h-2 w-2 rounded-full bg-[#f3a33a]" />
                {soloMode ? 'SOLO' : 'DEMO'}
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
              className="relative grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[#263241] bg-[#0d141c] text-[#a8b5c2] transition hover:border-[#1d4f3a] hover:text-[#43d18b] sm:h-9 sm:w-9"
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
              className="relative grid h-11 w-11 place-items-center rounded-md border border-[#263241] bg-[#0d141c] text-[#a8b5c2] transition hover:text-[#eef3f8] sm:h-9 sm:w-9"
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
            <span>
              {soloMode
                ? 'Solo mode - your book, watchlist and trade log stay on this device. Market scores refresh from public prices when available; seeded context panels are labelled Sample.'
                : 'Demo data - signals shown are illustrative samples, not a live market scan. Connect a live data source to go live.'}
            </span>
          </div>
        )}

        <main className="px-3 py-2.5 md:px-5 md:py-4">
          <DemoConversionCta />
          {children}
        </main>

        <footer className="border-t border-[#1b2530] px-3 py-2 text-[10px] text-[#6f7d8a] md:px-5">
          Research only - not financial advice. Lyra never trades for you.
        </footer>
      </div>

      <nav
        className="glass-chrome fixed bottom-0 left-0 right-0 z-30 border-t border-[#1b2530] xl:hidden"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
        aria-label="Primary"
      >
        <div ref={navScrollRef} className="flex items-stretch gap-0.5 px-1.5 pt-2 pb-1">
          {primaryItems.map((item, i) => (
            <Link
              href={item.href}
              key={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-1 rounded-md px-0.5 py-1.5 text-[10px] font-medium transition ${
                isActive(item.href) ? 'bg-[#23180b] text-[#f3a33a] ring-1 ring-[#f3a33a]/40' : 'text-[#8190a0] active:bg-[#151c25]'
              }`}
            >
              <item.icon size={20} style={isActive(item.href) ? undefined : { color: rampColor(i) }} className={isActive(item.href) ? undefined : 'opacity-80'} />
              <span className="whitespace-nowrap leading-none tracking-tight">{item.short}</span>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setExploreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={exploreOpen}
            className={`flex flex-1 flex-col items-center gap-1 rounded-md px-0.5 py-1.5 text-[10px] font-medium transition ${
              exploreActive ? 'bg-[#23180b] text-[#f3a33a] ring-1 ring-[#f3a33a]/40' : 'text-[#8190a0] active:bg-[#151c25]'
            }`}
          >
            <LayoutGrid size={20} className={exploreActive ? undefined : 'opacity-80'} />
            <span className="whitespace-nowrap leading-none tracking-tight">Explore</span>
          </button>
        </div>
      </nav>

      {/* Explore drawer - every surface behind the daily-drivers, grouped by the job it does. Opens
          from the rail/bottom-bar Explore control; closes on backdrop, X, Escape, or navigation. */}
      {exploreOpen && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Explore all surfaces">
          <button type="button" aria-label="Close Explore" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeExplore} />
          <div
            className="glass-chrome relative ml-auto flex h-full w-full max-w-md flex-col border-l border-[#1b2530] shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)', paddingRight: 'env(safe-area-inset-right)' }}
          >
            <div
              className="flex items-center gap-2 border-b border-[#1b2530] px-4 py-3"
              style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
            >
              {customizing ? <Pin size={16} className="text-[#f3a33a]" /> : <LayoutGrid size={16} className="text-[#f3a33a]" />}
              <h2 className="text-sm font-semibold text-[#eef3f8]">{customizing ? 'Customise your bar' : 'Explore'}</h2>
              <span className="hidden text-[11px] text-[#8190a0] sm:inline">
                {customizing ? 'Drag to reorder, add or remove' : 'everything behind your desk'}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCustomizing((c) => !c)}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                    customizing
                      ? 'border-[#f3a33a]/50 bg-[#23180b] text-[#f3a33a]'
                      : 'border-[#263241] bg-[#0d141c] text-[#a8b5c2] hover:text-[#eef3f8]'
                  }`}
                >
                  <Pin size={12} />
                  {customizing ? 'Done' : 'Customise'}
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={closeExplore}
                  aria-label="Close"
                  className="grid h-8 w-8 place-items-center rounded-md border border-[#263241] bg-[#0d141c] text-[#a8b5c2] transition hover:text-[#eef3f8]"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {customizing ? (
                <NavCustomizer
                  items={navItems}
                  buckets={NAV_BUCKETS}
                  value={primaryHrefs}
                  min={MIN_PRIMARIES}
                  max={MAX_PRIMARIES}
                  onChange={applyPrimaries}
                  onReset={resetPrimaries}
                  isDefault={customPrimaries === null}
                />
              ) : (
                <div className="space-y-4">
                  {NAV_BUCKETS.map((bucket) => (
                    <div key={bucket.id}>
                      <div className="mb-1.5 flex items-center gap-2">
                        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: bucket.color }} />
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: bucket.color }}>
                          {bucket.label}
                        </p>
                        <p className="truncate text-[10px] text-[#5e6b78]">{bucket.blurb}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {navItems
                          .filter((item) => item.bucket === bucket.id)
                          .map((item) => {
                            const active = isActive(item.href);
                            const onBar = primaryHrefs.includes(item.href);
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={closeExplore}
                                aria-current={active ? 'page' : undefined}
                                className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-[12px] transition ${
                                  active
                                    ? 'border-[#f3a33a]/40 bg-[#23180b] text-[#f3a33a]'
                                    : 'border-[#1b2530] bg-[#0d1117] text-[#c3ccd6] hover:border-[#2a3646] hover:bg-[#101720]'
                                }`}
                              >
                                <item.icon
                                  size={15}
                                  className="shrink-0"
                                  style={active ? undefined : { color: bucket.color, opacity: 0.9 }}
                                />
                                <span className="truncate">{item.label}</span>
                                {onBar && !active && <Pin size={11} className="ml-auto shrink-0 text-[#f3a33a]" />}
                              </Link>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <DualLauncher />
      <RatingPrompt />
      <AiTrialSplash />
    </div>
  );
}
