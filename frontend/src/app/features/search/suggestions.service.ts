import { Injectable, Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { map } from 'rxjs';
import { ProductsApi } from '../../core/api/products-api';
import { buildTermIndex, suggest, type Suggestion } from '../../core/suggest/suggest';
import { queriesFeature } from '../../store/queries/queries.reducer';

/** Combines the stored search history with a term index built from product titles. */
@Injectable({ providedIn: 'root' })
export class SuggestionsService {
  private readonly history = inject(Store).selectSignal(queriesFeature.selectAll);
  private readonly terms = toSignal(inject(ProductsApi).titles().pipe(map(buildTermIndex)), {
    initialValue: [],
  });

  suggestionsFor(input: Signal<string>): Signal<Suggestion[]> {
    return computed(() =>
      suggest({ input: input(), history: this.history(), terms: this.terms() }),
    );
  }
}
