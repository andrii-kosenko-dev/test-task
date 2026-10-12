import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import type { Polygon } from '../../core/drawing/polygon.model';
import { DrawingsActions } from './drawings.actions';

export interface DrawingsState {
  /** Polygons per image, keyed by `drawingKey`. Images without polygons have no entry. */
  readonly byImage: Readonly<Record<string, readonly Polygon[]>>;
}

export const initialDrawingsState: DrawingsState = { byImage: {} };

export const drawingKey = (productId: number, imageUrl: string): string =>
  `${productId}|${imageUrl}`;

export const drawingsFeature = createFeature({
  name: 'drawings',
  reducer: createReducer(
    initialDrawingsState,
    on(DrawingsActions.loaded, (_, { byImage }): DrawingsState => ({ byImage })),
    on(DrawingsActions.polygonsChanged, (state, { key, polygons }): DrawingsState => {
      if (polygons.length > 0) return { byImage: { ...state.byImage, [key]: polygons } };
      const { [key]: _removed, ...rest } = state.byImage;
      return { byImage: rest };
    }),
  ),
});

export const selectPolygonsFor = (key: string) =>
  createSelector(drawingsFeature.selectByImage, (byImage) => byImage[key] ?? []);
