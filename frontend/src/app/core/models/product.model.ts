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

export interface ProductPage {
  readonly items: readonly Product[];
  readonly total: number;
}
