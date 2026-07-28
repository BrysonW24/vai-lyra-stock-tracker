'use client';

import { useState } from 'react';

// The six "ultimate goal" cards from the Setup Companion, ported to the landing page.
// Front = the viz + one punchy line; click (or Enter/Space) flips to the detail.
// Statuses stay honest: the live bot is the destination, not a shipped feature.

type Badge = 'free' | 'opt' | 'paid';

const BADGE_CLASS: Record<Badge, string> = {
  free: 'text-[#189a66] bg-[#e7f6ef] border-[#c3e8d5]',
  opt: 'text-[#1E63FF] bg-[#eaf1ff] border-[#cdddff]',
  paid: 'text-[#b45a1d] bg-[#fdf3e4] border-[#f2d4ae]',
};

interface GoalCard {
  title: string;
  lede: string;
  back: string;
  badge: Badge;
  status: string;
  future?: boolean;
  viz: React.ReactNode;
}

function RadarViz() {
  return (
    <svg className="ug-fill" viewBox="0 0 360 130" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id="ug-swgrad" x1="0" y1="1" x2="0" y2="0">
          <stop stopColor="#1E63FF" stopOpacity=".9" />
          <stop offset="1" stopColor="#5BC8FF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle className="ug-ring" cx="180" cy="124" r="34" />
      <circle className="ug-ring" cx="180" cy="124" r="68" />
      <circle className="ug-ring" cx="180" cy="124" r="102" />
      <g className="ug-arm"><line x1="180" y1="124" x2="180" y2="26" stroke="url(#ug-swgrad)" strokeWidth="2" /></g>
      <circle className="ug-blip" cx="224" cy="86" r="3.5" fill="#1E63FF" />
      <circle className="ug-blip ug-b2" cx="138" cy="96" r="3.5" fill="#43d18b" />
      <circle className="ug-blip ug-b3" cx="204" cy="112" r="3.5" fill="#f3a33a" />
    </svg>
  );
}

function ScoreViz() {
  return (
    <svg className="ug-fill" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path className="ug-drawline" d="M10 38 C 40 58, 55 92, 85 96 S 140 66, 190 22" fill="none" stroke="#1E63FF" strokeWidth="2.5" strokeLinecap="round" />
      <g>
        <rect className="ug-wbar" x="18" y="78" width="14" height="25" rx="2" fill="#3b5bdb" opacity=".85" />
        <rect className="ug-wbar ug-w2" x="40" y="73" width="14" height="30" rx="2" fill="#1E63FF" opacity=".85" />
        <rect className="ug-wbar ug-w3" x="62" y="88" width="14" height="15" rx="2" fill="#5BC8FF" opacity=".9" />
        <rect className="ug-wbar ug-w4" x="84" y="88" width="14" height="15" rx="2" fill="#43d18b" opacity=".9" />
        <rect className="ug-wbar ug-w5" x="106" y="88" width="14" height="15" rx="2" fill="#f3a33a" opacity=".9" />
      </g>
      <text x="18" y="114" fontSize="7.5" fill="#8290a0" fontFamily="ui-monospace,Menlo,monospace">RSI 25 · MACD 30 · PRICE 15 · TREND 15 · VOL 15</text>
    </svg>
  );
}

function ByokViz() {
  return (
    <div className="ug-flowbox">
      <div className="ug-provrow">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ug-prov" src="/logos/openai.svg" alt="OpenAI" width={24} height={24} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ug-prov ug-p2" src="/logos/anthropic-claude.svg" alt="Anthropic Claude" width={24} height={24} />
      </div>
      <p className="ug-chips">OPENAI · ANTHROPIC · GEMINI · +MORE</p>
      <div className="ug-typing"><i>&quot;NVDA scores 84: RSI turning up.&quot;</i></div>
      <p className="ug-cap">THE ENGINE OWNS EVERY NUMBER</p>
    </div>
  );
}

