import { createReadStream } from 'node:fs';
import { open, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { Workbook, stream as excelStream } from 'exceljs';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick.js';
import { streamArray } from 'stream-json/streamers/StreamArray.js';
import type { Product } from '../products/product.model';

export type FileFormat = 'json' | 'xlsx';

export const PRODUCT_COLUMNS = ['id', 'title', 'description', 'category', 'brand', 'price', 'thumbnail', 'images'] as const;

export function detectFormat(filename: string): FileFormat {
  const ext = extname(filename).toLowerCase();
  if (ext === '.json') return 'json';
  if (ext === '.xlsx') return 'xlsx';
  throw new Error(`Unsupported file type "${ext || filename}". Use .json or .xlsx`);
}

export async function writeProductsJson(file: string, products: readonly Product[]): Promise<void> {
  await writeFile(file, JSON.stringify(products, null, 2));
}

export async function writeProductsXlsx(file: string, products: readonly Product[]): Promise<void> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('products');
  sheet.columns = PRODUCT_COLUMNS.map((key) => ({ header: key, key, width: key === 'description' ? 60 : 20 }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  for (const p of products) sheet.addRow({ ...p, brand: p.brand ?? '', images: p.images.join('|') });
  await workbook.xlsx.writeFile(file);
}

/** Streams rows out of a file without loading it whole. Rows are untrusted; validate them. */
export function readProductRows(file: string, format: FileFormat): AsyncIterable<unknown> {
  return format === 'json' ? readJsonRows(file) : readXlsxRows(file);
}

async function firstNonSpaceChar(file: string): Promise<string> {
  const handle = await open(file, 'r');
  try {
    const buffer = Buffer.alloc(512);
    const { bytesRead } = await handle.read(buffer, 0, 512, 0);
    return buffer.toString('utf8', 0, bytesRead).replace(/^﻿/, '').trimStart().charAt(0);
  } finally {
    await handle.close();
  }
}

async function* readJsonRows(file: string): AsyncGenerator<unknown> {
  const first = await firstNonSpaceChar(file);
  const stages = first === '{' ? [createReadStream(file), parser(), pick({ filter: 'products' }), streamArray()] : [createReadStream(file), parser(), streamArray()];
  const pipeline = chain(stages);
  try {
    for await (const item of pipeline as AsyncIterable<{ value: unknown }>) yield item.value;
  } finally {
    pipeline.destroy();
  }
}

function cellValue(value: unknown): unknown {
  if (value && typeof value === 'object') {
    const v = value as { text?: unknown; result?: unknown; richText?: { text: string }[] };
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if (v.text !== undefined) return v.text;
    if (v.result !== undefined) return v.result;
  }
  return value;
}

async function* readXlsxRows(file: string): AsyncGenerator<unknown> {
  const reader = new excelStream.xlsx.WorkbookReader(file, { entries: 'emit', sharedStrings: 'cache', styles: 'ignore', worksheets: 'emit' });
  for await (const worksheet of reader) {
    let headers: string[] | undefined;
    for await (const row of worksheet) {
      const values = (row.values as unknown[]).slice(1).map(cellValue);
      if (!headers) {
        headers = values.map((v) => String(v ?? '').trim());
        continue;
      }
      if (values.every((v) => v === null || v === undefined || v === '')) continue;
      yield Object.fromEntries(headers.map((h, i) => [h, values[i] ?? undefined]).filter(([h]) => h !== ''));
    }
    return; // first sheet only
  }
}
