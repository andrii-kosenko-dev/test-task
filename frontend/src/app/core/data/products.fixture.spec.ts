import type { Product } from '../models/product.model';
import fixture from './products.fixture.json';

const products = fixture as unknown as Product[];

describe('products fixture', () => {
  it('contains enough products to exercise paging', () => {
    expect(products.length).toBeGreaterThanOrEqual(100);
  });

  it('has unique ids', () => {
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
  });

  it('has the required fields on every product', () => {
    for (const p of products) {
      expect(typeof p.id).toBe('number');
      expect(p.title.trim()).not.toBe('');
      expect(p.description.trim()).not.toBe('');
      expect(p.category.trim()).not.toBe('');
      expect(p.thumbnail).toMatch(/^https:\/\//);
      expect(p.images.length).toBeGreaterThan(0);
      expect(p.price).toBeGreaterThan(0);
    }
  });
});