function AlertsViz() {
  const pills: Array<{ logo: string; label: string; ml: number; delay: string }> = [
    { logo: '/logos/telegram.svg', label: 'Strong setup · NVDA 84', ml: 0, delay: '0s' },
    { logo: '/logos/slack.svg', label: 'Feedback -> #lyra', ml: 26, delay: '.45s' },
    { logo: '/logos/whatsapp.svg', label: 'Hourly summary (soon)', ml: 12, delay: '.9s' },
  ];
  return (
    <div className="ug-flowbox">
      <div className="ug-notifs">
        {pills.map((p) => (
          <div key={p.label} className="ug-notif" style={{ marginLeft: p.ml, animationDelay: p.delay }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.logo} alt="" width={14} height={14} />
            <span>{p.label}</span>
          </div>
        ))}
      </div>
      <p className="ug-cap">OPT-IN · QUIET HOURS · PER-CHANNEL</p>
    </div>
  );
}

function SoloAlertsViz() {
  return (
    <div className="ug-flowbox">
      <div className="ug-notifs">
        <div className="ug-notif">
          <span aria-hidden>◉</span>
          <span>Signal change · visible in console</span>
        </div>
        <div className="ug-notif" style={{ marginLeft: 24 }}>
          <span aria-hidden>⌁</span>
          <span>Watchlist · stored on device</span>
        </div>
      </div>
      <p className="ug-cap">NO BACKGROUND DELIVERY · NO DESTINATION DATA</p>
    </div>
  );
}

function PaperViz() {
  return (
    <svg className="ug-fill" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path className="ug-equity" d="M10 100 L40 100 L40 88 L70 88 L70 92 L100 92 L100 70 L130 70 L130 58 L160 58 L160 40 L190 40" fill="none" stroke="#189a66" strokeWidth="2.5" strokeLinejoin="round" />
      <g fontSize="8" fontFamily="ui-monospace,Menlo,monospace">
        <text className="ug-tick ug-t1" x="42" y="82" fill="#189a66">BUY</text>
        <text className="ug-tick ug-t2" x="102" y="64" fill="#189a66">BUY</text>
        <text className="ug-tick ug-t3" x="132" y="52" fill="#d64545">STOP</text>
      </g>
      <text x="10" y="114" fontSize="7.5" fill="#8290a0" fontFamily="ui-monospace,Menlo,monospace">REAL FEES · SLIPPAGE · RISK REFUSALS MODELLED</text>
    </svg>
  );
}

function GatesViz() {
  return (
    <svg className="ug-fill" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g fontSize="8" fontFamily="ui-monospace,Menlo,monospace" textAnchor="middle">
        <g className="ug-gate"><rect x="20" y="46" width="42" height="26" rx="6" fill="none" stroke="#43d18b" strokeWidth="1.5" /><text x="41" y="62" fill="#189a66">RISK ✓</text></g>
        <g className="ug-gate ug-g2"><rect x="79" y="46" width="42" height="26" rx="6" fill="none" stroke="#43d18b" strokeWidth="1.5" /><text x="100" y="62" fill="#189a66">SIZE ✓</text></g>
        <g className="ug-gate ug-g3"><rect x="138" y="46" width="42" height="26" rx="6" fill="none" stroke="#f3a33a" strokeWidth="1.5" /><text x="159" y="62" fill="#b45a1d">HUMAN</text></g>
        <line x1="62" y1="59" x2="79" y2="59" stroke="#c6cdd9" strokeWidth="1.5" />
        <line x1="121" y1="59" x2="138" y2="59" stroke="#c6cdd9" strokeWidth="1.5" />
        <circle className="ug-core" cx="159" cy="30" r="5" fill="#f3a33a" />
        <text x="100" y="98" fill="#8290a0">EVERY ORDER PASSES EVERY GATE - OR IT NEVER EXISTS</text>
      </g>
    </svg>
  );
}

