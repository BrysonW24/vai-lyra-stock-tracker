// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { StackSection } from '../StackSection';

/**
 * 2026-07-27 audit V16: no test rendered any landing section, so the solo/community conditional copy
 * and the stack-tile solo filtering were unpinned - a regression that stopped dropping the account-only
 * tiles in Solo (leaking "Supabase / Telegram / Slack" into a no-account build) would ship green.
 */
afterEach(cleanup);

const ACCOUNT_ONLY = ['Supabase', 'GitHub Actions', 'Telegram Bot', 'Slack', 'Web Push (VAPID)'];

describe('StackSection solo filter (audit V16)', () => {
  it('shows the full stack including the account-only tiles in Community mode', () => {
    render(<StackSection soloMode={false} />);
    expect(screen.getByText('The stack')).toBeTruthy();
    for (const name of ACCOUNT_ONLY) {
      expect(screen.queryAllByText(name).length).toBeGreaterThan(0);
    }
  });

  it('drops the 5 account-only tiles and relabels the heading in Solo mode', () => {
    render(<StackSection soloMode />);
    expect(screen.getByText('The Solo stack')).toBeTruthy();
    for (const name of ACCOUNT_ONLY) {
      expect(screen.queryByText(name)).toBeNull();
    }
  });
});
