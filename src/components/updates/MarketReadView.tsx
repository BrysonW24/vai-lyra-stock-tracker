import { AiGeneratedLabel } from '@/components/AiGeneratedLabel';
import type { PublishedRead } from '@/lib/updates/store';
import { paragraphs, sessionLabel, writerLabel } from '@/lib/updates/view';
import { pageTitleClass, panelClass, panelSoftClass } from '@/lib/ui';

/**
 * The market read, as published: the written read (when a model's passed every check) above the
 * figures it was written from. The figures are composed by code and are always there; the prose is
 * the part that can be missing, and when it is the page says why instead of leaving a gap.
 */
export function MarketReadView({ read, available }: { read: PublishedRead | null; available: boolean }) {
  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h1 className={pageTitleClass}>Updates</h1>
        <p className="text-xs text-ink-muted">
          A read of the last US session across the names Lyra scans: what moved, and what it did to the setups. The figures come from the engine;
          the commentary is written by an open-source model and checked against them. Research, not advice.
        </p>
      </header>

      {!read ? (
        <div className={`${panelClass} p-4 text-sm text-ink-muted`}>
          {available
            ? 'No read has been published yet. One is written after each US session closes and appears here once it has been checked.'
            : 'Updates are not switched on for this deployment.'}
        </div>
      ) : (
        <>
          <h2 className="text-sm font-semibold text-ink">US session of {sessionLabel(read.session)}</h2>

          {read.prose ? (
            <article className={`${panelClass} space-y-3 p-4`}>
              <AiGeneratedLabel size={12} />
              {paragraphs(read.prose).map((paragraph, index) => (
                <p key={index} className="text-sm leading-relaxed text-ink">
                  {paragraph}
                </p>
              ))}
              <p className="text-[11px] leading-relaxed text-ink-muted">{writerLabel(read)}</p>
            </article>
          ) : (
            <p className={`${panelSoftClass} p-3 text-xs text-ink-muted`}>{read.proseNote ?? 'Figures only for this session.'}</p>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {read.figures.map((block) => (
              <div key={block.title} className={`${panelClass} space-y-1.5 p-3`}>
                <h3 className="text-xs font-semibold text-ink">{block.title}</h3>
                <ul className="space-y-1">
                  {block.lines.map((line, index) => (
                    <li key={index} className="text-xs leading-relaxed text-ink-muted">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
