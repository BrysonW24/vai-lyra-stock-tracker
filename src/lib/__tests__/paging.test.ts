import { describe, expect, it } from 'vitest';
import { fetchAllRows } from '@/lib/supabase/paging';

/**
 * PostgREST returns at most 1000 rows a request, silently. The public track record asked for 5000,
 * got 1000 of 1,587, and published that as the all-time record. This is the read that fixes it.
 */
const table = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }));
const pager = (rows: { id: number }[], cap = 1000) => {
  const seen: Array<[number, number]> = [];
  const fetchPage = async (from: number, to: number) => {
    seen.push([from, to]);
    return { data: rows.slice(from, Math.min(to + 1, from + cap)), error: null };
  };
  return { fetchPage, seen };
};

describe('fetchAllRows', () => {
  it('reads past the 1000-row cap until a short page', async () => {
    const { fetchPage, seen } = pager(table(1587));
    const { rows, complete } = await fetchAllRows(fetchPage);
    expect(rows).toHaveLength(1587);
    expect(complete).toBe(true);
    expect(seen).toEqual([[0, 999], [1000, 1999]]);
  });

  it('asks for one more page when the count lands exactly on a page boundary', async () => {
    const { fetchPage, seen } = pager(table(2000));
    const { rows, complete } = await fetchAllRows(fetchPage);
    expect(rows).toHaveLength(2000);
    expect(complete).toBe(true);
    expect(seen).toHaveLength(3);
  });

  it('says so when a later page fails - a partial set is never reported as complete', async () => {
    let call = 0;
    const { rows, complete } = await fetchAllRows(async (from) => {
      call += 1;
      return call === 1 ? { data: table(1000).map((r) => ({ id: r.id + from })), error: null } : { data: null, error: { message: 'boom' } };
    });
    expect(rows).toHaveLength(1000);
    expect(complete).toBe(false);
  });

  it('says so when the page budget runs out before the data does', async () => {
    const { fetchPage } = pager(table(5000));
    const { rows, complete } = await fetchAllRows(fetchPage, { maxPages: 2 });
    expect(rows).toHaveLength(2000);
    expect(complete).toBe(false);
  });

  it('handles an empty table', async () => {
    expect(await fetchAllRows(pager([]).fetchPage)).toEqual({ rows: [], complete: true });
  });
});
