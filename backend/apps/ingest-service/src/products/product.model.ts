export interface Product {
  readonly id: number;
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly thumbnail: string;
  readonly images: readonly string[];
  readonly price: number;
  readonly brand?: string;
}

/** Stored shape: the public product plus the denormalised search tokens. */
export interface ProductDocument extends Product {
  /** Word prefixes of title, brand, category and description. Multikey indexed. */
  readonly searchTokens: readonly string[];
  /** Word prefixes of the title only; used for ranking. */
  readonly titleTokens: readonly string[];
  /** Word prefixes of brand and category; used for ranking. */
  readonly metaTokens: readonly string[];
}

export const PRODUCTS_COLLECTION = 'products';
