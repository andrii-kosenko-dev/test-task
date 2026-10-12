/**
 * Pure polygon math. Coordinates are in image units: 1 is the full image width, so the image
 * spans x ∈ [0, 1] and y ∈ [0, 1 / aspect]. Using one unit on both axes keeps shapes rigid
 * (rotation never skews) and makes them independent of the rendered pixel size.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

export function bounds(points: readonly Point[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { x, y } of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

function signedArea(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export const area = (points: readonly Point[]): number => Math.abs(signedArea(points));

/** Area centroid; falls back to the vertex mean for a degenerate (zero-area) shape. */
export function centroid(points: readonly Point[]): Point {
  const a = signedArea(points);
  if (Math.abs(a) < 1e-12) {
    const n = points.length || 1;
    return {
      x: points.reduce((s, p) => s + p.x, 0) / n,
      y: points.reduce((s, p) => s + p.y, 0) / n,
    };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    const cross = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export const translate = (points: readonly Point[], dx: number, dy: number): Point[] =>
  points.map((p) => ({ x: p.x + dx, y: p.y + dy }));

export function rotate(points: readonly Point[], angle: number, center: Point): Point[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return points.map((p) => {
    const x = p.x - center.x;
    const y = p.y - center.y;
    return { x: center.x + x * cos - y * sin, y: center.y + x * sin + y * cos };
  });
}

/** Ray casting; works for concave polygons. */
export function pointInPolygon(point: Point, points: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const len = distance(a, b);
  if (len === 0) return distance(p, a);
  return Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / len;
}

/** Ramer–Douglas–Peucker: reduces a freehand path to its significant vertices. */
export function simplify(points: readonly Point[], epsilon: number): Point[] {
  if (points.length < 3) return [...points];
  const last = points.length - 1;
  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < last; i++) {
    const d = perpendicularDistance(points[i], points[0], points[last]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist <= epsilon) return [points[0], points[last]];
  const left = simplify(points.slice(0, index + 1), epsilon);
  const right = simplify(points.slice(index), epsilon);
  return [...left.slice(0, -1), ...right];
}

/** A polygon worth keeping: at least three vertices and a visible area. */
export const isDrawable = (points: readonly Point[], minArea: number): boolean =>
  points.length >= 3 && area(points) >= minArea;

/** Limits a move so the polygon's bounding box stays inside a `width` × `height` image. */
export function clampTranslation(
  points: readonly Point[],
  dx: number,
  dy: number,
  width: number,
  height: number,
): { dx: number; dy: number } {
  const b = bounds(points);
  return {
    dx: Math.min(Math.max(dx, -b.minX), width - b.maxX),
    dy: Math.min(Math.max(dy, -b.minY), height - b.maxY),
  };
}
