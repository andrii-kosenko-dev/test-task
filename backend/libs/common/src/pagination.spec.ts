import { MAX_PAGE_SIZE, normalizePage } from './pagination';

describe('normalizePage', () => {
  it('defaults', () => expect(normalizePage(undefined, undefined)).toEqual({ page: 0, pageSize: 24 }));
  it('clamps negatives and caps the size', () => {
    expect(normalizePage(-3, 0)).toEqual({ page: 0, pageSize: 24 });
    expect(normalizePage(2, 100000).pageSize).toBe(MAX_PAGE_SIZE);
  });
  it('floors fractions', () => expect(normalizePage(1.9, 10.7)).toEqual({ page: 1, pageSize: 10 }));
  it('ignores NaN', () => expect(normalizePage(NaN, NaN)).toEqual({ page: 0, pageSize: 24 }));
});
