import { DrawingsActions } from './drawings.actions';
import { drawingKey, drawingsFeature, initialDrawingsState } from './drawings.reducer';
import type { Polygon } from '../../core/drawing/polygon.model';

const poly = (id: string): Polygon => ({
  id,
  points: [
    { x: 0, y: 0 },
    { x: 0.1, y: 0 },
    { x: 0.1, y: 0.1 },
  ],
});

describe('drawings reducer', () => {
  const reduce = drawingsFeature.reducer;

  it('builds a key from product id and image url', () => {
    expect(drawingKey(7, 'https://cdn.test/7/1.webp')).toBe('7|https://cdn.test/7/1.webp');
  });

  it('stores polygons per image', () => {
    let state = reduce(
      initialDrawingsState,
      DrawingsActions.polygonsChanged({ key: 'a', polygons: [poly('1')] }),
    );
    state = reduce(state, DrawingsActions.polygonsChanged({ key: 'b', polygons: [poly('2')] }));
    expect(state.byImage['a']).toEqual([poly('1')]);
    expect(state.byImage['b']).toEqual([poly('2')]);
  });

  it('replaces the polygons of an image', () => {
    let state = reduce(
      initialDrawingsState,
      DrawingsActions.polygonsChanged({ key: 'a', polygons: [poly('1')] }),
    );
    state = reduce(state, DrawingsActions.polygonsChanged({ key: 'a', polygons: [poly('3')] }));
    expect(state.byImage['a']).toEqual([poly('3')]);
  });

  it('drops the entry when an image has no polygons left', () => {
    let state = reduce(
      initialDrawingsState,
      DrawingsActions.polygonsChanged({ key: 'a', polygons: [poly('1')] }),
    );
    state = reduce(state, DrawingsActions.polygonsChanged({ key: 'a', polygons: [] }));
    expect(state.byImage).toEqual({});
  });

  it('replaces everything when loaded from storage', () => {
    const state = reduce(
      initialDrawingsState,
      DrawingsActions.loaded({ byImage: { z: [poly('9')] } }),
    );
    expect(state.byImage).toEqual({ z: [poly('9')] });
  });
});
