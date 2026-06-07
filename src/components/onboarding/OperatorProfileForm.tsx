'use client';

import type { OperatorProfile } from '@/lib/onboarding';
import { LyraIdle } from '@/components/onboarding/LyraIdle';
import { gradientSelectedStyle } from '@/lib/gradient';

interface OperatorProfileFormProps {
  profile: OperatorProfile;
  onChange: (profile: OperatorProfile) => void;
  onNext: () => void;
}

type QKey =
  | 'tradedBefore'
  | 'experienceLevel'
  | 'investingStyle'
  | 'primaryGoal'
  | 'preferredTimeframe'
  | 'riskComfort'
  | 'beginnerMotivation'
  | 'beginnerKnowledge'
  | 'beginnerInvolvement'
  | 'beginnerLearningStyle'
  | 'beginnerHorizon';

interface Question {
  key: QKey;
  prompt: string;
  options: { value: string; label: string }[];
}

// The single gate question shown first. Everything else branches off its answer.
const GATE_QUESTION: Question = {
  key: 'tradedBefore',
  prompt: 'Have you traded stocks before?',
  options: [
    { value: 'yes', label: 'Yes, I have traded before' },
    { value: 'no', label: "No, I'm new to this" },
  ],
};

// Shown when the user HAS traded - the original operator questions.
const EXPERIENCED_QUESTIONS: Question[] = [
  {
    key: 'experienceLevel',
    prompt: 'How experienced are you?',
    options: [
      { value: 'beginner', label: 'Beginner' },
      { value: 'intermediate', label: 'Intermediate' },
      { value: 'advanced', label: 'Advanced' },
      { value: 'professional', label: 'Professional / active trader' },
    ],
  },
  {
    key: 'investingStyle',
    prompt: 'What is your style?',
    options: [
      { value: 'long_term', label: 'Long-term investor' },
      { value: 'swing_trader', label: 'Swing trader' },
      { value: 'momentum_trader', label: 'Momentum trader' },
      { value: 'mixed', label: 'Mixed' },
      { value: 'learning', label: 'Still learning' },
    ],
  },
  {
    key: 'primaryGoal',
    prompt: 'What matters most right now?',
    options: [
      { value: 'grow_portfolio', label: 'Grow my portfolio' },
      { value: 'find_better_entries', label: 'Find better entries' },
      { value: 'manage_risk', label: 'Manage risk' },
      { value: 'learn_technical', label: 'Learn technical analysis' },
      { value: 'track_ai_tech', label: 'Track AI & tech' },
      { value: 'build_discipline', label: 'Build discipline' },
    ],
  },
  {
    key: 'preferredTimeframe',
    prompt: 'Your preferred timeframe?',
    options: [
      { value: 'intraday', label: 'Intraday' },
      { value: 'daily', label: 'Daily' },
      { value: 'weekly', label: 'Weekly' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'long_term', label: 'Long-term' },
    ],
  },
  {
    key: 'riskComfort',
    prompt: 'How much risk are you comfortable reviewing?',
    options: [
      { value: 'conservative', label: 'Conservative' },
      { value: 'balanced', label: 'Balanced' },
      { value: 'aggressive', label: 'Aggressive' },
      { value: 'experimental', label: 'Experimental' },
    ],
  },
];

// Shown when the user is NEW - plain-English questions that gather genuine insight
// about who they are and how to help them, with zero trading jargon.
const BEGINNER_QUESTIONS: Question[] = [
  {
    key: 'beginnerMotivation',
    prompt: "What's drawing you to investing?",
    options: [
      { value: 'grow_savings', label: 'Grow my savings over time' },
      { value: 'extra_income', label: 'Build extra income' },
      { value: 'learn_investing', label: 'Learn how investing works' },
      { value: 'long_term_wealth', label: 'Build long-term wealth' },
    ],
  },
  {
    key: 'beginnerKnowledge',
    prompt: 'How much do you know about the stock market?',
    options: [
      { value: 'scratch', label: 'Starting from scratch' },
      { value: 'some_basics', label: 'I know the basics' },
      { value: 'read_charts', label: "I've looked at charts before" },
    ],
  },
  {
    key: 'beginnerInvolvement',
    prompt: 'How hands-on do you want to be?',
    options: [
      { value: 'guide_me', label: 'Guide me - keep it simple' },
      { value: 'now_and_then', label: 'Check in now and then' },
      { value: 'weekly', label: 'Review it weekly' },
      { value: 'daily', label: 'Daily - I want to learn fast' },
    ],
  },
  {
    key: 'beginnerLearningStyle',
    prompt: 'How do you like to learn?',
    options: [
      { value: 'plain_english', label: 'Explain things in plain English' },
      { value: 'real_examples', label: 'Show me real examples' },
      { value: 'step_by_step', label: 'Step-by-step guidance' },
      { value: 'just_signal', label: 'Just tell me the signal' },
    ],
  },
  {
    key: 'beginnerHorizon',
    prompt: 'When do you hope to see results?',
    options: [
      { value: 'few_months', label: 'In the next few months' },
      { value: 'year_or_two', label: 'A year or two' },
      { value: 'many_years', label: "Many years - I'm patient" },
      { value: 'unsure', label: 'Not sure yet' },
    ],
  },
];

