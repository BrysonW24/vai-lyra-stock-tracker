import { Award, FileText, Landmark, type LucideIcon } from 'lucide-react';
import { TickerLogo } from '@/components/TickerLogo';
import { SourceFavicon } from '@/components/SourceFavicon';
import { listAwards, type GovAward } from '@/lib/gov-awards';
import type { GovAwardsProvenance } from '@/lib/ingestion/usaspending';
import { relativeTime } from '@/lib/format';

const KIND_ICON: Record<GovAward['kind'], LucideIcon> = { contract: FileText, grant: Award };

function AwardCard({ award }: { award: GovAward }) {
  const Icon = KIND_ICON[award.kind];
  return (
    <div className="rounded-md border border-[#1b2530] bg-[#0d141c] p-2.5">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[#263241] bg-[#0b1016] text-[#7fb0ff]">
          <Icon size={12} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-semibold leading-snug text-[#eef3f8]">{award.agency}</span>
            <span className="rounded border border-[#263241] bg-[#0b1016] px-1 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[#a8b5c2]">{award.kind}</span>
            <span className="font-mono text-[9px] text-[#5e6b78]">{award.date}</span>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-[#a8b5c2]">{award.summary}</p>
        </div>
        <span className="shrink-0 font-mono text-sm font-semibold text-[#43d18b]">{award.amount}</span>
      </div>

      <p className="mt-1.5 text-[10px] leading-snug text-[#a8b5c2]">
        <span className="font-semibold text-[#43d18b]">Why: </span>{award.why}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded border border-[#263241] bg-[#0d141c] px-1.5 py-0.5 font-mono text-[9px] text-[#a8b5c2]">{award.theme}</span>
        {award.tickers.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded border border-[#263241] bg-[#0d141c] px-1.5 py-0.5 font-mono text-[10px] text-[#dbe5ee]">
            <TickerLogo symbol={t} size={12} /> {t}
          </span>
        ))}
        <a
          href={award.source.url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 font-mono text-[9px] text-[#8190a0] transition hover:text-[#dbe5ee]"
        >
          <SourceFavicon domain={award.source.domain} sourceName={award.source.name} /> {award.source.name}
        </a>
      </div>
    </div>
  );
}

function RegionSection({ title, flag, awards }: { title: string; flag: string; awards: GovAward[] }) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">
        <span aria-hidden>{flag}</span> {title} <span className="font-mono text-[#5e6b78]">· {awards.length}</span>
      </p>
      <div className="grid gap-2 lg:grid-cols-2">
        {awards.map((a) => (
          <AwardCard key={a.id} award={a} />
        ))}
      </div>
    </div>
  );
}

/** Provenance disclosure - live USAspending merged over the curated sample, or the sample alone. */
function ProvenanceBadge({ source, fetchedAt, liveAwardCount }: { source: GovAwardsProvenance; fetchedAt: string; liveAwardCount: number }) {
  if (source === 'sample') {
    return (
      <p className="border-t border-[#1b2530] pt-1.5 font-mono text-[10px] leading-snug text-[#5e6b78]">
        Illustrative sample - no live federal awards matched Lyra&apos;s watchlist in the latest USAspending pull. AusTender / GrantConnect wire in next. Research context, never advice.
      </p>
    );
  }
  const label = source === 'live' ? 'Live' : 'Live + sample';
  return (
    <p className="flex flex-wrap items-center gap-1.5 border-t border-[#1b2530] pt-1.5 font-mono text-[10px] leading-snug text-[#8190a0]">
      <span className="inline-flex items-center gap-1 rounded border border-[#1d4f3a] bg-[#0d251b] px-1.5 py-0.5 text-[#43d18b]">
        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#43d18b]" />
        {label} · USAspending
      </span>
      <span>{liveAwardCount} live federal award{liveAwardCount === 1 ? '' : 's'} · synced {relativeTime(fetchedAt)}.</span>
      {source === 'mixed' && <span className="text-[#5e6b78]">Australian awards remain curated until AusTender / GrantConnect wire in.</span>}
      <span className="text-[#5e6b78]">Research context, never advice.</span>
    </p>
  );
}

/**
 * Government awards - official contracts + grants tied to tickers and themes, Australian
 * sources first-class (AusTender / GrantConnect / ARENA / data.gov.au) alongside US
 * (USAspending / SAM.gov / Grants.gov). Official spend that can move the outlook before
 * consensus adjusts. The US section is now LIVE USAspending data merged over the curated sample
 * (2026-07-27 audit V10 fix - the cron-warmed live feed used to reach no user); provenance is
 * disclosed (live | mixed | sample). Research only.
 */
export function GovAwardsView({
  awards,
  source = 'sample',
  fetchedAt = '',
  liveAwardCount = 0,
}: {
  awards?: GovAward[];
  source?: GovAwardsProvenance;
  fetchedAt?: string;
  liveAwardCount?: number;
}) {
  // Degrade to the static sample if the page did not pass resolved awards (never throws upstream).
  const all = awards && awards.length > 0 ? awards : listAwards();
  const byDate = (a: GovAward, b: GovAward) => b.date.localeCompare(a.date);
  const au = all.filter((a) => a.region === 'AU').sort(byDate);
  const us = all.filter((a) => a.region === 'US').sort(byDate);

  return (
    <section className="terminal-panel space-y-3 rounded-md p-3">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#263241] bg-[#0d141c] text-[#f3a33a]">
          <Landmark size={14} />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Government awards</p>
          <p className="mt-0.5 text-[11px] leading-snug text-[#a8b5c2]">
            Official contracts + grants that move the outlook before consensus - tied to themes + tickers.
          </p>
        </div>
      </div>

      <RegionSection title="Australia" flag="🇦🇺" awards={au} />
      <RegionSection title="United States" flag="🇺🇸" awards={us} />

      <ProvenanceBadge source={source} fetchedAt={fetchedAt} liveAwardCount={liveAwardCount} />
    </section>
  );
}
