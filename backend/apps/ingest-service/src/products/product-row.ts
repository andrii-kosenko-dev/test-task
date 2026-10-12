import type { Product } from './product.model';

export type RowResult =
  | { readonly ok: true; readonly product: Product }
  | { readonly ok: false; readonly errors: string[] };

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return NaN;
}

function toText(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

function toImages(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return [];
  if (typeof value === 'string') return value.split('|').map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) return value as string[];
  return undefined;
}

/** Validates and normalises one untrusted row (JSON object or spreadsheet row) into a `Product`. */
export function parseProductRow(raw: unknown): RowResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ['row must be an object'] };
  }
  const r = raw as Record<string, unknown>;
  const errors: string[] = [];

  const id = toNumber(r['id']);
  if (!Number.isInteger(id) || id < 0) errors.push('id must be a non-negative integer');

  const price = toNumber(r['price']);
  if (!Number.isFinite(price) || price < 0) errors.push('price must be a non-negative number');

  const text = (field: string): string => {
    const v = toText(r[field]);
    if (!v) errors.push(`${field} must be a non-empty string`);
    return v ?? '';
  };
  const title = text('title');
  const category = text('category');
  const description = toText(r['description']) ?? '';
  const thumbnail = toText(r['thumbnail']) ?? '';
  const brand = toText(r['brand']);

  const images = toImages(r['images']);
  if (images === undefined) errors.push('images must be an array of strings');

  if (errors.length > 0 || images === undefined) return { ok: false, errors };

  return {
    ok: true,
    product: { id, title, description, category, thumbnail, images, price, ...(brand ? { brand } : {}) },
  };
}
