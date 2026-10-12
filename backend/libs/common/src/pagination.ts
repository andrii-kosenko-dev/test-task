export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
}

export interface PageRequest {
  readonly page: number;
  readonly pageSize: number;
}

export const MAX_PAGE_SIZE = 100;

/** Clamp untrusted paging input to safe bounds; page is zero-based. */
export function normalizePage(page: number | undefined, pageSize: number | undefined, defaultSize = 24): PageRequest {
  const p = Number.isFinite(page) && (page as number) > 0 ? Math.floor(page as number) : 0;
  const s = Number.isFinite(pageSize) && (pageSize as number) > 0 ? Math.floor(pageSize as number) : defaultSize;
  return { page: p, pageSize: Math.min(s, MAX_PAGE_SIZE) };
}
