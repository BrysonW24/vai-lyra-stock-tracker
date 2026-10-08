import { describe, expect, it } from 'vitest';
import { parseMessage } from '@/lib/notifications/telegram-commands';

describe('telegram webhook parsing', () => {
  it('reads the deep-link start parameter as bounded data', () => {
    expect(parseMessage('/start sAbC123_-xyz')).toEqual({ kind: 'start', args: 'sAbC123_-xyz' });
    expect(parseMessage('/start')).toEqual({ kind: 'start', args: '' });
    expect(parseMessage(`/start ${'p'.repeat(200)}`)).toMatchObject({ kind: 'start', args: 'p'.repeat(64) });
  });

  it('treats STOP in every spelling as the stop command', () => {
    for (const text of ['STOP', 'stop', ' Stop ', 'UNSUBSCRIBE', '/stop', '/unsubscribe', '/stop@viva_lyra_trading_bot']) {
      expect(parseMessage(text)).toEqual({ kind: 'command', command: 'stop', args: '' });
    }
    expect(parseMessage('please stop')).toEqual({ kind: 'command', command: 'unknown', args: '' });
  });

  it('keeps the closed command enum', () => {
    expect(parseMessage('/Help@viva_lyra_trading_bot')).toEqual({ kind: 'command', command: 'help', args: '' });
    expect(parseMessage('/buy NVDA')).toEqual({ kind: 'command', command: 'unknown', args: 'NVDA' });
  });
});
