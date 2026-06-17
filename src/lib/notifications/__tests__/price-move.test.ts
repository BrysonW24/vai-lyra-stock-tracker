import { describe, expect, it } from 'vitest';
import {
  buildMovementDedupeKey,
  buildMovementThresholds,
  crossedMovementThresholds,
  pctMoveFromReference,
} from '../price-move';

describe('price movement thresholds', () => {
  it('builds symmetric 5% thresholds by default', () => {
    expect(buildMovementThresholds({ maxAbsPct: 15 })).toEqual([-15, -10, -5, 5, 10, 15]);
  });

  it('calculates movement from a reference price', () => {
    expect(pctMoveFromReference(115, 100)).toBe(15);
    expect(pctMoveFromReference(90, 100)).toBe(-10);
    expect(pctMoveFromReference(90, 0)).toBeNull();
  });

  it('returns newly crossed positive thresholds', () => {
    expect(crossedMovementThresholds(4.9, 15.2, { maxAbsPct: 20 })).toEqual([5, 10, 15]);
  });

  it('returns newly crossed negative thresholds in travel direction', () => {
    expect(crossedMovementThresholds(-4.9, -15.2, { maxAbsPct: 20 })).toEqual([-5, -10, -15]);
  });

  it('treats missing previous state as first eligible crossing', () => {
    expect(crossedMovementThresholds(null, 10.5, { maxAbsPct: 15 })).toEqual([5, 10]);
    expect(crossedMovementThresholds(undefined, -10.5, { maxAbsPct: 15 })).toEqual([-10, -5]);
  });

  it('builds a stable dedupe key per symbol and threshold', () => {
    expect(buildMovementDedupeKey('watchlist', 'nvda', -10)).toBe('watchlist_price_move:NVDA:down:10');
  });
});
