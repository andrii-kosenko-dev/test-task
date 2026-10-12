import { centroid, distance, type Point } from './geometry';
import { PolygonEditor } from './polygon-editor';
import type { Polygon } from './polygon.model';

const SIZE = { width: 1, height: 0.75 };

/** A freehand square outline, drawn with intermediate points along each side. */
const squarePath = (x0: number, y0: number, side: number): Point[] => {
  const pts: Point[] = [];
  const steps = 10;
  const corners: Point[] = [
    { x: x0, y: y0 },
    { x: x0 + side, y: y0 },
    { x: x0 + side, y: y0 + side },
    { x: x0, y: y0 + side },
    { x: x0, y: y0 },
  ];
  for (let c = 0; c < 4; c++) {
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      pts.push({
        x: corners[c].x + (corners[c + 1].x - corners[c].x) * t,
        y: corners[c].y + (corners[c + 1].y - corners[c].y) * t,
      });
    }
  }
  return pts;
};

const make = () => {
  let n = 0;
  const editor = new PolygonEditor({ ...SIZE, newId: () => `p${++n}` });
  editor.setScale(500); // 500 px per image unit
  return editor;
};

const draw = (editor: PolygonEditor, path: Point[]): boolean => {
  editor.pointerDown(path[0]);
  path.slice(1).forEach((p) => editor.pointerMove(p));
  return editor.pointerUp();
};

