/**
 * The joined read - what the Australian numbers mean TOGETHER.
 *
 * The founder's brief (2026-11-18), after a video on the June-quarter 2026 accounts: GDP grew
 * 2.1% but GDP per person only 0.7%, so "we're not getting rich". This engine makes that
 * reading - and the one the video's framing missed: total output growing is not the same as
 * getting more productive. In that release output per hour FELL; output rose because more
 * hours were worked. The read keeps four things apart that a headline GDP figure blurs:
 * total output, output per person, output per hour, and what income actually buys.
 *
 * Contract (see types.ts for the full rationale):
 * - Deterministic. Same snapshot in, same read out. No model, no network, no clock.
 * - Every verdict comes from the named THRESHOLDS below, and names the indicators it used.
 * - Every sentence is assembled from the figures it quotes. There is no stored opinion that
 *   could outlive the data - the failure the 2026-08-11 audit removed from the macro strip.
 * - Missing data makes a question 'unknown' and is said out loud. Nothing is filled in.
 * - It describes; it never advises. No "buy", no "time to", no forecast of RBA decisions.
 */
import { periodLabel, latestPeriod } from './period';
import type { EconomyIndicator, EconomyQuestion, EconomyRead, EconomyVerdict } from './types';

/**
 * Every judgement the read makes, written down so it can be argued with and tested.
 * Annual figures drive verdicts wherever they exist - one quarter is noise.
 */
export const THRESHOLDS = {
  /** Annual real GDP growth at or above this is solid. Australia's long-run average is
   *  roughly 2.5-3%; 2% is a fair floor for "growing properly". */
  gdpAnnualSolid: 2.0,
  /** Annual output per person at or above this means people are sharing in growth. */
  perPersonAnnualSolid: 1.0,
  /** Real income per person, annual: above this it is rising, below the negative it is falling. */
  incomeRising: 0.5,
  incomeFalling: -0.25,
  /** Real wages within +/- this are "about flat" - a difference of two rounded series. */
  realWageFlatBand: 0.25,
  /** Output per hour, annual: at or above the long-run ~1% pace lifts living standards;
   *  below zero, each hour produced less than a year ago. */
  productivitySolid: 1.0,
  /** The RBA's inflation target band. */
  targetLow: 2.0,
  targetHigh: 3.0,
  /** Unemployment at or above this is a weak jobs market on its own. */
  unemploymentWeak: 5.0,
  /** Below this, and not rising, the jobs market reads as healthy. */
  unemploymentHealthy: 4.5,
  /** A rise of this much from the low of the recent window (3-month average vs the window's
   *  lowest month) is the classic early-warning pattern - a simplified Sahm-style signal. */
  unemploymentRiseWarning: 0.5,
  /** Underemployment at or above this alongside low unemployment = jobs, but not enough hours. */
  underemploymentHigh: 6.0,
} as const;

// --- small formatting helpers for SENTENCES (display formatting lives in the components) ---

const fmt = (v: number, dp = 1) => Math.abs(v).toFixed(dp);
const isNum = (v: number) => Number.isFinite(v);
/** "grew 2.1%" / "fell 0.2%" / "was flat" - judged at the displayed precision. */
function moved(v: number, dp = 1, up = 'grew', down = 'fell'): string {
  const r = Number(v.toFixed(dp));
  if (r === 0) return 'was flat';
  return r > 0 ? `${up} ${fmt(v, dp)}%` : `${down} ${fmt(v, dp)}%`;
}

/** Compare at the displayed precision: 0.3 - 0.2 must equal 0.1, not 0.0999... */
const tenths = (v: number) => Math.round(v * 10);

function pick(indicators: EconomyIndicator[], id: string): EconomyIndicator | undefined {
  return indicators.find((i) => i.id === id);
}

function live(i: EconomyIndicator | undefined): i is EconomyIndicator {
  return !!i && i.provenance === 'live' && isNum(i.value);
}

