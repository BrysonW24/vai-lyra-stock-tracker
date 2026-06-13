import { FileText, Quote } from 'lucide-react';
import { TickerLogo } from '@/components/TickerLogo';
import { SourceFavicon } from '@/components/SourceFavicon';
import { FILINGS_SAMPLE, listFilings } from '@/lib/filings';
import { TRANSCRIPTS_SAMPLE, listTranscripts, type PassageSentiment } from '@/lib/transcripts';

const SENTIMENT_DOT: Record<PassageSentiment, string> = {
  positive: 'bg-[#43d18b]',
  neutral: 'bg-[#8190a0]',
  negative: 'bg-[#ff6b6b]',
};

function FilingsSection() {
  const filings = listFilings();
  return (
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="flex items-center gap-2 border-b border-[#1b2530] px-3 py-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#263241] bg-[#0d141c] text-[#7fb0ff]">
          <FileText size={14} />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">What changed · filings</p>
          <p className="mt-0.5 text-[11px] leading-snug text-[#a8b5c2]">8-K / 10-Q / S-1 in plain English, with the exact passages - sourced to EDGAR.</p>
        </div>
      </div>
      <div className="divide-y divide-[#141c25]">
        {filings.map((f) => (
          <div key={f.id} className="px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <TickerLogo symbol={f.symbol} companyName={f.companyName} size={14} />
              <span className="font-mono text-[12px] font-semibold text-[#eef3f8]">{f.symbol}</span>
              <span className="rounded border border-[#263241] bg-[#0b1016] px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.1em] text-[#a8b5c2]">{f.form}</span>
              <span className="font-mono text-[9px] text-[#5e6b78]">{f.filedAt}</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-[#dbe5ee]">{f.whatChanged}</p>
            <div className="mt-1.5 space-y-1">
              {f.passages.map((p) => (
                <div key={p.section} className="rounded border-l-2 border-[#27406b] bg-[#0b1016] px-2 py-1">
                  <p className="font-mono text-[8px] uppercase tracking-[0.1em] text-[#5e6b78]">{p.section}</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-[#a8b5c2]">{p.excerpt}</p>
                </div>
              ))}
            </div>
            <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 font-mono text-[9px] text-[#5e6b78] transition hover:text-[#dbe5ee]">
              <SourceFavicon domain="sec.gov" sourceName="SEC EDGAR" /> SEC EDGAR
            </a>
          </div>
        ))}
      </div>
      {FILINGS_SAMPLE && (
        <p className="border-t border-[#1b2530] px-3 py-1.5 font-mono text-[10px] text-[#5e6b78]">
          Illustrative sample until the live EDGAR pull wires in. Passages shown with their source + date. Research only.
        </p>
      )}
    </section>
  );
}

function TranscriptSection() {
  const passages = listTranscripts();
  return (
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="flex items-center gap-2 border-b border-[#1b2530] px-3 py-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#263241] bg-[#0d141c] text-[#a78bfa]">
          <Quote size={14} />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Transcript evidence</p>
          <p className="mt-0.5 text-[11px] leading-snug text-[#a8b5c2]">Earnings-call passages - the exact quote, who said it, and the topic.</p>
        </div>
      </div>
      <div className="divide-y divide-[#141c25]">
        {passages.map((p) => (
          <div key={p.id} className="px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SENTIMENT_DOT[p.sentiment]}`} />
              <TickerLogo symbol={p.symbol} companyName={p.companyName} size={14} />
              <span className="font-mono text-[12px] font-semibold text-[#eef3f8]">{p.symbol}</span>
              <span className="font-mono text-[9px] text-[#5e6b78]">{p.quarter} · {p.topic}</span>
            </div>
            <p className="mt-1 border-l-2 border-[#3a2f55] bg-[#0b1016] px-2 py-1.5 text-[11px] italic leading-snug text-[#dbe5ee]">{p.quote}</p>
            <p className="mt-1 font-mono text-[9px] text-[#8190a0]">{p.speaker} · {p.role}</p>
            <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-mono text-[9px] text-[#5e6b78] transition hover:text-[#dbe5ee]">
              <SourceFavicon domain={new URL(p.sourceUrl).hostname} sourceName="IR transcript" /> IR transcript · {p.date}
            </a>
          </div>
        ))}
      </div>
      {TRANSCRIPTS_SAMPLE && (
        <p className="border-t border-[#1b2530] px-3 py-1.5 font-mono text-[10px] text-[#5e6b78]">
          Illustrative sample until the live transcript feed wires in. Research only.
        </p>
      )}
    </section>
  );
}

/**
 * Filings & evidence - the primary-source layer: "what changed" in recent filings with the
 * exact passages, plus earnings-transcript evidence stacks, all sourced + dated. The trust
 * spine the grounded copilot reads from. Research only.
 */
export function FilingsView() {
  return (
    <div className="space-y-3">
      <FilingsSection />
      <TranscriptSection />
    </div>
  );
}
