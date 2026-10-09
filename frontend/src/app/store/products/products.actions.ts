import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { Product } from '../../core/models/product.model';

export const ProductsActions = createActionGroup({
  source: 'Products',
  events: {
    /** Raw user input; debounced and normalized by the effects. */
    'Query Changed': props<{ query: string }>(),
    'Load Next Page': emptyProps(),
    'Search Requested': props<{ query: string; page: number }>(),
    'Search Succeeded': props<{
      query: string;
      page: number;
      items: readonly Product[];
      total: number;
    }>(),
    'Search Failed': props<{ error: string }>(),
  },
});
