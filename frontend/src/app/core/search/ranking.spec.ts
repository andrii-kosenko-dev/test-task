import type { Product } from '../models/product.model';
import fixture from '../data/products.fixture.json';
import { rankProducts, scoreProduct } from './ranking';

const make = (over: Partial<Product>): Product => ({
  id: 1,
  title: 'Item',
  description: 'Plain description',
  category: 'misc',
  thumbnail: 'https://x/t.webp',
  images: ['https://x/1.webp'],
  price: 1,
  ...over,
});

describe('scoreProduct', () => {
  it('is 0 when a token matches nowhere', () => {
    expect(scoreProduct(make({ title: 'Apple' }), ['banana'])).toBe(0);
  });

  it('requires every token to match (AND semantics)', () => {
    const p = make({ title: 'Red Apple' });
    expect(scoreProduct(p, ['red', 'apple'])).toBeGreaterThan(0);
    expect(scoreProduct(p, ['red', 'banana'])).toBe(0);
  });

  it('matches partial words', () => {
    expect(scoreProduct(make({ title: 'Mascara' }), ['masc'])).toBeGreaterThan(0);
    expect(scoreProduct(make({ title: 'Mascara' }), ['scar'])).toBeGreaterThan(0);
  });

  it('ranks title above description', () => {
    const inTitle = make({ title: 'Laptop stand', description: 'metal' });
    const inDesc = make({ title: 'Stand', description: 'fits a laptop' });
    expect(scoreProduct(inTitle, ['laptop'])).toBeGreaterThan(scoreProduct(inDesc, ['laptop']));
  });

  it('ranks word-prefix above mid-word substring', () => {
    const prefix = make({ title: 'Scarf' });
    const inner = make({ title: 'Mascara' });
    expect(scoreProduct(prefix, ['sca'])).toBeGreaterThan(scoreProduct(inner, ['sca']));
  });

  it('ranks exact word above prefix', () => {
    const exact = make({ title: 'Pen' });
    const prefix = make({ title: 'Pencil' });
    expect(scoreProduct(exact, ['pen'])).toBeGreaterThan(scoreProduct(prefix, ['pen']));
  });

  it('matches brand and category', () => {
    expect(scoreProduct(make({ brand: 'Essence' }), ['essence'])).toBeGreaterThan(0);
    expect(scoreProduct(make({ category: 'beauty' }), ['beauty'])).toBeGreaterThan(0);
  });

  it('is case- and diacritics-insensitive', () => {
    expect(scoreProduct(make({ title: 'Café' }), ['cafe'])).toBeGreaterThan(0);
  });

  it('rewards a contiguous phrase match', () => {
    const phrase = make({ title: 'Red Nail Polish' });
    const scattered = make({ title: 'Polish for Red Nail' });
    expect(scoreProduct(phrase, ['nail', 'polish'])).toBeGreaterThan(
      scoreProduct(scattered, ['nail', 'polish']),
    );
  });
});

describe('rankProducts', () => {
  const list = [
    make({ id: 1, title: 'Stand', description: 'fits a laptop' }),
    make({ id: 2, title: 'Laptop stand' }),
    make({ id: 3, title: 'Mouse' }),
    make({ id: 4, title: 'Laptop bag' }),
  ];

  it('returns everything in original order for a blank query', () => {
    expect(rankProducts(list, '  ').map((p) => p.id)).toEqual([1, 2, 3, 4]);
  });

  it('drops non-matching products and sorts by relevance', () => {
    expect(rankProducts(list, 'laptop').map((p) => p.id)).toEqual([2, 4, 1]);
  });

  it('is stable: ties keep the original order', () => {
    const ties = [make({ id: 9, title: 'Lamp' }), make({ id: 5, title: 'Lamp' })];
    expect(rankProducts(ties, 'lamp').map((p) => p.id)).toEqual([9, 5]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(rankProducts(list, 'zzz')).toEqual([]);
  });

  it('does not mutate its input', () => {
    const copy = [...list];
    rankProducts(list, 'laptop');
    expect(list).toEqual(copy);
  });
});

describe('ranking regression (real fixture)', () => {
  const products = fixture as unknown as Product[];

  it.each(['mascara', 'phone', 'watch', 'red nail', 'chair'])(
    'every result for "%s" actually contains the term',
    (q) => {
      const results = rankProducts(products, q);
      expect(results.length).toBeGreaterThan(0);
      for (const p of results) {
        const hay = `${p.title} ${p.description} ${p.category} ${p.brand ?? ''}`.toLowerCase();
        for (const t of q.split(' ')) expect(hay).toContain(t);
      }
    },
  );

  it('puts title matches before description-only matches', () => {
    const results = rankProducts(products, 'watch');
    const firstDescOnly = results.findIndex((p) => !p.title.toLowerCase().includes('watch'));
    const lastTitle = results.map((p) => p.title.toLowerCase().includes('watch')).lastIndexOf(true);
    if (firstDescOnly !== -1) expect(lastTitle).toBeLessThan(firstDescOnly);
  });
});
