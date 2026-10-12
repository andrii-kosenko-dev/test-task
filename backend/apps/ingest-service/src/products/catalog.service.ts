import { Inject, Injectable } from '@nestjs/common';
import { ExportService, type ExportResult } from '../fetch/export.service';
import { type FileFormat, readProductRows } from '../files/product-files';
import { ImportResult, ImportService } from './import.service';
import { ProductsRepository } from './products.repository';

export const READ_ROWS = Symbol('READ_ROWS');
export type RowReader = (file: string, format: FileFormat) => AsyncIterable<unknown>;

export interface SyncResult {
  readonly export: ExportResult;
  readonly import: ImportResult | null;
}

/** Orchestrates "fetch from the public API, save to file, optionally load into Mongo". */
@Injectable()
export class CatalogService {
  constructor(
    private readonly exporter: ExportService,
    private readonly importer: ImportService,
    private readonly repository: ProductsRepository,
    @Inject(READ_ROWS) private readonly readRows: RowReader = readProductRows,
  ) {}

  async syncFromPublicApi(importAfter: boolean): Promise<SyncResult> {
    const exported = await this.exporter.fetchAndExport();
    if (!importAfter) return { export: exported, import: null };
    const json = exported.files.find((f) => f.format === 'json');
    if (!json) throw new Error('Export produced no JSON file to import');
    const imported = await this.importer.import(this.readRows(this.exporter.resolve(json.name), 'json'));
    return { export: exported, import: imported };
  }

  /** Returns true when it seeded. */
  async seedIfEmpty(): Promise<boolean> {
    if ((await this.repository.count()) > 0) return false;
    await this.syncFromPublicApi(true);
    return true;
  }
}
