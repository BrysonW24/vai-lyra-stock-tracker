import { describe, it, expect } from 'vitest';
import { runPaperBotCommand } from '@/lib/trading/paper-bot-commands';

const CREDS = { provider: 'google' as const, apiKey: '' };

/**
 * CLI safety tests - the command surface must not open a path the buttons don't have. These cover the
 * guards that need NO AI/network (the AI propose path is exercised end-to-end via the live endpoint).
 */
describe('paper-bot CLI safety', () => {
  it('refuses anything that sounds like live/real trading', async () => {
    for (const line of ['live', 'go live', 'real money buy NVDA', 'golive']) {
      const r = await runPaperBotCommand(line, CREDS);
      expect(r.ok).toBe(false);
      expect(r.kind).toBe('refused');
      expect(r.lines.join(' ')).toMatch(/paper-only|permanently disabled/i);
    }
  });

  it('execute is blocked unless an order has been proposed and approved', async () => {
    const r = await runPaperBotCommand('execute', CREDS);
    expect(r.ok).toBe(false);
    expect(r.lines.join(' ')).toMatch(/nothing to execute|approve/i);
  });

  it('approve does nothing when there is no pending order', async () => {
    const r = await runPaperBotCommand('approve', CREDS);
    expect(r.ok).toBe(false);
    expect(r.lines.join(' ')).toMatch(/nothing to approve/i);
  });

  it('propose validates its arguments', async () => {
    const r = await runPaperBotCommand('propose', CREDS);
    expect(r.ok).toBe(false);
    expect(r.kind).toBe('usage');
  });

  it('unknown commands are refused, not guessed into an action', async () => {
    const r = await runPaperBotCommand('delete everything', CREDS);
    expect(r.ok).toBe(false);
    expect(r.kind).toBe('unknown');
  });

  it('help lists the command set', async () => {
    const r = await runPaperBotCommand('help', CREDS);
    expect(r.ok).toBe(true);
    expect(r.lines.join('\n')).toMatch(/propose <SYM> <QTY>/);
    // No live/real-money command verb is advertised in the allowlist.
    expect(r.lines.join('\n')).not.toMatch(/live trading|go.?live|real money/i);
  });

  it('status returns account + channel lines without needing AI', async () => {
    const r = await runPaperBotCommand('status', CREDS);
    expect(r.ok).toBe(true);
    expect(r.lines.join(' ')).toMatch(/equity/i);
    expect(r.lines.join(' ')).toMatch(/channels/i);
  });
});
