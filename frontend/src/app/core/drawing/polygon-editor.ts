import {
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
import type { Polygon } from './polygon.model';

/** On-screen sizes (CSS px). Converted to image units through the current scale. */
export const HANDLE_OFFSET_PX = 28;
export const HANDLE_HIT_PX = 22;
const MIN_STEP_PX = 3;
const SIMPLIFY_PX = 3;
const MIN_AREA_PX2 = 400;

export type Hit = 'rotate' | 'move' | 'draw';

type Gesture =
  | { kind: 'draw'; path: Point[] }
  | { kind: 'move'; id: string; start: Point; origin: readonly Point[]; moved: boolean }
  | {
      kind: 'rotate';
      id: string;
      center: Point;
      startAngle: number;
      handleOffset: Point;
      origin: readonly Point[];
      delta: number;
    };

export interface PolygonEditorOptions {
  /** Image width and height in image units (width is always 1). */
  readonly width: number;
  readonly height: number;
  readonly newId?: () => string;
}

let idCounter = 0;
const defaultId = (): string => `${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

/**
 * Framework-free drawing, selection, move and rotate logic. Pointer positions are in image
 * units; the host converts from pixels and tells the editor the current `scale` (px per unit)
 * so touch tolerances stay constant on screen however large the image is.
 */
export class PolygonEditor {
  private readonly width: number;
  private readonly height: number;
  private readonly newId: () => string;
  private scale = 1;
  private gesture: Gesture | null = null;

  polygons: readonly Polygon[] = [];
  selectedId: string | null = null;

  constructor(options: PolygonEditorOptions) {
    this.width = options.width;
    this.height = options.height;
    this.newId = options.newId ?? defaultId;
  }

  get draft(): readonly Point[] {
    return this.gesture?.kind === 'draw' ? this.gesture.path : [];
  }

  setScale(pxPerUnit: number): void {
    this.scale = pxPerUnit;
  }

  setPolygons(polygons: readonly Polygon[]): void {
    this.polygons = polygons;
    if (this.selectedId && !polygons.some((p) => p.id === this.selectedId)) this.selectedId = null;
  }

  /** Where the rotate handle sits, or null when nothing is selected. */
  handlePosition(): Point | null {
    const polygon = this.selected();
    if (!polygon) return null;
    const g = this.gesture;
    if (g?.kind === 'rotate') {
      const o = rotate([g.handleOffset], g.delta, { x: 0, y: 0 })[0];
      return { x: g.center.x + o.x, y: g.center.y + o.y };
    }
    return this.restingHandle(polygon);
  }

  hitTest(p: Point): Hit {
    const handle = this.handlePosition();
    if (handle && distance(p, handle) <= HANDLE_HIT_PX / this.scale) return 'rotate';
    return this.polygonAt(p) ? 'move' : 'draw';
  }

  pointerDown(p: Point): void {
    const hit = this.hitTest(p);
    const polygon = hit === 'draw' ? null : this.selectedOrAt(p, hit);
    if (hit === 'rotate' && polygon) {
      const center = centroid(polygon.points);
      const handle = this.restingHandle(polygon);
      this.gesture = {
        kind: 'rotate',
        id: polygon.id,
        center,
        startAngle: Math.atan2(p.y - center.y, p.x - center.x),
        handleOffset: { x: handle.x - center.x, y: handle.y - center.y },
        origin: polygon.points,
        delta: 0,
      };
    } else if (polygon) {
      this.selectedId = polygon.id;
      this.gesture = {
        kind: 'move',
        id: polygon.id,
        start: p,
        origin: polygon.points,
        moved: false,
      };
    } else {
      this.selectedId = null;
      this.gesture = { kind: 'draw', path: [this.clamp(p)] };
    }
  }

  pointerMove(p: Point): void {
    const g = this.gesture;
    if (!g) return;
    if (g.kind === 'draw') {
      const last = g.path[g.path.length - 1];
      const next = this.clamp(p);
      if (distance(last, next) >= MIN_STEP_PX / this.scale) g.path = [...g.path, next];
    } else if (g.kind === 'move') {
      const { dx, dy } = clampTranslation(
        g.origin,
        p.x - g.start.x,
        p.y - g.start.y,
        this.width,
        this.height,
      );
      g.moved = g.moved || dx !== 0 || dy !== 0;
      this.replace(g.id, translate(g.origin, dx, dy));
    } else {
      g.delta = Math.atan2(p.y - g.center.y, p.x - g.center.x) - g.startAngle;
      this.replace(g.id, rotate(g.origin, g.delta, g.center));
    }
  }

  /** Ends the gesture. Returns true when the polygons changed and should be saved. */
  pointerUp(): boolean {
    const g = this.gesture;
    this.gesture = null;
    if (!g) return false;
    if (g.kind === 'move') return g.moved;
    if (g.kind === 'rotate') return g.delta !== 0;

    const closed = simplify([...g.path, g.path[0]], SIMPLIFY_PX / this.scale).slice(0, -1);
    if (!isDrawable(closed, MIN_AREA_PX2 / this.scale ** 2)) return false;
    const polygon: Polygon = { id: this.newId(), points: closed };
    this.polygons = [...this.polygons, polygon];
    this.selectedId = polygon.id;
    return true;
  }

  cancel(): void {
    const g = this.gesture;
    this.gesture = null;
    if (g && g.kind !== 'draw') this.replace(g.id, g.origin);
  }

  deleteSelected(): boolean {
    if (!this.selectedId) return false;
    this.polygons = this.polygons.filter((p) => p.id !== this.selectedId);
    this.selectedId = null;
    return true;
  }

  clear(): boolean {
    if (this.polygons.length === 0) return false;
    this.polygons = [];
    this.selectedId = null;
    return true;
  }

  nudge(dx: number, dy: number): boolean {
    const polygon = this.selected();
    if (!polygon) return false;
    const d = clampTranslation(polygon.points, dx, dy, this.width, this.height);
    if (d.dx === 0 && d.dy === 0) return false;
    this.replace(polygon.id, translate(polygon.points, d.dx, d.dy));
    return true;
  }

  rotateSelected(angle: number): boolean {
    const polygon = this.selected();
    if (!polygon || angle === 0) return false;
    this.replace(polygon.id, rotate(polygon.points, angle, centroid(polygon.points)));
    return true;
  }

  selectNext(): void {
    if (this.polygons.length === 0) return;
    const index = this.polygons.findIndex((p) => p.id === this.selectedId);
    this.selectedId = this.polygons[(index + 1) % this.polygons.length].id;
  }

  private selected(): Polygon | undefined {
    return this.polygons.find((p) => p.id === this.selectedId);
  }

  private selectedOrAt(p: Point, hit: Hit): Polygon | undefined {
    return hit === 'rotate' ? this.selected() : this.polygonAt(p);
  }

  /** Topmost polygon under the point (later polygons are drawn on top). */
  private polygonAt(p: Point): Polygon | undefined {
    return [...this.polygons].reverse().find((poly) => pointInPolygon(p, poly.points));
  }

  private restingHandle(polygon: Polygon): Point {
    const c = centroid(polygon.points);
    const top = bounds(polygon.points).minY;
    return {
      x: c.x,
      y: Math.max(top - HANDLE_OFFSET_PX / this.scale, HANDLE_HIT_PX / this.scale / 2),
    };
  }

  private replace(id: string, points: readonly Point[]): void {
    this.polygons = this.polygons.map((p) => (p.id === id ? { ...p, points } : p));
  }

  private clamp(p: Point): Point {
    return {
      x: Math.min(Math.max(p.x, 0), this.width),
      y: Math.min(Math.max(p.y, 0), this.height),
    };
  }
}
