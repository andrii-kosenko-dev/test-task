import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { Collection } from 'mongodb';
import { collectionToken } from '@app/mongo';
import type { Page } from '@app/common';
import { buildTokens, queryTokens } from './search-tokens';
import { buildSearchPipeline } from './search-pipeline';
import { type Product, type ProductDocument, PRODUCTS_COLLECTION } from './product.model';

export const PRODUCTS_COLLECTION_TOKEN = collectionToken(PRODUCTS_COLLECTION);

export interface UpsertOutcome {
  readonly inserted: number;
  readonly updated: number;
}

@Injectable()
export class ProductsRepository implements OnModuleInit {
  constructor(@Inject(PRODUCTS_COLLECTION_TOKEN) private readonly products: Collection<ProductDocument>) {}

  async onModuleInit(): Promise<void> {
    await this.ensureIndexes();
  }

  /** Idempotent. `id` is the natural key; `searchTokens` is the multikey index behind search. */
  async ensureIndexes(): Promise<void> {
    await this.products.createIndex({ id: 1 }, { unique: true, name: 'id_unique' });
    await this.products.createIndex({ searchTokens: 1 }, { name: 'search_tokens' });
  }

  async upsertMany(products: readonly Product[]): Promise<UpsertOutcome> {
    if (products.length === 0) return { inserted: 0, updated: 0 };
    const result = await this.products.bulkWrite(
      products.map((p) => {
        const doc: ProductDocument = { ...p, ...buildTokens(p) };
        return { replaceOne: { filter: { id: p.id }, replacement: doc, upsert: true } };
      }),
      { ordered: false },
    );
    return { inserted: result.upsertedCount, updated: result.matchedCount };
  }

  /** Zero-based page. Blank query lists everything in id order. */
  async search(query: string, page: number, pageSize: number): Promise<Page<Product>> {
    const tokens = queryTokens(query);
    if (tokens.length === 0) {
      const [items, total] = await Promise.all([
        this.products
          .find({}, { projection: { _id: 0, searchTokens: 0, titleTokens: 0, metaTokens: 0 } })
          .sort({ id: 1 })
          .skip(page * pageSize)
          .limit(pageSize)
          .toArray(),
        this.products.estimatedDocumentCount(),
      ]);
      return { items: items as unknown as Product[], total };
    }
    const [facet] = await this.products
      .aggregate<{ items: Product[]; total: { n: number }[] }>(buildSearchPipeline(tokens, page, pageSize))
      .toArray();
    return { items: facet?.items ?? [], total: facet?.total[0]?.n ?? 0 };
  }

  async titles(): Promise<string[]> {
    const docs = await this.products.find({}, { projection: { _id: 0, title: 1 } }).sort({ id: 1 }).toArray();
    return docs.map((d) => d.title);
  }

  async findById(id: number): Promise<Product | null> {
    return (await this.products.findOne(
      { id },
      { projection: { _id: 0, searchTokens: 0, titleTokens: 0, metaTokens: 0 } },
    )) as unknown as Product | null;
  }

  count(): Promise<number> {
    return this.products.estimatedDocumentCount();
  }
}
