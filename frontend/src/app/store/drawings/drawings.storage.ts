import { Injectable } from '@angular/core';
import type { Polygon } from '../../core/drawing/polygon.model';

export const DRAWINGS_STORAGE_KEY = 'product-search.drawings';

export type StoredDrawings = Record<string, readonly Polygon[]>;

/** Persistence seam for drawings; swap the provider in `app.config.ts` once a backend exists. */
export abstract class DrawingsStorage {
  abstract load(): StoredDrawings;
  abstract save(byImage: StoredDrawings): void;
}

const isPoint = (p: unknown): boolean =>
  typeof p === 'object' &&
  p !== null &&
  Number.isFinite((p as { x: unknown }).x) &&
  Number.isFinite((p as { y: unknown }).y);

const isPolygon = (p: unknown): p is Polygon =>
  typeof p === 'object' &&
  p !== null &&
  typeof (p as { id: unknown }).id === 'string' &&
  Array.isArray((p as { points: unknown }).points) &&
  (p as { points: unknown[] }).points.every(isPoint);

@Injectable()
export class LocalStorageDrawings extends DrawingsStorage {
  load(): StoredDrawings {
    try {
      const raw = JSON.parse(localStorage.getItem(DRAWINGS_STORAGE_KEY) ?? '{}') as unknown;
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
      const result: StoredDrawings = {};
      for (const [key, value] of Object.entries(raw)) {
        if (Array.isArray(value) && value.length > 0 && value.every(isPolygon)) result[key] = value;
      }
      return result;
    } catch {
      return {};
    }
  }

  save(byImage: StoredDrawings): void {
    try {
      localStorage.setItem(DRAWINGS_STORAGE_KEY, JSON.stringify(byImage));
    } catch {
      // Storage unavailable or full: drawings just won't survive a reload.
    }
  }
}
