/**
 * Mutes are ENFORCED on the server dispatch path. The router always had mute rules
 * (prefs.mutedSymbols / mutedThemes, rule 2) but loadPreferences never populated them - no
 * column existed - so every mute a user set (the AccountMenu "Muted" badge, timed snoozes)
 * was localStorage-only theatre: all channels kept sending. These pin migration 051's columns
 * flowing through loadPreferences into routeNotification. Each suppression test goes RED on
 * the old loader (the event delivered and fetch fired).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchNotificationEvent } from '../dispatch';
import { baseTables, fakeSupabase, type Row } from './fake-supabase';

function fetchMock() {
  return vi.fn(async () => new Response('ok', { status: 200 }));
}

function nvdaAlert(): Parameters<typeof dispatchNotificationEvent>[1] {
  return {
    userId: 'u1',
    type: 'signal_alert',
    title: 'NVDA signal',
    body: 'NVDA entered the reset band.',
    symbol: 'NVDA',
    relevanceScore: 90,
  };
}

describe('dispatch enforces user mutes (server-side, all channels)', () => {
  let fetchSpy: ReturnType<typeof fetchMock>;
  beforeEach(() => {
    fetchSpy = fetchMock();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function prefsRow(overrides: Row): Row {
    return { user_id: 'u1', quiet_hours_enabled: false, slack_enabled: true, min_signal_score: 40, ...overrides };
  }

  it('a muted symbol suppresses the alert - nothing reaches any channel', async () => {
    const tables = baseTables();
    tables.user_alert_preferences = [prefsRow({ muted_symbols: ['NVDA'] })];

    const result = await dispatchNotificationEvent(fakeSupabase(tables), nvdaAlert());

    expect(result.ok).toBe(true);
    expect(result.routeReason).toBe('muted symbol');
    expect(result.deliveredChannels).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled(); // the Slack webhook was never touched
  });

  it('the global "Muted" mode (mute_all) suppresses a normal alert', async () => {
    const tables = baseTables();
    tables.user_alert_preferences = [prefsRow({ mute_all: true })];

    const result = await dispatchNotificationEvent(fakeSupabase(tables), nvdaAlert());

    expect(result.routeReason).toBe('muted all');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a timed snooze (muted_until in the future) suppresses; an expired one delivers', async () => {
    const now = new Date('2026-07-18T03:00:00Z');

    const snoozed = baseTables();
    snoozed.user_alert_preferences = [prefsRow({ muted_until: '2026-07-18T04:00:00Z' })];
    const held = await dispatchNotificationEvent(fakeSupabase(snoozed), { ...nvdaAlert(), now });
    expect(held.routeReason).toBe('muted all');
    expect(fetchSpy).not.toHaveBeenCalled();

    const expired = baseTables();
    expired.user_alert_preferences = [prefsRow({ muted_until: '2026-07-18T02:00:00Z' })];
    const sent = await dispatchNotificationEvent(fakeSupabase(expired), { ...nvdaAlert(), now });
    expect(sent.deliveredChannels).toContain('slack');
    expect(fetchSpy).toHaveBeenCalledTimes(1); // expired snooze = normal delivery
  });

  it('a global mute NEVER silences a safety-critical approval request', async () => {
    const tables = baseTables();
    tables.user_alert_preferences = [prefsRow({ mute_all: true })];

    const result = await dispatchNotificationEvent(fakeSupabase(tables), {
      userId: 'u1',
      type: 'paper_approval_required',
      title: 'NVDA paper approval required',
      body: 'BUY 10 NVDA is waiting for approval.',
      symbol: 'NVDA',
      relevanceScore: 100,
    });

    expect(result.deliveredChannels).toContain('slack');
    expect(fetchSpy).toHaveBeenCalledTimes(1); // approvals keep the only-no-channels-stop-them contract
  });
});
