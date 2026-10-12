import { mkdir, readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { type FileFormat, writeProductsJson, writeProductsXlsx } from '../files/product-files';
import { DummyJsonClient } from './dummyjson.client';

export const EXPORT_DIR = Symbol('EXPORT_DIR');
export const NOW = Symbol('NOW');

const EXPORT_NAME = /^products-\d{8}T\d{9}Z\.(json|xlsx)$/;

export interface ExportedFile {
  readonly name: string;
  readonly format: FileFormat;
  readonly bytes: number;
}

export interface ExportResult {
  readonly count: number;
  readonly skipped: number;
  readonly files: readonly ExportedFile[];
}

@Injectable()
export class ExportService {
  constructor(
    private readonly client: DummyJsonClient,
    @Inject(EXPORT_DIR) private readonly dir: string,
    @Inject(NOW) private readonly now: () => Date = () => new Date(),
  ) {}

  /** Downloads the catalogue from the public API and saves it as JSON and Excel. */
  async fetchAndExport(): Promise<ExportResult> {
    const { products, skipped } = await this.client.fetchAllProducts();
    await mkdir(this.dir, { recursive: true });
    const stamp = this.now().toISOString().replace(/[-:.]/g, '');
    const targets: { name: string; format: FileFormat; write: (path: string) => Promise<void> }[] = [
      { name: `products-${stamp}.json`, format: 'json', write: (p) => writeProductsJson(p, products) },
      { name: `products-${stamp}.xlsx`, format: 'xlsx', write: (p) => writeProductsXlsx(p, products) },
    ];
    const files: ExportedFile[] = [];
    for (const t of targets) {
      const path = join(this.dir, t.name);
      await t.write(path);
      files.push({ name: t.name, format: t.format, bytes: (await stat(path)).size });
    }
    return { count: products.length, skipped, files };
  }

  async list(): Promise<ExportedFile[]> {
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    const files = await Promise.all(
      names
        .filter((n) => EXPORT_NAME.test(n))
        .map(async (name) => ({
          name,
          format: name.endsWith('.json') ? ('json' as const) : ('xlsx' as const),
          bytes: (await stat(join(this.dir, name))).size,
        })),
    );
    return files.sort((a, b) => b.name.localeCompare(a.name));
  }

  /** Maps a client-supplied name to a path inside the export directory, or throws. */
  resolve(name: string): string {
    if (basename(name) !== name || !EXPORT_NAME.test(name)) throw new Error(`Invalid export name "${name}"`);
    return join(this.dir, name);
  }
}