const CARDS: GoalCard[] = [
  {
    title: 'Small-cap signal radar',
    lede: 'Finds the small-cap names nobody is watching yet.',
    back: 'The discovery engine sweeps beyond the megacaps: small-cap universe scans, tracked 13F investor moves, and deterministic signal events surface names early.',
    badge: 'free', status: 'live in the app', viz: <RadarViz />,
  },
  {
    title: 'Analysis you can audit',
    lede: 'Open maths - every score auditable and backtestable.',
    back: 'The deterministic 0-100 score - five weighted blocks computed in code, mirrored in Pine for TradingView backtests, peeled open by the Investigation System.',
    badge: 'free', status: 'live in the app', viz: <ScoreViz />,
  },
  {
    title: 'AI that explains - keys you own',
    lede: 'Bring your own AI key - held in your browser, never stored server-side.',
    back: "Paste any provider's key in Settings - your browser holds it and sends it only with your own requests to your own deployment; it is never stored server-side. The engine decides every number; the AI only phrases it.",
    badge: 'opt', status: 'live in the app · BYOK', viz: <ByokViz />,
  },
  {
    title: 'Signals where you are',
    lede: 'Telegram, Slack and web push - urgency comes to you.',
    back: 'One dispatch layer, your channels: Telegram live today, Slack into your own webhook, web push with zero accounts - and WhatsApp scaffolded honestly, not oversold.',
    badge: 'opt', status: 'telegram + slack + push live', viz: <AlertsViz />,
  },
  {
    title: 'Paper bot proves it',
    lede: 'Proves the strategy with real fees and slippage.',
    back: 'The paper-trading bot runs the strategy with realistic fees and slippage, and Bot Readiness - the pre-trade risk engine - refuses unsafe orders before they exist.',
    badge: 'free', status: 'live in the app', viz: <PaperViz />,
  },
  {
    title: 'The live bot - the goal',
    lede: "The same engine on a real account - once it's earned.",
    back: 'The destination: live execution only after the paper bot proves it, and always behind the human arming gate. Not live yet - and honest about it.',
    badge: 'paid', status: 'the destination · human-gated', future: true, viz: <GatesViz />,
  },
];

