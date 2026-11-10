/** PostgREST varsayılan max_rows (1000) ile uyumlu sayfa boyutu */
export const POSTGREST_QUERY_PAGE_SIZE = 1000;
/** Sonsuz döngü / sessiz kesme yerine sert tavan */
export const POSTGREST_MAX_QUERY_PAGES = 50;

export class PostgrestQueryPageLimitError extends Error {
  constructor(message = "PostgREST query exceeded max page limit before result set ended") {
    super(message);
    this.name = "PostgrestQueryPageLimitError";
  }
}

/**
 * Sınırsız sonuç kümelerini PostgREST satır tavanını aşmadan okur.
 * Hata veya dolu son sayfa + tavan aşımı tamamlanmış sonuç sayılmaz.
 */
export async function fetchAllPostgrestPages<T>(
  loadPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];

  for (let page = 0; page < POSTGREST_MAX_QUERY_PAGES; page += 1) {
    const from = page * POSTGREST_QUERY_PAGE_SIZE;
    const to = from + POSTGREST_QUERY_PAGE_SIZE - 1;
    const { data, error } = await loadPage(from, to);
    if (error) throw error;

    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < POSTGREST_QUERY_PAGE_SIZE) return out;
  }

  throw new PostgrestQueryPageLimitError();
}
