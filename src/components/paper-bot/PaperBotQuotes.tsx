'use client';

import { useEffect, useState } from 'react';
import { Quote } from 'lucide-react';

interface InvestorQuote {
  text: string;
  author: string;
  title: string;
  avatar: string; // initials
  color: string;  // accent colour for avatar bg
}

const QUOTES: InvestorQuote[] = [
  {
    text: "The stock market is a device for transferring money from the impatient to the patient.",
    author: "Warren Buffett",
    title: "Chairman, Berkshire Hathaway",
    avatar: "WB",
    color: "#3b5bdb",
  },
  {
    text: "The most important investment you can make is in yourself.",
    author: "Warren Buffett",
    title: "Chairman, Berkshire Hathaway",
    avatar: "WB",
    color: "#3b5bdb",
  },
  {
    text: "It's not what happens to you, but how you react to it that matters.",
    author: "Charlie Munger",
    title: "Vice Chairman, Berkshire Hathaway",
    avatar: "CM",
    color: "#43d18b",
  },
  {
    text: "Show me the incentive and I'll show you the outcome.",
    author: "Charlie Munger",
    title: "Vice Chairman, Berkshire Hathaway",
    avatar: "CM",
    color: "#43d18b",
  },
  {
    text: "The key to making money in stocks is not to get scared out of them.",
    author: "Peter Lynch",
    title: "Former Manager, Fidelity Magellan",
    avatar: "PL",
    color: "#f3a33a",
  },
  {
    text: "Know what you own, and know why you own it.",
    author: "Peter Lynch",
    title: "Former Manager, Fidelity Magellan",
    avatar: "PL",
    color: "#f3a33a",
  },
  {
    text: "The best investment you can make is in your own abilities. Anything you can do to develop your own abilities or business is likely to be more productive.",
    author: "Warren Buffett",
    title: "Chairman, Berkshire Hathaway",
    avatar: "WB",
    color: "#3b5bdb",
  },
  {
    text: "The biggest risk of all is not taking one.",
    author: "Mellody Hobson",
    title: "Co-CEO, Ariel Investments",
    avatar: "MH",
    color: "#8aa2ff",
  },
  {
    text: "Compound interest is the eighth wonder of the world. He who understands it, earns it; he who doesn't, pays it.",
    author: "Albert Einstein",
    title: "Physicist & Investor in Ideas",
    avatar: "AE",
    color: "#e879f9",
  },
  {
    text: "I'm only rich because I know when I'm wrong. I basically have survived by recognising my mistakes.",
    author: "George Soros",
    title: "Founder, Soros Fund Management",
    avatar: "GS",
    color: "#ff6b6b",
  },
  {
    text: "It takes 20 years to build a reputation and five minutes to ruin it. If you think about that, you'll do things differently.",
    author: "Warren Buffett",
    title: "Chairman, Berkshire Hathaway",
    avatar: "WB",
    color: "#3b5bdb",
  },
  {
    text: "Earnings don't move the overall market; it's the Federal Reserve Board. And whatever you do, focus on the Fed.",
    author: "Stan Druckenmiller",
    title: "CEO, Duquesne Family Office",
    avatar: "SD",
    color: "#43d18b",
  },
  {
    text: "I've learned many things from George Soros, but perhaps the most significant is that it's not whether you're right or wrong that's important, but how much money you make when you're right and how much you lose when you're wrong.",
    author: "Stan Druckenmiller",
    title: "CEO, Duquesne Family Office",
    avatar: "SD",
    color: "#43d18b",
  },
  {
    text: "Find a job you love and you'll never work a day in your life.",
    author: "Bill Ackman",
    title: "Founder, Pershing Square Capital",
    avatar: "BA",
    color: "#f3a33a",
  },
  {
    text: "The best way to predict your future is to create it.",
    author: "Tony Robbins",
    title: "Author & Peak Performance Coach",
    avatar: "TR",
    color: "#ff8a5c",
  },
  {
    text: "In investing, what is comfortable is rarely profitable.",
    author: "Robert Arnott",
    title: "Chairman, Research Affiliates",
    avatar: "RA",
    color: "#8aa2ff",
  },
  {
    text: "The time to buy is when there's blood in the streets.",
    author: "Baron Rothschild",
    title: "18th-century British Nobleman",
    avatar: "BR",
    color: "#ff6b6b",
  },
  {
    text: "Wide diversification is only required when investors do not understand what they are doing.",
    author: "Warren Buffett",
    title: "Chairman, Berkshire Hathaway",
    avatar: "WB",
    color: "#3b5bdb",
  },
  {
    text: "Risk comes from not knowing what you're doing.",
    author: "Warren Buffett",
    title: "Chairman, Berkshire Hathaway",
    avatar: "WB",
    color: "#3b5bdb",
  },
  {
    text: "October: This is one of the peculiarly dangerous months to speculate in stocks in. The others are July, January, September, April, November, May, March, June, December, August, and February.",
    author: "Mark Twain",
    title: "Author & Humorist",
    avatar: "MT",
    color: "#e879f9",
  },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Rotating investor quotes panel for the Paper Bot page.
 * Cycles through wisdom from Buffett, Munger, Lynch, Druckenmiller, Ackman & more.
 */
export function PaperBotQuotes() {
  const [order, setOrder] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOrder(shuffle(QUOTES.map((_, i) => i)));
    const id = window.setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setPos(p => p + 1);
        setFading(false);
      }, 400);
    }, 18000);
    return () => window.clearInterval(id);
  }, []);

  function next() {
    setFading(true);
    setTimeout(() => {
      setPos(p => p + 1);
      setFading(false);
    }, 300);
  }

  const quote = mounted && order.length
    ? QUOTES[order[pos % order.length]]
    : QUOTES[0];

  const dotIndex = mounted && order.length ? pos % order.length : 0;

  return (
    <section className="terminal-panel rounded-2xl overflow-hidden">
      {/* Header strip */}
      <div className="flex items-center gap-2 border-b border-[#111d28] px-4 py-2.5">
        <Quote size={12} className="text-[#8aa2ff] shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5e6b78]">From the Greats</span>
        <span className="ml-auto text-[9px] text-[#3a4a5a]">tap to advance</span>
      </div>

      {/* Quote body */}
      <button
        type="button"
        onClick={next}
        className="block w-full text-left px-4 py-4 transition-opacity duration-300 group"
        style={{ opacity: fading ? 0 : 1 }}
      >
        {/* Big decorative quote mark */}
        <div
          className="font-serif text-[72px] leading-none font-black select-none mb-1 transition-colors"
          style={{ color: `${quote.color}22`, lineHeight: '0.7' }}
        >
          &ldquo;
        </div>

        <p className="text-[13px] leading-relaxed text-[#c8d3de] font-medium italic mb-4">
          &ldquo;{quote.text}&rdquo;
        </p>

        {/* Author row */}
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[11px] font-black text-white"
            style={{ backgroundColor: `${quote.color}33`, border: `1px solid ${quote.color}44`, color: quote.color }}
          >
            {quote.avatar}
          </div>
          <div>
            <p className="text-[12px] font-bold text-[#eef3f8]">{quote.author}</p>
            <p className="text-[10px] text-[#5e6b78]">{quote.title}</p>
          </div>
          {/* Accent dot */}
          <div
            className="ml-auto h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: quote.color, boxShadow: `0 0 8px ${quote.color}` }}
          />
        </div>
      </button>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 border-t border-[#111d28] px-4 py-2.5">
        {Array.from({ length: Math.min(7, QUOTES.length) }).map((_, i) => {
          const isActive = i === dotIndex % 7;
          return (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-500"
              style={{
                width: isActive ? '16px' : '4px',
                backgroundColor: isActive ? quote.color : '#1d2733',
              }}
            />
          );
        })}
      </div>

      {/* Community teaser */}
      <div className="border-t border-[#111d28] bg-[#070b10] px-4 py-2.5 flex items-center gap-2">
        <div className="flex -space-x-1.5">
          {['#3b5bdb','#43d18b','#f3a33a','#e879f9'].map((c, i) => (
            <div
              key={i}
              className="h-5 w-5 rounded-full border border-[#07090c] grid place-items-center text-[7px] font-bold text-white"
              style={{ backgroundColor: c }}
            >
              {['JL','SK','AT','MR'][i]}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#3a4a5a] flex-1">Community chat <span className="text-[#8aa2ff]">coming soon</span> - share trades, ideas & conviction</p>
      </div>
    </section>
  );
}
