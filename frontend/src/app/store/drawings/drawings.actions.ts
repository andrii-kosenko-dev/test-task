import { createActionGroup, props } from '@ngrx/store';
import type { Polygon } from '../../core/drawing/polygon.model';

export const DrawingsActions = createActionGroup({
  source: 'Drawings',
  events: {
    Loaded: props<{ byImage: Record<string, readonly Polygon[]> }>(),
    'Polygons Changed': props<{ key: string; polygons: readonly Polygon[] }>(),
  },
});
