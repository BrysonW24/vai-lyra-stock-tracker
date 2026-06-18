import { describe, expect, it } from 'vitest';
import { encodeStack, parseStack } from '@/lib/findings/stack';
import type { DrawerStackItem } from '@/lib/findings/types';

/**
 * The drawer stack is the shareable URL state for an investigation. Entity ids contain ':'
 * (node:earth-observation), so the encode/parse must split on the first colon only and round-trip
 * exactly - otherwise a reloaded/shared investigation drills into the wrong drawer.
 */
describe('investigation drawer stack URL state', () => {
  it('round-trips a deep stack including colon-bearing entity ids', () => {
    const stack: DrawerStackItem[] = [
      { type: 'finding', id: 'BKSY-20260617' },
      { type: 'evidence', id: 'ev-bksy-contract' },
      { type: 'supply_chain_node', id: 'node:earth-observation' },
      { type: 'theme', id: 'theme:space-intelligence' },
    ];
    expect(parseStack(encodeStack(stack))).toEqual(stack);
  });

  it('returns an empty stack for empty / null / undefined', () => {
    expect(parseStack('')).toEqual([]);
    expect(parseStack(null)).toEqual([]);
    expect(parseStack(undefined)).toEqual([]);
  });

  it('drops malformed tokens (no colon, empty id) without throwing', () => {
    expect(parseStack('garbage~finding:OK~company:')).toEqual([{ type: 'finding', id: 'OK' }]);
  });
});
