import { describe, expect, it } from 'vitest';
import { VOICE_PRESETS, familyForType, fillVoiceTemplate, renderVoiceFraming } from '../voice';
import { buildSlackTextForEvent } from '../slack-templates';
import { VOICE_IDS, type NotificationEvent } from '../types';

function event(overrides: Partial<NotificationEvent> = {}): NotificationEvent {
  return {
    id: 'evt-1',
    type: 'signal_alert',
    userId: 'user-1',
    triggerReason: 'score crossed 80 with volume 2.4x average',
    title: 'NVDA oversold-recovery signal',
    body: 'NVDA entered the reset band on rising volume.',
    evidenceRefs: ['signal:NVDA'],
    relatedEntityType: 'symbol',
    relatedEntityId: 'NVDA',
    relevanceScore: 85,
    dedupeKey: 'signal_alert:nvda:2026-07-16',
    idempotencyKey: 'evt-1:slack',
    createdAt: '2026-07-16T14:00:00.000Z',
    ...overrides,
  };
}

describe('voice presets', () => {
  it('every VoiceId has a preset and every preset covers every family', () => {
    const presetIds = VOICE_PRESETS.map((preset) => preset.id);
    expect(presetIds).toEqual([...VOICE_IDS]);
    for (const preset of VOICE_PRESETS) {
      for (const family of ['research', 'portfolio', 'watchlist', 'paper', 'orders', 'digest', 'test'] as const) {
        expect(preset.framing[family]).not.toBeUndefined();
      }
    }
  });

  it('maps every notification type to a family', () => {
    expect(familyForType('signal_alert')).toBe('research');
    expect(familyForType('portfolio_risk')).toBe('portfolio');
    expect(familyForType('paper_fill')).toBe('paper');
    expect(familyForType('kill_switch_enabled')).toBe('orders');
  });
});

describe('fillVoiceTemplate - variables', () => {
  it('fills {name} and {symbol}', () => {
    expect(fillVoiceTemplate('{name}, worth a look - {symbol} just crossed.', { name: 'Bryson', symbol: 'nvda' })).toBe(
      'Bryson, worth a look - NVDA just crossed.',
    );
  });

  it('degrades gracefully without a name - leading greeting is dropped and capitalised', () => {
    expect(fillVoiceTemplate('{name}, worth a look - {symbol} just crossed.', { symbol: 'NVDA' })).toBe(
      'Worth a look - NVDA just crossed.',
    );
  });

  it('degrades gracefully without a symbol', () => {
    const out = fillVoiceTemplate('The tape shifted - {symbol} is trying to turn.', {});
    expect(out).not.toContain('{symbol}');
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('renderVoiceFraming + slack integration', () => {
  it('analyst keeps the per-type house framing (returns null)', () => {
    expect(renderVoiceFraming(event(), 'analyst')).toBeNull();
    expect(buildSlackTextForEvent(event(), { voice: 'analyst' })).toContain('_A setup crossed your alert threshold._');
  });

  it('minimal omits the framing line entirely', () => {
    expect(renderVoiceFraming(event(), 'minimal')).toBe('');
    const text = buildSlackTextForEvent(event(), { voice: 'minimal' });
    expect(text).not.toContain('A setup crossed your alert threshold');
    expect(text).toContain('> *Why:* score crossed 80 with volume 2.4x average');
  });

  it('coach greets the user by first name', () => {
    const text = buildSlackTextForEvent(event(), { voice: 'coach', name: 'Bryson' });
    expect(text).toContain('_Bryson, worth a look - NVDA just crossed your threshold._');
  });

  it('narrator tells the story, and the engine-owned grains are identical across voices', () => {
    const narrator = buildSlackTextForEvent(event(), { voice: 'narrator' });
    expect(narrator).toContain('_The tape shifted - NVDA is trying to turn._');
    for (const voice of VOICE_IDS) {
      const text = buildSlackTextForEvent(event(), { voice });
      expect(text).toContain('*NVDA oversold-recovery signal*');
      expect(text).toContain('> *Relevance:* 85/100');
      expect(text).toContain(':dart: *Signal*');
    }
  });
});
