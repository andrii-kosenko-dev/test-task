import { parseProductRow } from './product-row';

const valid = {
  id: 1,
  title: 'Essence Mascara',
  description: 'Great',
  category: 'beauty',
  brand: 'Essence',
  price: 9.99,
  thumbnail: 'https://x/t.png',
  images: ['https://x/1.png'],
};

describe('parseProductRow', () => {
  it('accepts a valid row', () => {
    expect(parseProductRow(valid)).toEqual({ ok: true, product: valid });
  });

  it('coerces spreadsheet strings: numeric id/price and pipe-separated images', () => {
    const r = parseProductRow({ ...valid, id: '7', price: '12.5', images: 'a|b | c' });
    expect(r).toMatchObject({ ok: true, product: { id: 7, price: 12.5, images: ['a', 'b', 'c'] } });
  });

  it('treats a blank brand as absent', () => {
    const r = parseProductRow({ ...valid, brand: '  ' });
    expect(r.ok && 'brand' in r.product).toBe(false);
  });

  it('drops unknown fields', () => {
    const r = parseProductRow({ ...valid, rating: 4, $where: 'x' });
    expect(r.ok && Object.keys(r.product).sort()).toEqual(Object.keys(valid).sort());
  });

  it.each([
    ['not an object', 'nope', /object/],
    ['missing id', { ...valid, id: undefined }, /id/],
    ['non-integer id', { ...valid, id: 1.5 }, /id/],
    ['empty title', { ...valid, title: ' ' }, /title/],
    ['negative price', { ...valid, price: -1 }, /price/],
    ['non-string category', { ...valid, category: 3 }, /category/],
    ['images with a non-string', { ...valid, images: [1] }, /images/],
  ])('rejects %s', (_name, row, message) => {
    const r = parseProductRow(row);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.join(' ')).toMatch(message);
  });

  it('reports every problem at once', () => {
    const r = parseProductRow({ ...valid, id: 'x', title: '', price: 'abc' });
    expect(!r.ok && r.errors.length).toBe(3);
  });
});
