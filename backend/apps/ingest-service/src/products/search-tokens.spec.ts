import { buildTokens, normalize, prefixes, queryTokens } from './search-tokens';

describe('search-tokens', () => {
  it('normalizes case, accents and punctuation', () => {
    expect(normalize('  Crème-Brûlée, 50ML! ')).toBe('creme brulee 50ml');
  });

  it('expands words into prefixes of at least two letters plus the whole word', () => {
    expect(prefixes('cat')).toEqual(['ca', 'cat']);
    expect(prefixes('a')).toEqual(['a']);
  });

  it('builds de-duplicated token sets per field group', () => {
    const t = buildTokens({
      title: 'Red Lipstick',
      brand: 'Nars',
      category: 'beauty',
      description: 'A red shade',
    });
    expect(t.titleTokens).toEqual(expect.arrayContaining(['re', 'red', 'li', 'lipstick']));
    expect(t.metaTokens).toEqual(expect.arrayContaining(['na', 'nars', 'be', 'beauty']));
    expect(t.searchTokens).toEqual(expect.arrayContaining(['sh', 'shade', 'red', 'nars']));
    expect(new Set(t.searchTokens).size).toBe(t.searchTokens.length);
  });

  it('tolerates a missing brand', () => {
    expect(buildTokens({ title: 'x', category: 'c', description: '' }).metaTokens).toEqual(['c']);
  });

  it('turns a query into unique normalized tokens, capped in count and length', () => {
    expect(queryTokens('  Red  red LIPS ')).toEqual(['red', 'lips']);
    expect(queryTokens('')).toEqual([]);
    expect(queryTokens('a b c d e f g h i j k l')).toHaveLength(8);
    expect(queryTokens('x'.repeat(100))[0]).toHaveLength(32);
  });
});
