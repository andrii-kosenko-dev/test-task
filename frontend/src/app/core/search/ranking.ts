import type { Product } from '../models/product.model';
import { normalize, tokenize } from './tokenize';

const SCORE = {
  titleExact: 100,
  titlePrefix: 60,
  titleSubstring: 40,
  metaPrefix: 30,
  metaSubstring: 20,
  descPrefix: 15,
  descSubstring: 8,
  phraseBonus: 25,
} as const;

function matchField(
  words: string[],
  text: string,
  token: string,
  exact: number,
  prefix: number,
  sub: number,
): number {
  if (exact > 0 && words.includes(token)) return exact;
  if (words.some((w) => w.startsWith(token))) return prefix;
  return text.includes(token) ? sub : 0;
}

/**
 * Relevance of a product for the given query tokens.
 * Every token must match somewhere (AND); otherwise the score is 0.
 */
export function scoreProduct(product: Product, tokens: readonly string[]): number {
  if (tokens.length === 0) return 0;

  const title = normalize(product.title);
  const titleWords = tokenize(product.title);
  const meta = normalize(`${product.brand ?? ''} ${product.category}`);
  const metaWords = tokenize(meta);
  const desc = normalize(product.description);
  const descWords = tokenize(product.description);

  let total = 0;
  for (const token of tokens) {
    const best = Math.max(
      matchField(
        titleWords,
        title,
        token,
        SCORE.titleExact,
        SCORE.titlePrefix,
        SCORE.titleSubstring,
      ),
      matchField(metaWords, meta, token, 0, SCORE.metaPrefix, SCORE.metaSubstring),
      matchField(descWords, desc, token, 0, SCORE.descPrefix, SCORE.descSubstring),
    );
    if (best === 0) return 0;
    total += best;
  }

  if (tokens.length > 1 && title.includes(tokens.join(' '))) total += SCORE.phraseBonus;
  return total;
}

/** Filters and orders products by relevance. Blank queries return the input order. Stable. */
export function rankProducts(products: readonly Product[], query: string): Product[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [...products];

  return products
    .map((product, index) => ({ product, index, score: scoreProduct(product, tokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.product);
}