describe('PolygonEditor', () => {
  describe('drawing', () => {
    it('turns a freehand path into a simplified, selected polygon', () => {
      const editor = make();
      expect(draw(editor, squarePath(0.2, 0.2, 0.3))).toBe(true);
      expect(editor.polygons).toHaveLength(1);
      expect(editor.polygons[0].points).toHaveLength(4);
      expect(editor.selectedId).toBe('p1');
    });

    it('shows the in-progress path as a draft and clears it afterwards', () => {
      const editor = make();
      editor.pointerDown({ x: 0.2, y: 0.2 });
      editor.pointerMove({ x: 0.3, y: 0.2 });
      expect(editor.draft.length).toBeGreaterThan(1);
      editor.pointerUp();
      expect(editor.draft).toEqual([]);
    });

    it('discards a click or tiny scribble', () => {
      const editor = make();
      editor.pointerDown({ x: 0.2, y: 0.2 });
      expect(editor.pointerUp()).toBe(false);
      expect(
        draw(editor, [
          { x: 0.2, y: 0.2 },
          { x: 0.201, y: 0.2 },
          { x: 0.2, y: 0.201 },
        ]),
      ).toBe(false);
      expect(editor.polygons).toEqual([]);
    });

    it('keeps drawn points inside the image', () => {
      const editor = make();
      draw(editor, [
        { x: 0.5, y: 0.3 },
        { x: 1.4, y: 0.3 },
        { x: 1.4, y: 1.2 },
        { x: 0.5, y: 1.2 },
      ]);
      for (const p of editor.polygons[0].points) {
        expect(p.x).toBeLessThanOrEqual(1);
        expect(p.y).toBeLessThanOrEqual(0.75);
      }
    });

    it('cancel drops the draft', () => {
      const editor = make();
      editor.pointerDown({ x: 0.2, y: 0.2 });
      editor.pointerMove({ x: 0.4, y: 0.4 });
      editor.cancel();
      expect(editor.draft).toEqual([]);
      expect(editor.pointerUp()).toBe(false);
      expect(editor.polygons).toEqual([]);
    });
  });

  describe('selecting and moving', () => {
    const drawn = () => {
      const editor = make();
      draw(editor, squarePath(0.2, 0.2, 0.3));
      editor.pointerDown({ x: 0.9, y: 0.7 }); // click empty space
      editor.pointerUp();
      return editor;
    };

    it('clicking empty space deselects', () => {
      expect(drawn().selectedId).toBeNull();
    });

    it('clicking a polygon selects it', () => {
      const editor = drawn();
      editor.pointerDown({ x: 0.35, y: 0.35 });
      editor.pointerUp();
      expect(editor.selectedId).toBe('p1');
    });

    it('dragging a polygon moves it by the pointer delta', () => {
      const editor = drawn();
      const before = centroid(editor.polygons[0].points);
      editor.pointerDown({ x: 0.35, y: 0.35 });
      editor.pointerMove({ x: 0.45, y: 0.4 });
      expect(editor.pointerUp()).toBe(true);
      const after = centroid(editor.polygons[0].points);
      expect(after.x - before.x).toBeCloseTo(0.1);
      expect(after.y - before.y).toBeCloseTo(0.05);
    });

    it('does not drag a polygon out of the image', () => {
      const editor = drawn();
      editor.pointerDown({ x: 0.35, y: 0.35 });
      editor.pointerMove({ x: 5, y: 5 });
      editor.pointerUp();
      const pts = editor.polygons[0].points;
      expect(Math.max(...pts.map((p) => p.x))).toBeLessThanOrEqual(1 + 1e-9);
      expect(Math.max(...pts.map((p) => p.y))).toBeLessThanOrEqual(0.75 + 1e-9);
    });

    it('a click without movement is not a change', () => {
      const editor = drawn();
      editor.pointerDown({ x: 0.35, y: 0.35 });
      expect(editor.pointerUp()).toBe(false);
    });

    it('allows only one polygon per image: further drags on empty space draw nothing', () => {
      const editor = drawn();
      expect(draw(editor, squarePath(0.6, 0.4, 0.2))).toBe(false);
      expect(editor.polygons).toHaveLength(1);
      expect(editor.draft).toEqual([]);
    });

    it('allows drawing again once the polygon has been deleted', () => {
      const editor = drawn();
      editor.pointerDown({ x: 0.35, y: 0.35 });
      editor.pointerUp();
      editor.deleteSelected();
      expect(draw(editor, squarePath(0.6, 0.4, 0.2))).toBe(true);
      expect(editor.polygons).toHaveLength(1);
    });
  });

  describe('rotating', () => {
    const selected = () => {
      const editor = make();
      draw(editor, squarePath(0.3, 0.3, 0.2));
      return editor;
    };

    it('exposes a rotate handle only for the selected polygon, above it', () => {
      const editor = selected();
      const handle = editor.handlePosition()!;
      const c = centroid(editor.polygons[0].points);
      expect(handle.y).toBeLessThan(0.3);
      expect(handle.x).toBeCloseTo(c.x);
      editor.pointerDown({ x: 0.9, y: 0.7 });
      editor.pointerUp();
      expect(editor.handlePosition()).toBeNull();
    });

    it('dragging the handle rotates about the polygon center', () => {
      const editor = selected();
      const c = centroid(editor.polygons[0].points);
      const handle = editor.handlePosition()!;
      expect(editor.hitTest(handle)).toBe('rotate');
      editor.pointerDown(handle);
      // Move the pointer a quarter turn clockwise around the center.
      const r = distance(c, handle);
      editor.pointerMove({ x: c.x + r, y: c.y });
      expect(editor.pointerUp()).toBe(true);
      const pts = editor.polygons[0].points;
      // Center is unchanged, and the square keeps its side length.
      const c2 = centroid(pts);
      expect(c2.x).toBeCloseTo(c.x);
      expect(c2.y).toBeCloseTo(c.y);
      expect(distance(pts[0], pts[1])).toBeCloseTo(0.2, 1);
      // The first corner (top-left) moved a quarter turn: it is now top-right.
      expect(pts[0].x).toBeGreaterThan(c.x);
      expect(pts[0].y).toBeLessThan(c.y);
    });

    it('keeps the handle under the pointer while rotating', () => {
      const editor = selected();
      const c = centroid(editor.polygons[0].points);
      const handle = editor.handlePosition()!;
      editor.pointerDown(handle);
      const r = distance(c, handle);
      editor.pointerMove({ x: c.x + r, y: c.y });
      const h = editor.handlePosition()!;
      expect(h.x).toBeCloseTo(c.x + r);
      expect(h.y).toBeCloseTo(c.y);
    });

    it('stays rigid for any gesture angle', () => {
      const editor = selected();
      const handle = editor.handlePosition()!;
      editor.pointerDown(handle);
      editor.pointerMove({ x: 0.1, y: 0.6 });
      editor.pointerUp();
      const pts = editor.polygons[0].points;
      expect(distance(pts[0], pts[1])).toBeCloseTo(0.2, 1);
      expect(distance(pts[1], pts[2])).toBeCloseTo(0.2, 1);
    });
  });

  describe('keyboard-style commands', () => {
    it('deletes the selected polygon', () => {
      const editor = make();
      draw(editor, squarePath(0.2, 0.2, 0.3));
      expect(editor.deleteSelected()).toBe(true);
      expect(editor.polygons).toEqual([]);
      expect(editor.selectedId).toBeNull();
      expect(editor.deleteSelected()).toBe(false);
    });

    it('nudges and rotates the selected polygon', () => {
      const editor = make();
      draw(editor, squarePath(0.2, 0.2, 0.3));
      const c = centroid(editor.polygons[0].points);
      expect(editor.nudge(0.01, 0)).toBe(true);
      expect(centroid(editor.polygons[0].points).x).toBeCloseTo(c.x + 0.01);
      const first = editor.polygons[0].points[0];
      expect(editor.rotateSelected(Math.PI / 2)).toBe(true);
      expect(editor.polygons[0].points[0]).not.toEqual(first);
    });

    it('selects the polygon', () => {
      const editor = make();
      draw(editor, squarePath(0.2, 0.2, 0.2));
      editor.pointerDown({ x: 0.9, y: 0.7 });
      editor.pointerUp();
      expect(editor.selectedId).toBeNull();
      editor.selectNext();
      expect(editor.selectedId).toBe('p1');
    });
  });

  describe('syncing', () => {
    it('adopts polygons from outside and drops a stale selection', () => {
      const editor = make();
      draw(editor, squarePath(0.2, 0.2, 0.3));
      const external: Polygon[] = [
        {
          id: 'x',
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.2, y: 0.1 },
            { x: 0.2, y: 0.2 },
          ],
        },
      ];
      editor.setPolygons(external);
      expect(editor.polygons).toEqual(external);
      expect(editor.selectedId).toBeNull();
    });
  });

  describe('hitTest', () => {
    it('reports what a press would do', () => {
      const editor = make();
      draw(editor, squarePath(0.2, 0.2, 0.3));
      expect(editor.hitTest({ x: 0.35, y: 0.35 })).toBe('move');
      expect(editor.hitTest({ x: 0.9, y: 0.7 })).toBe('draw');
    });
  });
});