function present(list: (EconomyIndicator | undefined)[]): EconomyIndicator[] {
  return list.filter((i): i is EconomyIndicator => !!i);
}

// --- 1. Growth ---------------------------------------------------------------------------

function readGrowth(all: EconomyIndicator[]): EconomyQuestion {
  const gdp = pick(all, 'gdp');
  const pc = pick(all, 'gdpPerCapita');
  const pop = pick(all, 'population');
  const household = pick(all, 'contribHousehold');
  const privInv = pick(all, 'contribPrivateInvestment');
  const govServices = pick(all, 'contribGovernment');
  const pubInv = pick(all, 'contribPublicInvestment');
  const exports = pick(all, 'contribExports');
  const drivers = present([household, privInv, govServices, pubInv, exports]);
  const indicators = present([gdp, pc, pop, ...drivers]);
  const base = {
    id: 'growth',
    question: 'Is the economy growing - and is that growth reaching people?',
    cannotTell:
      'Where growth came from is not why it happened. Public demand adding to growth does not show it crowded out private activity, or that it was money well spent - only what it contributed in the quarter.',
    indicators,
  };

  const gdpA = gdp?.annual ?? Number.NaN;
  const pcA = pc?.annual ?? Number.NaN;
  if (!live(gdp) || !isNum(gdpA) || !live(pc) || !isNum(pcA)) {
    return {
      ...base,
      answer: 'The national accounts could not be loaded just now, so Lyra will not guess at growth.',
      verdict: 'unknown',
      because: [],
      wouldChange: '',
    };
  }

  const verdict: EconomyVerdict =
    gdpA <= 0 || pcA < 0
      ? 'under-pressure'
      : gdpA >= THRESHOLDS.gdpAnnualSolid && pcA >= THRESHOLDS.perPersonAnnualSolid
        ? 'improving'
        : 'mixed';

  const because = ['gdp', 'gdpPerCapita'];
  let answer = `Total output ${moved(gdpA)} over the year to the ${periodLabel(gdp.period)}`;
  const gap = gdpA - pcA;
  if (pcA < 0) {
    answer += `, but output per person fell ${fmt(pcA)}% - the economy is bigger and the average share is smaller.`;
  } else if (gap >= 0.5) {
    answer += `, but output per person ${tenths(pcA) === 0 ? 'was flat' : `grew only ${fmt(pcA)}%`}.`;
    if (live(pop)) {
      answer += ` Most of the gap is population: ${fmt(pop.value)}% more people than a year earlier (${periodLabel(pop.period)}).`;
      because.push('population');
    }
  } else {
    answer += `, and output per person ${moved(pcA)} - growth is keeping pace with population.`;
  }

  // The latest quarter's drivers. The largest contributor first - naming every one that ties
  // with it, so "the biggest lift" is never handed to one of two equal sources.
  const liveDrivers = drivers.filter(live);
  if (liveDrivers.length > 0) {
    const best = Math.max(...liveDrivers.map((d) => tenths(d.value)));
    if (best > 0) {
      const leaders = liveDrivers.filter((d) => tenths(d.value) === best);
      const names = leaders.map((d) => d.label.replace(/^From /, '')).join(' and ');
      answer += ` In the ${periodLabel(gdp.period)} itself, output ${moved(gdp.value)} and the biggest lift came from ${names} (${fmt(best / 10)} points${leaders.length > 1 ? ' each' : ''}).`;
    }
  }

  // Public against private demand - the comparison people actually ask about. Totals only,
  // built from all four components, stated as contribution, never as cause.
  if (live(household) && live(privInv) && live(govServices) && live(pubInv)) {
    const priv = tenths(household.value) + tenths(privInv.value);
    const pub = tenths(govServices.value) + tenths(pubInv.value);
    // "added 0.2 points" / "added nothing" / "took 0.1 points off" - never "added +0.2".
    const contributed = (t: number) =>
      t > 0 ? `added ${fmt(t / 10)} points` : t < 0 ? `took ${fmt(t / 10)} points off` : 'added nothing';
    answer += ` Private demand ${contributed(priv)} and public demand ${contributed(pub)}`;
    answer +=
      priv - pub >= 1
        ? ' - households and businesses did more of the lifting than government.'
        : pub - priv >= 1
          ? ' - government did more of the lifting than households and businesses.'
          : ' - about even.';
    because.push('contribHousehold', 'contribPrivateInvestment', 'contribGovernment', 'contribPublicInvestment');
  }

  const wouldChange =
    verdict === 'improving'
      ? `This would weaken if output per person fell below ${THRESHOLDS.perPersonAnnualSolid}% a year while total output kept growing.`
      : `This would read as healthy if total output grew ${THRESHOLDS.gdpAnnualSolid}% or more over a year and output per person ${THRESHOLDS.perPersonAnnualSolid}% or more.`;

  return { ...base, answer, verdict, because, wouldChange };
}

