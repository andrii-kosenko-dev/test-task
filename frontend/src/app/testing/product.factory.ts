import type { Product } from '../core/models/product.model';

export function makeProduct(id = 1, over: Partial<Product> = {}): Product {
  return {
    id,
    title: `Product ${id}`,
    description: `Description of product ${id}`,
    category: 'beauty',
    thumbnail: `https://cdn.test/${id}/thumb.webp`,
    images: [`https://cdn.test/${id}/1.webp`, `https://cdn.test/${id}/2.webp`],
    price: 9.99,
    brand: 'Acme',
    ...over,
  };
}

export const makeProducts = (n: number, from = 1): Product[] =>
  Array.from({ length: n }, (_, i) => makeProduct(from + i));
