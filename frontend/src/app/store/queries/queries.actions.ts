import { createActionGroup, emptyProps, props } from '@ngrx/store';

export const QueriesActions = createActionGroup({
  source: 'Queries',
  events: {
    'Query Recorded': props<{ query: string; resultCount: number; timestamp: number }>(),
    Cleared: emptyProps(),
  },
});
