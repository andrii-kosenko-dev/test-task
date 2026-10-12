import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { Polygon } from '../../core/drawing/polygon.model';
import { PolygonCanvas } from './polygon-canvas';

const square = (id: string, x: number, y: number, side: number): Polygon => ({
  id,
  points: [
    { x, y },
    { x: x + side, y },
    { x: x + side, y: y + side },
    { x, y: y + side },
  ],
});

@Component({
  imports: [PolygonCanvas],
  template: `<app-polygon-canvas
    [aspect]="aspect()"
    [polygons]="polygons()"
    (polygonsChange)="changes.push($event); polygons.set($event)"
  />`,
})
class Host {
  readonly aspect = signal(1.5);
  readonly polygons = signal<readonly Polygon[]>([]);
  readonly changes: (readonly Polygon[])[] = [];
}

describe('PolygonCanvas', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let hostRect = { width: 600, height: 400 };
  let resize: () => void = () => undefined;
  let ctx: Record<string, ReturnType<typeof vi.fn>>;

  const el = () => fixture.nativeElement as HTMLElement;
  const canvas = () => el().querySelector('canvas')!;
  const button = (name: string) =>
    [...el().querySelectorAll('button')].find((b) => b.getAttribute('aria-label')?.includes(name))!;

  const pointer = (type: string, x: number, y: number) =>
    canvas().dispatchEvent(
      new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 }),
    );
  const drag = (from: [number, number], to: [number, number][]) => {
    pointer('pointerdown', ...from);
    to.forEach(([x, y]) => pointer('pointermove', x, y));
    const last = to[to.length - 1] ?? from;
    pointer('pointerup', ...last);
  };
  /** Freehand square outline in canvas pixels. */
  const outline = (x: number, y: number, s: number): [number, number][] => [
    [x + s / 2, y],
    [x + s, y],
    [x + s, y + s / 2],
    [x + s, y + s],
    [x + s / 2, y + s],
    [x, y + s],
    [x, y + s / 2],
    [x, y],
  ];

  const create = async (polygons: readonly Polygon[] = []) => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    host.polygons.set(polygons);
    await fixture.whenStable();
  };

  beforeEach(() => {
    hostRect = { width: 600, height: 400 };
    ctx = Object.fromEntries(
      [
        'clearRect',
        'beginPath',
        'moveTo',
        'lineTo',
        'closePath',
        'fill',
        'stroke',
        'arc',
        'setTransform',
        'setLineDash',
        'save',
        'restore',
      ].map((n) => [n, vi.fn()]),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const isCanvas = this.tagName === 'CANVAS';
      const width = isCanvas ? parseFloat(this.style.width) || 0 : hostRect.width;
      const height = isCanvas ? parseFloat(this.style.height) || 0 : hostRect.height;
      return {
        left: 0,
        top: 0,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        width,
        height,
      } as DOMRect;
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          resize = cb;
        }
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('layout', () => {
    it('fits the canvas to the image (contain), not to the whole stage', async () => {
      await create();
      // 600×400 stage, 3:2 image → fills the stage exactly.
      expect(canvas().style.width).toBe('600px');
      expect(canvas().style.height).toBe('400px');

      hostRect = { width: 600, height: 600 };
      resize();
      await fixture.whenStable();
      expect(canvas().style.width).toBe('600px');
      expect(canvas().style.height).toBe('400px');

      hostRect = { width: 300, height: 100 };
      resize();
      await fixture.whenStable();
      expect(canvas().style.height).toBe('100px');
      expect(canvas().style.width).toBe('150px');
    });

    it('is labelled and keyboard focusable', async () => {
      await create();
      expect(canvas().getAttribute('aria-label')).toContain('polygon');
      expect(canvas().tabIndex).toBe(0);
    });
  });

  describe('rendering', () => {
    it('draws stored polygons', async () => {
      await create([square('a', 0.1, 0.1, 0.2)]);
      expect(ctx['fill']).toHaveBeenCalled();
      expect(ctx['stroke']).toHaveBeenCalled();
    });

    it('keeps polygons proportional to the image when the size changes', async () => {
      await create([square('a', 0.5, 0.2, 0.2)]);
      const firstMove = () => ctx['moveTo'].mock.calls.at(-1)!;
      // The last moveTo of the latest redraw belongs to the outline; compare against a rescale.
      const before = ctx['moveTo'].mock.calls.find(([x]) => x === 300);
      expect(before).toBeDefined(); // 0.5 × 600px

      ctx['moveTo'].mockClear();
      hostRect = { width: 300, height: 200 };
      resize();
      await fixture.whenStable();
      const after = ctx['moveTo'].mock.calls.find(([x]) => x === 150);
      expect(after).toBeDefined(); // 0.5 × 300px, same relative position
      expect(firstMove()).toBeDefined();
    });
  });

  describe('drawing', () => {
    it('emits a new polygon after a freehand drag', async () => {
      await create();
      drag([100, 100], outline(100, 100, 150).slice(1));
      expect(host.changes).toHaveLength(1);
      const [polygon] = host.changes[0];
      expect(polygon.points.length).toBeGreaterThanOrEqual(3);
      // Stored in image units: 100px of a 600px-wide canvas.
      expect(polygon.points[0].x).toBeCloseTo(100 / 600);
      expect(polygon.points[0].y).toBeCloseTo(100 / 600);
    });

    it('emits nothing for a plain click', async () => {
      await create();
      drag([100, 100], []);
      expect(host.changes).toEqual([]);
    });
  });

  describe('moving', () => {
    it('moves a polygon with drag and drop', async () => {
      await create([square('a', 0.2, 0.2, 0.2)]); // pixels 120..240
      drag([180, 180], [[230, 210]]);
      expect(host.changes).toHaveLength(1);
      const moved = host.changes[0][0];
      expect(moved.id).toBe('a');
      expect(moved.points[0].x).toBeCloseTo(0.2 + 50 / 600);
      expect(moved.points[0].y).toBeCloseTo(0.2 + 30 / 600);
    });
  });

  describe('rotating', () => {
    it('rotates a selected polygon by dragging its handle', async () => {
      await create([square('a', 0.4, 0.4, 0.2)]); // center (300, 300)px
      drag([300, 300], []); // select it
      // Handle sits above the top edge (y = 240px − 28px) at the center x.
      drag([300, 212], [[388, 300]]); // quarter turn clockwise about (300, 300)
      expect(host.changes).toHaveLength(1);
      const [p] = host.changes[0];
      expect(p.points[0].x).toBeGreaterThan(0.5); // top-left corner swung to the right
    });
  });

  describe('toolbar and keyboard', () => {
    it('disables delete until something is selected and clear until something exists', async () => {
      await create();
      expect(button('Delete').disabled).toBe(true);
      expect(button('Clear').disabled).toBe(true);
      host.polygons.set([square('a', 0.2, 0.2, 0.2)]);
      await fixture.whenStable();
      expect(button('Clear').disabled).toBe(false);
      expect(button('Delete').disabled).toBe(true);
    });

    it('deletes the selected polygon', async () => {
      await create([square('a', 0.2, 0.2, 0.2), square('b', 0.6, 0.5, 0.2)]);
      drag([180, 180], []);
      await fixture.whenStable();
      button('Delete').click();
      await fixture.whenStable();
      expect(host.changes.at(-1)!.map((p) => p.id)).toEqual(['b']);
    });

    it('clears all polygons', async () => {
      await create([square('a', 0.2, 0.2, 0.2), square('b', 0.6, 0.5, 0.2)]);
      button('Clear').click();
      await fixture.whenStable();
      expect(host.changes.at(-1)).toEqual([]);
    });

    it('supports Delete, arrows, rotation and Enter from the keyboard', async () => {
      await create([square('a', 0.2, 0.2, 0.2), square('b', 0.6, 0.5, 0.2)]);
      const key = (k: string, init: KeyboardEventInit = {}) =>
        canvas().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...init }));

      key('Enter'); // selects the first polygon
      key('ArrowRight');
      expect(host.changes.at(-1)![0].points[0].x).toBeCloseTo(0.2 + 0.01);
      key(']');
      expect(host.changes).toHaveLength(2);
      key('Delete');
      expect(host.changes.at(-1)!.map((p) => p.id)).toEqual(['b']);
    });
  });

  describe('external updates', () => {
    it('shows different polygons when the input changes (e.g. another image)', async () => {
      await create([square('a', 0.2, 0.2, 0.2)]);
      ctx['fill'].mockClear();
      host.polygons.set([]);
      await fixture.whenStable();
      expect(ctx['fill']).not.toHaveBeenCalled();
      expect(button('Clear').disabled).toBe(true);
    });
  });
});
