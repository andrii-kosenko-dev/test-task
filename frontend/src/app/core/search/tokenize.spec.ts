import { normalize, tokenize } from './tokenize';

describe('normalize', () => {
  it('lower-cases, trims and collapses whitespace', () => {
    expect(normalize('  iPhone   15  ')).toBe('iphone 15');
  });

  it('strips diacritics', () => {
    expect(normalize('Café Crème')).toBe('cafe creme');
  });

  it('returns an empty string for blank input', () => {
    expect(normalize('   ')).toBe('');
  });
});

describe('tokenize', () => {
  it('splits on whitespace and punctuation', () => {
    expect(tokenize('Red-Nail, Polish!')).toEqual(['red', 'nail', 'polish']);
  });

  it('keeps digits', () => {
    expect(tokenize('iPhone 15 Pro')).toEqual(['iphone', '15', 'pro']);
  });

  it('returns no tokens for blank input', () => {
    expect(tokenize('  ,, ')).toEqual([]);
  });
});