// --- 2. Living standards ------------------------------------------------------------------

function readLiving(all: EconomyIndicator[]): EconomyQuestion {
  const income = pick(all, 'incomePerCapita');
  const realWages = pick(all, 'realWages');
  const productivity = pick(all, 'productivity');
  const hours = pick(all, 'hoursWorked');
  const gdp = pick(all, 'gdp');
  const wages = pick(all, 'wages');
  const saving = pick(all, 'savingRatio');
  const indicators = present([income, realWages, productivity, hours, wages, saving]);
  const base = {
    id: 'living',
    question: 'Are people actually getting better off?',
    cannotTell:
      'These are averages across the whole country. They cannot show who is ahead and who is behind - a renter, a new buyer and an owner with no mortgage can all live through the same figures very differently.',
    indicators,
  };

  // Score each signal +1 / 0 / -1. Saving is shown but NOT scored: a rising saving ratio can
  // be confidence or caution, and the figures alone cannot say which.
  const signals: { id: string; score: number }[] = [];
  const incomeA = income?.annual ?? Number.NaN;
  if (live(income) && isNum(incomeA)) {
    signals.push({
      id: 'incomePerCapita',
      score: incomeA > THRESHOLDS.incomeRising ? 1 : incomeA < THRESHOLDS.incomeFalling ? -1 : 0,
    });
  }
  if (live(realWages)) {
    const v = realWages.value;
    signals.push({ id: 'realWages', score: v > THRESHOLDS.realWageFlatBand ? 1 : v < -THRESHOLDS.realWageFlatBand ? -1 : 0 });
  }
  const prodA = productivity?.annual ?? Number.NaN;
  if (live(productivity) && isNum(prodA)) {
    signals.push({ id: 'productivity', score: prodA >= THRESHOLDS.productivitySolid ? 1 : prodA < 0 ? -1 : 0 });
  }

  if (signals.length < 2) {
    return {
      ...base,
      answer: 'Too few of the living-standards figures loaded to say whether people are better off. Lyra will not read it from one number.',
      verdict: 'unknown',
      because: signals.map((s) => s.id),
      wouldChange: '',
    };
  }

  const sum = signals.reduce((acc, s) => acc + s.score, 0);
  const verdict: EconomyVerdict = sum >= 2 ? 'improving' : sum <= -1 ? 'under-pressure' : 'mixed';

  // Both figures are dated. When income and real wages cover the same year (the usual case -
  // both come from June-quarter releases) the span is said once; otherwise each carries its
  // own. The real-wage year can differ from the latest monthly CPI under the prices question:
  // two true figures for two different years, so the year is never left implicit.
  const incomeOk = live(income) && isNum(incomeA);
  const wagesOk = live(realWages) && live(wages);
  const sameYear = incomeOk && wagesOk && income!.period === realWages!.period;
  const parts: string[] = [];
  if (incomeOk) {
    const span = sameYear ? '' : ` over the year to the ${periodLabel(income!.period)}`;
    parts.push(
      Math.abs(incomeA) < 0.1
        ? `real income per person barely moved${span} (${incomeA >= 0 ? '+' : '-'}${fmt(incomeA, 2)}%)`
        : `real income per person ${moved(incomeA, 1, 'rose', 'fell')}${span}`,
    );
  }
  if (wagesOk) {
    // realWages = wages - CPI over the SAME year, so the CPI it used is wages - realWages.
    const prices = wages!.value - realWages!.value;
    const span = sameYear ? '' : `in the year to the ${periodLabel(realWages!.period)}, `;
    const rw = realWages!.value;
    parts.push(
      rw < -THRESHOLDS.realWageFlatBand
        ? `${span}wages rose ${fmt(wages!.value)}% while prices rose ${fmt(prices)}%, so pay bought ${fmt(rw)}% less`
        : rw > THRESHOLDS.realWageFlatBand
          ? `${span}wages rose ${fmt(wages!.value)}% against prices up ${fmt(prices)}%, so pay bought ${fmt(rw)}% more`
          : `${span}wages and prices both rose about ${fmt(wages!.value)}%, so pay bought about the same`,
    );
  }
  let answer = parts.length > 0 ? `${parts.join(', and ')}.` : '';
  if (sameYear) answer = `In the year to the ${periodLabel(income!.period)}, ${answer}`;
  answer = answer.charAt(0).toUpperCase() + answer.slice(1);

  // The productivity sentence - the one the GDP headline hides. Only asserted from the
  // published hours figure, never inferred.
  const hoursA = hours?.annual ?? Number.NaN;
  if (live(productivity) && isNum(prodA)) {
    if (prodA < 0 && live(hours) && isNum(hoursA) && hoursA > 0 && live(gdp) && isNum(gdp.annual)) {
      answer += ` Output per hour worked fell ${fmt(prodA)}% while hours worked rose ${fmt(hoursA)}% - the economy grew because more hours were worked, not because each hour produced more.`;
    } else {
      answer += ` Output per hour worked ${moved(prodA)} over the year${prodA >= THRESHOLDS.productivitySolid ? ' - the kind of gain that lifts living standards over time' : ''}.`;
    }
  }

  const wouldChange =
    verdict === 'improving'
      ? 'This would weaken if prices began outrunning wages again, or output per hour stopped growing.'
      : `This would turn if wages outpaced prices by more than ${THRESHOLDS.realWageFlatBand} points and output per hour grew again - the two things that make a rise in living standards last.`;

  return {
    ...base,
    answer: answer.trim(),
    verdict,
    because: signals.map((s) => s.id),
    wouldChange,
  };
}

