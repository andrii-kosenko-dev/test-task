import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { ROOT_EFFECTS_INIT } from '@ngrx/effects';
import { provideMockStore } from '@ngrx/store/testing';
import { Observable, Subject } from 'rxjs';
import type { Polygon } from '../../core/drawing/polygon.model';
import { DrawingsActions } from './drawings.actions';
import { DrawingsEffects } from './drawings.effects';
import { DrawingsStorage } from './drawings.storage';

const poly: Polygon = {
  id: '1',
  points: [
    { x: 0, y: 0 },
    { x: 0.1, y: 0 },
    { x: 0.1, y: 0.1 },
  ],
};

describe('DrawingsEffects', () => {
  let actions$: Subject<unknown>;
  const storage = { load: vi.fn(), save: vi.fn() };

  const setup = (byImage: Record<string, readonly Polygon[]> = {}) => {
    actions$ = new Subject();
    TestBed.configureTestingModule({
      providers: [
        DrawingsEffects,
        provideMockActions(() => actions$ as unknown as Observable<never>),
        provideMockStore({ initialState: { drawings: { byImage } } }),
        { provide: DrawingsStorage, useValue: storage },
      ],
    });
    return TestBed.inject(DrawingsEffects);
  };

  beforeEach(() => {
    storage.load.mockReset();
    storage.save.mockReset();
  });

  it('loads stored drawings on startup', () => {
    storage.load.mockReturnValue({ a: [poly] });
    const out: unknown[] = [];
    setup().load$.subscribe((a) => out.push(a));
    actions$.next({ type: ROOT_EFFECTS_INIT });
    expect(out).toEqual([DrawingsActions.loaded({ byImage: { a: [poly] } })]);
  });

  it('saves the whole state whenever polygons change', () => {
    const effects = setup({ a: [poly] });
    effects.persist$.subscribe();
    actions$.next(DrawingsActions.polygonsChanged({ key: 'a', polygons: [poly] }));
    expect(storage.save).toHaveBeenCalledWith({ a: [poly] });
  });
});
