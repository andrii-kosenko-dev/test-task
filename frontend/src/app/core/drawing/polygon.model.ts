import type { Point } from './geometry';

export interface Polygon {
  readonly id: string;
  /** Vertices in image units (see `geometry.ts`). Rotation is baked into the points. */
  readonly points: readonly Point[];
}