// --- 3. Jobs ------------------------------------------------------------------------------

function readJobs(all: EconomyIndicator[]): EconomyQuestion {
  const unemp = pick(all, 'unemployment');
  const under = pick(all, 'underemployment');
  const part = pick(all, 'participation');
  const indicators = present([unemp, under, part]);
  const base = {
    id: 'jobs',
    question: 'Is the jobs market healthy?',
    cannotTell:
      'A low unemployment rate can sit alongside people working fewer hours than they want, or wage growth that lags prices. A tight jobs market is good for workers and can also add to inflation - both can be true at once.',
    indicators,
  };
  if (!live(unemp)) {
    return { ...base, answer: 'The labour force figures could not be loaded just now.', verdict: 'unknown', because: [], wouldChange: '' };
  }

  const recent = unemp.history.map((o) => o.value);
  const last3 = recent.slice(-3);
  const avg3 = last3.reduce((a, b) => a + b, 0) / last3.length;
  const low = Math.min(...recent);
  const rise = avg3 - low;
  const rising = rise >= THRESHOLDS.unemploymentRiseWarning;

  const verdict: EconomyVerdict =
    unemp.value >= THRESHOLDS.unemploymentWeak || rising
      ? 'under-pressure'
      : unemp.value < THRESHOLDS.unemploymentHealthy && unemp.direction !== 'up' && (!live(under) || under.value < THRESHOLDS.underemploymentHigh + 0.5)
        ? 'improving'
        : 'mixed';

  const prevPeriod = unemp.history[unemp.history.length - 2]?.period;
  let answer = `Unemployment is ${fmt(unemp.value)}% in ${periodLabel(unemp.period)}`;
  if (isNum(unemp.previous) && prevPeriod) {
    answer +=
      unemp.direction === 'flat'
        ? `, unchanged from ${periodLabel(prevPeriod).split(' ')[0]}`
        : `, ${unemp.direction === 'up' ? 'up' : 'down'} from ${fmt(unemp.previous)}% in ${periodLabel(prevPeriod).split(' ')[0]}`;
  }
  answer += '.';
  if (rising && isNum(low)) {
    answer += ` Over the last few months it has climbed ${fmt(rise)} points from its low of ${fmt(low)}% - the pattern that tends to come before a weaker patch.`;
  }
  if (live(under)) {
    answer +=
      unemp.value < THRESHOLDS.unemploymentHealthy && under.value >= THRESHOLDS.underemploymentHigh
        ? ` But ${fmt(under.value)}% of the workforce has a job and wants more hours - plenty of jobs, not enough work in them.`
        : ` ${fmt(under.value)}% of the workforce has a job but wants more hours.`;
  }
  if (live(part)) answer += ` ${fmt(part.value)}% of adults are working or looking for work.`;

  const wouldChange =
    verdict === 'under-pressure'
      ? `This would ease if unemployment settled back below ${THRESHOLDS.unemploymentHealthy}% and stopped climbing.`
      : `This would turn to a warning if unemployment reached ${THRESHOLDS.unemploymentWeak}%, or rose ${THRESHOLDS.unemploymentRiseWarning} points from its recent low.`;

  return {
    ...base,
    answer,
    verdict,
    because: ['unemployment', ...(live(under) ? ['underemployment'] : [])],
    wouldChange,
  };
}

