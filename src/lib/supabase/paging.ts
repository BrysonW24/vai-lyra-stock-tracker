/**
 * Read EVERY row of a query, not the first page of it.
 *
 * PostgREST caps a response at the project's max-rows setting (1000 on Supabase) no matter what
 * `.limit()` asks for, and it does so silently - the response is a normal 200 with fewer rows.
 * Anything that aggregates "all" rows from one request is therefore aggregating at most the first
 * thousand. The public track record did exactly that: it asked for 5000, received 1000 of 1,587,
 * and published the result as the all-time record.
 *
 * `complete` is false when a page failed or the page budget ran out. A caller that is about to
 * present the rows as a whole must check it - a partial aggregate labelled as the full one is the
 * bug this file exists to remove.
 */
export const POSTGREST_PAGE_SIZE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: unknown;
}

export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  { pageSize = POSTGREST_PAGE_SIZE, maxPages = 50 }: { pageSize?: number; maxPages?: number } = {},
): Promise<{ rows: T[]; complete: boolean }> {
  const rows: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error || !data) return { rows, complete: false };
    rows.push(...data);
    if (data.length < pageSize) return { rows, complete: true };
  }
  return { rows, complete: false };
}
