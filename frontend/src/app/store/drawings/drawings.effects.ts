import { Injectable, inject } from '@angular/core';
import { Actions, ROOT_EFFECTS_INIT, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { map, tap, withLatestFrom } from 'rxjs';
import { DrawingsActions } from './drawings.actions';
import { drawingsFeature } from './drawings.reducer';
import { DrawingsStorage } from './drawings.storage';

@Injectable()
export class DrawingsEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);
  private readonly storage = inject(DrawingsStorage);

  readonly load$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ROOT_EFFECTS_INIT),
      map(() => DrawingsActions.loaded({ byImage: this.storage.load() })),
    ),
  );

  readonly persist$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(DrawingsActions.polygonsChanged),
        withLatestFrom(this.store.select(drawingsFeature.selectByImage)),
        tap(([, byImage]) => this.storage.save(byImage)),
      ),
    { dispatch: false },
  );
}
