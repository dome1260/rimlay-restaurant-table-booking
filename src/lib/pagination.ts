export const PAGE_SIZE = 10;

export type Paged<T> = {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
  // 1-based positions of the first / last item shown (0 when empty).
  from: number;
  to: number;
};

// `rawPage` comes from the URL, so anything that isn't a whole number in range falls back to the
// nearest valid page instead of showing an empty list.
export function paginate<T>(items: T[], rawPage: string | number | undefined, size = PAGE_SIZE): Paged<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const asked = Math.trunc(Number(rawPage));
  const page = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), totalPages) : 1;
  const start = (page - 1) * size;
  const slice = items.slice(start, start + size);
  return { items: slice, page, totalPages, total, from: slice.length ? start + 1 : 0, to: start + slice.length };
}

// Page numbers to show: always first, last and the neighbours of the current page; gaps are null.
export function pageNumbers(page: number, totalPages: number): (number | null)[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const keep = new Set([1, totalPages, page - 1, page, page + 1]);
  const out: (number | null)[] = [];
  for (let p = 1; p <= totalPages; p += 1) {
    if (keep.has(p)) out.push(p);
    else if (out.at(-1) !== null) out.push(null);
  }
  return out;
}
