import { Award, FileText, Landmark, type LucideIcon } from 'lucide-react';
import { TickerLogo } from '@/components/TickerLogo';
import { SourceFavicon } from '@/components/SourceFavicon';
import { GOV_AWARDS_SAMPLE, listAwards, type AwardRegion, type GovAward } from '@/lib/gov-awards';

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

function RegionSection({ title, flag, region }: { title: string; flag: string; region: AwardRegion }) {
  const awards = listAwards(region);
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

/**
 * Government awards - official contracts + grants tied to tickers and themes, Australian
 * sources first-class (AusTender / GrantConnect / ARENA / data.gov.au) alongside US
 * (USAspending / SAM.gov / Grants.gov). Official spend that can move the outlook before
 * consensus adjusts. Curated sample for now; live feeds wire in next. Research only.
 */
export function GovAwardsView() {
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

      <RegionSection title="Australia" flag="🇦🇺" region="AU" />
      <RegionSection title="United States" flag="🇺🇸" region="US" />

      {GOV_AWARDS_SAMPLE && (
        <p className="border-t border-[#1b2530] pt-1.5 font-mono text-[10px] leading-snug text-[#5e6b78]">
          Illustrative sample until live AusTender / GrantConnect / USAspending feeds wire in. Research context, never advice.
        </p>
      )}
    </section>
  );
}
