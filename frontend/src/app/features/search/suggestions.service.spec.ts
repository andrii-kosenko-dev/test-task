import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { ProductsApi } from '../../core/api/products-api';
import { initialQueriesState, queriesAdapter } from '../../store/queries/queries.reducer';
import { SuggestionsService } from './suggestions.service';

describe('SuggestionsService', () => {
  const setup = () => {
    const queries = queriesAdapter.addOne(
      {
        id: 'mascara waterproof',
        text: 'mascara waterproof',
        hits: 2,
        resultCount: 1,
        lastUsedAt: 1,
      },
      initialQueriesState,
    );
    TestBed.configureTestingModule({
      providers: [
        provideMockStore({ initialState: { queries } }),
        {
          provide: ProductsApi,
          useValue: { titles: () => of(['Mascara Lash', 'Nail Polish']), search: vi.fn() },
        },
      ],
    });
    return TestBed.inject(SuggestionsService);
  };

  it('merges history and title terms and reacts to the input signal', () => {
    const service = setup();
    const input = signal('mas');
    const suggestions = service.suggestionsFor(input);
    expect(suggestions()).toEqual([
      { text: 'mascara waterproof', source: 'history' },
      { text: 'mascara', source: 'term' },
    ]);
    input.set('nai');
    expect(suggestions()).toEqual([{ text: 'nail', source: 'term' }]);
  });
});
