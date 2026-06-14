import { describe, it, expect } from 'vitest';
import { searchUniverse } from '@/lib/universe';

describe('searchUniverse ranking', () => {
  it('puts an exact symbol match first', () => {
    expect(searchUniverse('NVDA')[0].symbol).toBe('NVDA');
  });

  it('ranks symbol-prefix matches above name matches, shorter symbols first', () => {
    const out = searchUniverse('S').map((t) => t.symbol);
    // The top hit is a symbol-prefix match (not a name-only match like CRM/Salesforce).
    expect(out[0].startsWith('S')).toBe(true);
    // Shorter symbols (SQ) outrank longer ones (SHOP); both still appear.
    expect(out.indexOf('SQ')).toBeGreaterThanOrEqual(0);
    expect(out.indexOf('SQ')).toBeLessThan(out.indexOf('SHOP'));
  });

  it('matches by company name', () => {
    expect(searchUniverse('sales').map((t) => t.symbol)).toContain('CRM'); // Salesforce
    expect(searchUniverse('snow').map((t) => t.symbol)).toContain('SNOW');
  });

  it('matches a name word-start (micro -> Micron, Super Micro, Microsoft)', () => {
    const syms = searchUniverse('micro').map((t) => t.symbol);
    expect(syms).toEqual(expect.arrayContaining(['MU', 'SMCI', 'MSFT']));
  });

  it('strips a leading $ and an exchange suffix', () => {
    expect(searchUniverse('$NVDA')[0].symbol).toBe('NVDA');
    expect(searchUniverse('NVDA.AX')[0].symbol).toBe('NVDA');
  });

  it('returns nothing for an empty query and respects the limit', () => {
    expect(searchUniverse('')).toEqual([]);
    expect(searchUniverse('A', 3).length).toBeLessThanOrEqual(3);
  });
});