// --- 4. Prices and rates ------------------------------------------------------------------

function readPrices(all: EconomyIndicator[]): EconomyQuestion {
  const cpi = pick(all, 'cpi');
  const trimmed = pick(all, 'cpiTrimmed');
  const cash = pick(all, 'cashRate');
  const indicators = present([trimmed, cpi, cash]);
  const base = {
    id: 'prices',
    question: 'Is inflation under control - and what is happening to rates?',
    cannotTell:
      'This shows where inflation and the cash rate are, not what the RBA will do next. That turns on forecasts and data not yet published, and markets price the expected path separately. Lyra does not forecast rate decisions.',
    indicators,
  };
  // The RBA targets underlying inflation; the headline is shown alongside, never instead.
  const core = live(trimmed) ? trimmed : live(cpi) ? cpi : undefined;
  if (!core) {
    return { ...base, answer: 'The inflation figures could not be loaded just now.', verdict: 'unknown', because: [], wouldChange: '' };
  }

  const inBand = core.value >= THRESHOLDS.targetLow && core.value <= THRESHOLDS.targetHigh;
  const verdict: EconomyVerdict =
    core.value > THRESHOLDS.targetHigh
      ? 'under-pressure'
      : inBand && core.direction !== 'up'
        ? 'improving'
        : 'mixed';

  const coreName = core.id === 'cpiTrimmed' ? 'Underlying inflation' : 'Inflation';
  let answer = `${coreName} is ${fmt(core.value)}% over the year to ${periodLabel(core.period)}`;
  answer +=
    core.value > THRESHOLDS.targetHigh
      ? `, above the RBA's ${THRESHOLDS.targetLow}-${THRESHOLDS.targetHigh}% target band`
      : core.value < THRESHOLDS.targetLow
        ? `, below the RBA's ${THRESHOLDS.targetLow}-${THRESHOLDS.targetHigh}% target band`
        : `, inside the RBA's ${THRESHOLDS.targetLow}-${THRESHOLDS.targetHigh}% target band`;
  if (core.direction && core.direction !== 'flat' && isNum(core.previous)) {
    answer += ` and ${core.direction === 'up' ? 'rising' : 'easing'} (${fmt(core.previous)}% the month before)`;
  }
  answer += '.';
  if (core.id === 'cpiTrimmed' && live(cpi)) answer += ` Headline inflation is ${fmt(cpi.value)}%.`;
  if (live(cash)) {
    const dir = cash.direction;
    answer +=
      dir === 'up'
        ? ` The cash rate averaged ${cash.value.toFixed(2)}% in ${periodLabel(cash.period)}, up from ${cash.previous.toFixed(2)}%.`
        : dir === 'down'
          ? ` The cash rate averaged ${cash.value.toFixed(2)}% in ${periodLabel(cash.period)}, down from ${cash.previous.toFixed(2)}%.`
          : ` The cash rate averaged ${cash.value.toFixed(2)}% in ${periodLabel(cash.period)}, unchanged.`;
  }

  const wouldChange =
    verdict === 'under-pressure'
      ? `This would ease once underlying inflation fell back inside ${THRESHOLDS.targetLow}-${THRESHOLDS.targetHigh}% and kept falling.`
      : `This would turn if underlying inflation climbed above ${THRESHOLDS.targetHigh}%.`;

  return {
    ...base,
    answer,
    verdict,
    because: [core.id, ...(live(cash) ? ['cashRate'] : [])],
    wouldChange,
  };
}

