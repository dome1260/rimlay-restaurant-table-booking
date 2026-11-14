import { describe, expect, it } from "vitest";
import { pageNumbers, paginate } from "./pagination";

const items = Array.from({ length: 23 }, (_, i) => i + 1);

describe("paginate", () => {
  it("shows 10 items per page", () => {
    const p1 = paginate(items, "1");
    expect(p1.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(p1).toMatchObject({ page: 1, totalPages: 3, total: 23, from: 1, to: 10 });
    expect(paginate(items, "3")).toMatchObject({ items: [21, 22, 23], from: 21, to: 23 });
  });

  it("falls back to a valid page for bad input", () => {
    expect(paginate(items, undefined).page).toBe(1);
    expect(paginate(items, "abc").page).toBe(1);
    expect(paginate(items, "0").page).toBe(1);
    expect(paginate(items, "-4").page).toBe(1);
    expect(paginate(items, "99").page).toBe(3);
    expect(paginate(items, "2.7").page).toBe(2);
  });

  it("handles an empty list as one empty page", () => {
    expect(paginate([], "2")).toEqual({ items: [], page: 1, totalPages: 1, total: 0, from: 0, to: 0 });
  });

  it("keeps exactly 10 items on one page", () => {
    expect(paginate(items.slice(0, 10), "2")).toMatchObject({ page: 1, totalPages: 1 });
  });
});

describe("pageNumbers", () => {
  it("lists every page up to 7", () => {
    expect(pageNumbers(1, 3)).toEqual([1, 2, 3]);
    expect(pageNumbers(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("collapses long ranges around the current page", () => {
    expect(pageNumbers(1, 10)).toEqual([1, 2, null, 10]);
    expect(pageNumbers(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageNumbers(10, 10)).toEqual([1, null, 9, 10]);
  });
});
