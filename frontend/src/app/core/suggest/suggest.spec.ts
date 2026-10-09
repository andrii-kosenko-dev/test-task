import type { SearchQuery } from '../../store/queries/queries.reducer';
import { buildTermIndex, suggest } from './suggest';

const q = (text: string, hits = 1, lastUsedAt = 0): SearchQuery => ({
  id: text,
  text,
  hits,
  resultCount: 1,
  lastUsedAt,
});

describe('buildTermIndex', () => {
  it('collects unique normalized words with their frequency', () => {
    const index = buildTermIndex(['Red Nail Polish', 'Red Lipstick', 'Nail File']);
    expect(index).toContainEqual({ term: 'red', count: 2 });
    expect(index).toContainEqual({ term: 'nail', count: 2 });
    expect(index).toContainEqual({ term: 'lipstick', count: 1 });
  });

  it('counts a word once per title', () => {
    expect(buildTermIndex(['Tea Tea Tea'])).toEqual([{ term: 'tea', count: 1 }]);
  });

  it('drops one-character noise', () => {
    expect(buildTermIndex(['A Pen & B'])).toEqual([{ term: 'pen', count: 1 }]);
  });

  it('orders by frequency, then alphabetically', () => {
    const terms = buildTermIndex(['bb aa', 'bb cc']).map((t) => t.term);
    expect(terms).toEqual(['bb', 'aa', 'cc']);
  });
});

describe('suggest', () => {
  const terms = buildTermIndex([
    'Essence Mascara Lash Princess',
    'Red Nail Polish',
    'Red Lipstick',
    'Nail File',
    'Laptop Stand',
  ]);

  it('returns nothing for blank input', () => {
    expect(suggest({ input: '  ', history: [q('phone')], terms })).toEqual([]);
  });

  it('completes the word being typed from product-title terms', () => {
    expect(suggest({ input: 'mas', history: [], terms })).toEqual([
      { text: 'mascara', source: 'term' },
    ]);
  });

  it('keeps the already-typed words when completing the last one', () => {
    const out = suggest({ input: 'red na', history: [], terms });
    expect(out).toEqual([{ text: 'red nail', source: 'term' }]);
  });

  it('does not suggest exactly what was typed', () => {
    expect(suggest({ input: 'nail', history: [], terms })).toEqual([]);
  });

  it('ranks more frequent terms first', () => {
    const t = buildTermIndex(['lime', 'lamp', 'lamp shade']);
    expect(suggest({ input: 'l', history: [], terms: t }).map((s) => s.text)).toEqual([
      'lamp',
      'lime',
    ]);
  });

  it('suggests past queries by prefix', () => {
    const out = suggest({ input: 'iph', history: [q('iphone case'), q('laptop')], terms: [] });
    expect(out).toEqual([{ text: 'iphone case', source: 'history' }]);
  });

  it('suggests past queries via word breakdown (any word, any order)', () => {
    const out = suggest({ input: 'case', history: [q('iphone case')], terms: [] });
    expect(out).toEqual([{ text: 'iphone case', source: 'history' }]);
    const multi = suggest({ input: 'case iph', history: [q('iphone case')], terms: [] });
    expect(multi).toEqual([{ text: 'iphone case', source: 'history' }]);
  });

  it('requires every typed word to match a distinct word of the past query', () => {
    expect(suggest({ input: 'case case', history: [q('iphone case')], terms: [] })).toEqual([]);
    expect(suggest({ input: 'case tablet', history: [q('iphone case')], terms: [] })).toEqual([]);
  });

  it('puts prefix matches before word matches, then orders by hits and recency', () => {
    const history = [
      q('red phone', 9),
      q('phone case', 1, 1),
      q('phone stand', 1, 5),
      q('phone', 1, 0),
    ];
    const out = suggest({ input: 'phon', history, terms: [] }).map((s) => s.text);
    expect(out).toEqual(['phone stand', 'phone case', 'phone', 'red phone']);
  });

  it('lists history before title terms and de-duplicates', () => {
    const out = suggest({ input: 'nai', history: [q('nail polish')], terms });
    expect(out).toEqual([
      { text: 'nail polish', source: 'history' },
      { text: 'nail', source: 'term' },
    ]);
  });

  it('respects the limit', () => {
    const many = Array.from({ length: 20 }, (_, i) => q(`phone ${i}`));
    expect(suggest({ input: 'ph', history: many, terms: [], limit: 5 })).toHaveLength(5);
  });

  it('is case- and diacritics-insensitive', () => {
    expect(suggest({ input: 'MAS', history: [], terms })).toEqual([
      { text: 'mascara', source: 'term' },
    ]);
  });
});