export function OperatorProfileForm({ profile, onChange, onNext }: OperatorProfileFormProps) {
  // Only reveal the branch once the gate question is answered.
  const branchQuestions =
    profile.tradedBefore === 'yes' ? EXPERIENCED_QUESTIONS : profile.tradedBefore === 'no' ? BEGINNER_QUESTIONS : [];
  const activeQuestions: Question[] = [GATE_QUESTION, ...branchQuestions];

  // Recompute the per-question option offsets each render so the gradient sweep
  // stays continuous across the whole step even when the revealed branch changes.
  const offsets: number[] = [];
  let acc = 0;
  for (const q of activeQuestions) {
    offsets.push(acc);
    acc += q.options.length;
  }
  const total = acc;

  const answeredCount = activeQuestions.filter((q) => Boolean(profile[q.key])).length;
  const allAnswered = Boolean(profile.tradedBefore) && answeredCount === activeQuestions.length;

  const beginnerMode = profile.tradedBefore === 'no';
  const subtitle = beginnerMode
    ? 'No jargon - these just tailor Lyra to how you like to learn.'
    : 'Tunes your dashboard density, default timeframe and alerts.';

  const selectOption = (qKey: QKey, value: string) => {
    onChange({ ...profile, [qKey]: value } as OperatorProfile);
  };

  // Flat, no-scroll layout: every question stays on screen as a tight label + a
  // wrap of compact option pills, so the whole step is visible at a glance and
  // nothing collapses, expands, or auto-scrolls out from under the user.
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] leading-snug text-[#a8b5c2]">{subtitle}</p>
        <span className="shrink-0 font-mono text-[10px] text-[#8190a0]">{answeredCount}/{activeQuestions.length}</span>
      </div>

      <div className="space-y-2">
        {activeQuestions.map((q, qi) => {
          const value = profile[q.key] as string | undefined;
          return (
            <div key={q.key}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8190a0]">{q.prompt}</p>
              <div className="flex flex-wrap gap-1.5">
                {q.options.map((o, oi) => {
                  const selected = value === o.value;
                  const t = total > 1 ? (offsets[qi] + oi) / (total - 1) : 0;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => selectOption(q.key, o.value)}
                      aria-pressed={selected}
                      style={selected ? gradientSelectedStyle(t) : undefined}
                      className={`rounded-md border px-2.5 py-1 text-[12px] leading-tight transition ${
                        selected ? '' : 'border-[#263241] bg-[#0d141c] text-[#cdd8e3] hover:border-[#3a4754] hover:text-[#eef3f8]'
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onNext}
        disabled={!allAnswered}
        className={`w-full rounded-md border px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] transition ${
          allAnswered
            ? 'border-[#f3a33a] bg-[#23180b] text-[#f3a33a] hover:bg-[#2a1f0f]'
            : 'cursor-not-allowed border-[#1b2530] bg-[#0d141c] text-[#5d6b79]'
        }`}
      >
        {allAnswered
          ? 'Next: Market universe'
          : !profile.tradedBefore
            ? 'Choose an answer to continue'
            : `Answer ${activeQuestions.length - answeredCount} more to continue`}
      </button>

      {/* Before the gate is answered the step is sparse - let the Lyra mark idle in
          the empty space. It unmounts the moment a branch fills the screen. */}
      {!profile.tradedBefore && (
        <div className="flex justify-center pt-10">
          <LyraIdle caption="pick one to begin" />
        </div>
      )}
    </div>
  );
}