export function UltimateGoals({ soloMode = false }: { soloMode?: boolean }) {
  const cards = soloMode
    ? CARDS.map((card, index) =>
        index === 3
          ? {
              ...card,
              lede: 'See changes when you open Solo; no background delivery is promised.',
              back: 'Solo has no account-backed notification destination. Push, Telegram, Slack, WhatsApp, and scheduled digests belong to the Community build.',
              status: 'in-console only',
              viz: <SoloAlertsViz />,
            }
          : card,
      )
    : CARDS;
  const [flipped, setFlipped] = useState<boolean[]>(() => cards.map(() => false));
  const toggle = (i: number) =>
    setFlipped((prev) => prev.map((v, j) => (j === i ? !v : v)));

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#1E63FF]">The ultimate goal</p>
      <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#0E1E3A] md:text-3xl">
        From signal to <span className="text-[#1E63FF]">self-driving research</span>.
      </h2>
      <p className="mt-2 text-sm text-[#5A6B82]">Tap any card for the detail.</p>

      <div className="ug-goals mt-6">
        {cards.map((c, i) => (
          <div
            key={c.title}
            className={`ug-goal${c.future ? ' ug-future' : ''}${flipped[i] ? ' ug-flip' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={flipped[i]}
            aria-label={`${c.title} - flip for detail`}
            onClick={() => toggle(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(i); }
            }}
          >
            <div className="ug-gin">
              {/* Only the visible face is exposed to assistive tech */}
              <div className="ug-face" aria-hidden={flipped[i]}>
                <span className="ug-hint">more</span>
                <div className={`ug-viz${c.viz && (i === 2 || i === 3) ? ' ug-flow' : ''}`}>{c.viz}</div>
                <div className="ug-body">
                  <h3><span className="ug-num">{i + 1}</span> {c.title}</h3>
                  <p className="ug-lede">{c.lede}</p>
                </div>
                <span className={`ug-badge ${BADGE_CLASS[c.badge]}`}>{c.status}</span>
              </div>
              <div className="ug-face ug-back" aria-hidden={!flipped[i]}>
                <span className="ug-hint">back</span>
                <p className="ug-bl">{i + 1} · {c.title}</p>
                <p className="ug-backtext">{c.back}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Scoped styles for the flip + viz animations (mirrors the Setup Companion) */}
      <style>{`
        .ug-goals { display: grid; gap: 13px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
        .ug-goal { position: relative; perspective: 1400px; cursor: pointer; outline: none; -webkit-tap-highlight-color: transparent; transition: transform .2s; }
        .ug-goal:hover { transform: translateY(-3px); }
        .ug-gin { display: grid; transform-style: preserve-3d; transition: transform .65s cubic-bezier(.2,.7,.25,1); }
        .ug-flip .ug-gin { transform: rotateY(180deg); }
        .ug-face {
          grid-area: 1 / 1; position: relative; display: flex; flex-direction: column; overflow: hidden;
          backface-visibility: hidden; -webkit-backface-visibility: hidden;
          border: 1px solid rgba(14,30,58,.10); border-radius: 16px; padding: 0 0 15px;
          background: rgba(255,255,255,.72); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          box-shadow: 0 10px 30px rgba(14,30,58,.06); transition: box-shadow .2s;
        }
        .ug-goal:hover .ug-face { box-shadow: 0 20px 48px rgba(14,30,58,.12); }
        .ug-goal:focus-visible .ug-face { border-color: rgba(30,99,255,.5); }
        .ug-back { transform: rotateY(180deg); padding: 18px 18px 16px; gap: 8px; justify-content: center; }
        .ug-backtext { font-size: 13px; color: #5A6B82; line-height: 1.65; }
        .ug-bl { font-family: ui-monospace, Menlo, monospace; font-size: 9.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #1E63FF; }
        .ug-hint {
          position: absolute; top: 10px; right: 12px; z-index: 2; pointer-events: none;
          font-family: ui-monospace, Menlo, monospace; font-size: 8.5px; font-weight: 700;
          letter-spacing: .12em; text-transform: uppercase; color: #8290a0;
          border: 1px solid rgba(14,30,58,.10); background: rgba(255,255,255,.85); border-radius: 999px; padding: 3px 8px;
        }
        .ug-face h3 { font-size: 15px; font-weight: 700; color: #0E1E3A; display: flex; align-items: center; gap: 8px; }
        .ug-lede { font-size: 13.2px; color: #5A6B82; margin-top: 6px; }
        .ug-num {
          display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 6px;
          font-size: 11px; font-weight: 800; color: #fff; background: linear-gradient(135deg, #3b5bdb, #43d18b);
        }
        .ug-future .ug-num { background: linear-gradient(135deg, #43d18b, #f3a33a); }
        .ug-body { padding: 12px 16px 0; }
        .ug-badge {
          margin: 12px 16px 0; align-self: flex-start; border-radius: 999px; border-width: 1px; border-style: solid;
          font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; padding: 2.5px 9px;
        }
        .ug-future .ug-face::before {
          content: ""; position: absolute; inset: 0; border-radius: 16px; padding: 1px; pointer-events: none;
          background: linear-gradient(120deg, rgba(59,91,219,.5), rgba(67,209,139,.5), rgba(243,163,58,.6), rgba(59,91,219,.5));
          background-size: 300% 300%; animation: ug-bordershift 6s ease infinite;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
        }
        @keyframes ug-bordershift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        .ug-viz { height: 120px; position: relative; overflow: hidden; flex: none; background: linear-gradient(180deg, rgba(30,99,255,.05), rgba(255,255,255,0)); }
        .ug-fill { position: absolute; inset: 0; width: 100%; height: 100%; }
        .ug-flow, .ug-flowbox { display: flex; flex-direction: column; align-items: center; }
        .ug-flow { justify-content: flex-start; height: 126px; }
        .ug-flowbox { gap: 6px; padding: 12px 14px 8px; width: 100%; height: 100%; }
        .ug-ring { fill: none; stroke: rgba(30,99,255,.18); }
        .ug-arm { transform-origin: 180px 124px; animation: ug-spin 4.5s linear infinite; }
        @keyframes ug-spin { to { transform: rotate(360deg); } }
        .ug-blip { animation: ug-blipk 4.5s ease-out infinite; }
        .ug-b2 { animation-delay: 1.6s; } .ug-b3 { animation-delay: 3.1s; }
        @keyframes ug-blipk { 0%, 12% { opacity: 0; r: 2; } 16% { opacity: 1; } 45% { opacity: .9; } 100% { opacity: 0; r: 5; } }
        .ug-drawline { stroke-dasharray: 340; stroke-dashoffset: 340; animation: ug-draw 3.2s ease forwards .3s; }
        @keyframes ug-draw { to { stroke-dashoffset: 0; } }
        .ug-wbar { transform: scaleY(0); transform-origin: bottom; animation: ug-rise .9s cubic-bezier(.2,.8,.2,1) forwards; }
        .ug-w2 { animation-delay: .25s; } .ug-w3 { animation-delay: .5s; } .ug-w4 { animation-delay: .75s; } .ug-w5 { animation-delay: 1s; }
        @keyframes ug-rise { to { transform: scaleY(1); } }
        .ug-equity { stroke-dasharray: 300; stroke-dashoffset: 300; animation: ug-draw 2.8s ease forwards .4s; }
        .ug-tick { opacity: 0; animation: ug-pop .5s ease forwards; }
        .ug-t1 { animation-delay: 1.1s; } .ug-t2 { animation-delay: 1.7s; } .ug-t3 { animation-delay: 2.3s; }
        @keyframes ug-pop { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .ug-gate { opacity: .25; animation: ug-gateon 1s ease forwards; }
        .ug-g2 { animation-delay: .8s; } .ug-g3 { animation-delay: 1.6s; }
        @keyframes ug-gateon { to { opacity: 1; } }
        .ug-core { animation: ug-corepulse 2.2s ease-in-out infinite 2.4s; }
        @keyframes ug-corepulse { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
        .ug-provrow { display: flex; justify-content: center; gap: 16px; align-items: center; }
        .ug-prov { width: 24px; height: 24px; object-fit: contain; opacity: 0; animation: ug-pop .6s ease forwards; }
        .ug-p2 { animation-delay: .3s; }
        .ug-chips {
          font-size: 8.5px; letter-spacing: .1em; color: #8290a0; text-align: center;
          font-family: ui-monospace, Menlo, monospace; opacity: 0; animation: ug-pop .6s ease forwards .7s;
        }
        .ug-typing {
          max-width: 100%; border: 1px solid rgba(14,30,58,.10); background: #fff; border-radius: 9px;
          padding: 5px 10px; font-family: ui-monospace, Menlo, monospace; font-size: 10px;
          color: #0E1E3A; white-space: nowrap; overflow: hidden;
        }
        .ug-typing i { font-style: normal; display: inline-block; overflow: hidden; white-space: nowrap; vertical-align: bottom; max-width: 0; animation: ug-type 2.6s steps(33) forwards 1.1s; }
        @keyframes ug-type { to { max-width: 100%; } }
        .ug-cap {
          font-size: 8.5px; letter-spacing: .08em; line-height: 1.4; color: #8290a0;
          font-family: ui-monospace, Menlo, monospace; text-align: center; margin-top: auto;
        }
        .ug-notifs { display: flex; flex-direction: column; gap: 6px; align-self: stretch; }
        .ug-notif {
          display: flex; align-items: center; gap: 7px; align-self: flex-start;
          border: 1px solid rgba(14,30,58,.10); background: #fff; border-radius: 9px; padding: 4px 10px;
          font-size: 10px; font-family: ui-monospace, Menlo, monospace; color: #0E1E3A;
          box-shadow: 0 4px 12px rgba(14,30,58,.08); opacity: 0; transform: translateX(-14px);
          animation: ug-slidein .55s cubic-bezier(.2,.8,.2,1) forwards;
        }
        @keyframes ug-slidein { to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .ug-gin { transition: none; }
          .ug-future .ug-face::before { animation: none; }
          .ug-arm, .ug-blip, .ug-core { animation: none; }
          .ug-drawline, .ug-equity { stroke-dashoffset: 0; animation: none; }
          .ug-wbar { transform: none; animation: none; }
          .ug-tick, .ug-gate, .ug-prov, .ug-chips, .ug-notif { opacity: 1; animation: none; transform: none; }
          .ug-typing i { max-width: 100%; animation: none; }
        }
      `}</style>
    </div>
  );
}