// --- The headline -------------------------------------------------------------------------

/**
 * One sentence joining growth and living standards - the reading the founder asked for. Built
 * only from the figures it quotes; if they are missing it says so instead.
 */
function buildHeadline(all: EconomyIndicator[], growth: EconomyQuestion, living: EconomyQuestion): string {
  const gdp = pick(all, 'gdp');
  const pc = pick(all, 'gdpPerCapita');
  const realWages = pick(all, 'realWages');
  const income = pick(all, 'incomePerCapita');
  if (growth.verdict === 'unknown') {
    return 'The national accounts did not load just now, so Lyra is not making a call on the economy - the figures that did load are below.';
  }
  const gdpA = gdp!.annual;
  const pcA = pc!.annual;

  let s = `The economy ${moved(gdpA)} over the year to the ${periodLabel(gdp!.period)}`;
  s += pcA < 0 ? `, but output per person fell ${fmt(pcA)}%` : gdpA - pcA >= 0.5 ? `, but output per person grew only ${fmt(pcA)}%` : ` and output per person ${moved(pcA)}`;

  if (live(realWages) && realWages.value < -THRESHOLDS.realWageFlatBand) {
    s += ` and pay bought ${fmt(realWages.value)}% less after inflation`;
  } else if (live(income) && isNum(income.annual) && income.annual < THRESHOLDS.incomeFalling) {
    s += ` and real income per person fell ${fmt(income.annual)}%`;
  }

  s +=
    living.verdict === 'under-pressure'
      ? ' - it is getting bigger, not better off per person.'
      : living.verdict === 'improving'
        ? ' - and people are sharing in it.'
        : living.verdict === 'mixed'
          ? ' - the gains per person are thin.'
          : '.';
  return s;
}

/** Turn a snapshot's indicators into the full read. Pure. */
export function readEconomy(indicators: EconomyIndicator[]): EconomyRead {
  const growth = readGrowth(indicators);
  const living = readLiving(indicators);
  const jobs = readJobs(indicators);
  const prices = readPrices(indicators);
  const liveOnes = indicators.filter((i) => i.provenance === 'live');

  return {
    country: 'Australia',
    headline: buildHeadline(indicators, growth, living),
    overall: growth.verdict,
    livingStandards: living.verdict,
    asOf: latestPeriod(liveOnes.map((i) => i.period)),
    questions: [growth, living, jobs, prices],
    missing: indicators.filter((i) => i.provenance !== 'live').map((i) => i.label),
    empty: liveOnes.length === 0,
  };
}
