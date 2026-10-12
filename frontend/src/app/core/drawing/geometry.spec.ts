import {
  area,
  bounds,
  centroid,
  clampTranslation,
  distance,
  isDrawable,
  pointInPolygon,
  rotate,
  simplify,
  translate,
  type Point,
} from './geometry';

const square: Point[] = [
  { x: 0.2, y: 0.2 },
  { x: 0.4, y: 0.2 },
  { x: 0.4, y: 0.4 },
  { x: 0.2, y: 0.4 },
];

describe('geometry', () => {
  it('measures distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('computes bounds', () => {
    expect(bounds(square)).toEqual({ minX: 0.2, minY: 0.2, maxX: 0.4, maxY: 0.4 });
  });

  it('computes area regardless of winding', () => {
    expect(area(square)).toBeCloseTo(0.04);
    expect(area([...square].reverse())).toBeCloseTo(0.04);
  });

  describe('centroid', () => {
    it('is the center of a square', () => {
      const c = centroid(square);
      expect(c.x).toBeCloseTo(0.3);
      expect(c.y).toBeCloseTo(0.3);
    });

    it('falls back to the vertex mean for a degenerate polygon', () => {
      const c = centroid([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ]);
      expect(c).toEqual({ x: 1, y: 1 });
    });

    it('does not move when the polygon rotates about it', () => {
      const tri: Point[] = [
        { x: 0.1, y: 0.1 },
        { x: 0.5, y: 0.15 },
        { x: 0.2, y: 0.6 },
      ];
      const c = centroid(tri);
      const r = centroid(rotate(tri, 1.1, c));
      expect(r.x).toBeCloseTo(c.x);
      expect(r.y).toBeCloseTo(c.y);
    });
  });

  describe('translate', () => {
    it('moves every point', () => {
      expect(translate(square, 0.1, -0.1)[0]).toEqual({ x: 0.30000000000000004, y: 0.1 });
    });

    it('does not mutate the input', () => {
      translate(square, 1, 1);
      expect(square[0]).toEqual({ x: 0.2, y: 0.2 });
    });
  });

  describe('rotate', () => {
    it('rotates a quarter turn about a center', () => {
      const [p] = rotate([{ x: 1, y: 0 }], Math.PI / 2, { x: 0, y: 0 });
      expect(p.x).toBeCloseTo(0);
      expect(p.y).toBeCloseTo(1);
    });

    it('preserves side lengths', () => {
      const r = rotate(square, 0.7, centroid(square));
      expect(distance(r[0], r[1])).toBeCloseTo(0.2);
      expect(distance(r[1], r[2])).toBeCloseTo(0.2);
    });

    it('a full turn returns to the start', () => {
      const r = rotate(square, Math.PI * 2, centroid(square));
      r.forEach((p, i) => {
        expect(p.x).toBeCloseTo(square[i].x);
        expect(p.y).toBeCloseTo(square[i].y);
      });
    });
  });

  describe('pointInPolygon', () => {
    it('detects inside and outside', () => {
      expect(pointInPolygon({ x: 0.3, y: 0.3 }, square)).toBe(true);
      expect(pointInPolygon({ x: 0.5, y: 0.3 }, square)).toBe(false);
      expect(pointInPolygon({ x: 0.3, y: 0.1 }, square)).toBe(false);
    });

    it('handles concave shapes', () => {
      const u: Point[] = [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 3 },
        { x: 2, y: 3 },
        { x: 2, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 3 },
        { x: 0, y: 3 },
      ];
      expect(pointInPolygon({ x: 1.5, y: 2 }, u)).toBe(false);
      expect(pointInPolygon({ x: 0.5, y: 2 }, u)).toBe(true);
    });
  });

  describe('simplify', () => {
    it('drops collinear points', () => {
      const line: Point[] = [0, 0.25, 0.5, 0.75, 1].map((x) => ({ x, y: 0 }));
      expect(simplify(line, 0.01)).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]);
    });

    it('keeps corners beyond the tolerance', () => {
      const path: Point[] = [
        { x: 0, y: 0 },
        { x: 0.5, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 0.5 },
        { x: 1, y: 1 },
      ];
      expect(simplify(path, 0.01)).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ]);
    });

    it('returns short paths unchanged', () => {
      const two: Point[] = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ];
      expect(simplify(two, 0.5)).toEqual(two);
    });
  });

  describe('isDrawable', () => {
    it('needs three points and a visible area', () => {
      expect(isDrawable(square, 0.0001)).toBe(true);
      expect(isDrawable(square.slice(0, 2), 0.0001)).toBe(false);
      expect(isDrawable(square, 0.1)).toBe(false);
    });
  });

  describe('clampTranslation', () => {
    it('keeps the polygon inside the image', () => {
      expect(clampTranslation(square, 5, 5, 1, 0.75)).toEqual({ dx: 0.6, dy: 0.35 });
      const d = clampTranslation(square, -5, -5, 1, 0.75);
      expect(d.dx).toBeCloseTo(-0.2);
      expect(d.dy).toBeCloseTo(-0.2);
    });

    it('passes small moves through', () => {
      expect(clampTranslation(square, 0.1, -0.05, 1, 0.75)).toEqual({ dx: 0.1, dy: -0.05 });
    });
  });
});
