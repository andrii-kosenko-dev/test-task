import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatIconButton } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Store } from '@ngrx/store';
import { ProductsActions } from '../../store/products/products.actions';
import { SuggestionsService } from './suggestions.service';

@Component({
  selector: 'app-search-bar',
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconButton,
  ],
  templateUrl: './search-bar.html',
  styleUrl: './search-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBar {
  private readonly store = inject(Store);

  protected readonly control = new FormControl('', { nonNullable: true });
  private readonly value = toSignal(this.control.valueChanges, { initialValue: '' });
  protected readonly suggestions = inject(SuggestionsService).suggestionsFor(this.value);

  constructor() {
    // Typing alone triggers the search; debouncing and normalization live in the effect.
    this.control.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((query) => this.store.dispatch(ProductsActions.queryChanged({ query })));
  }

  protected clear(): void {
    this.control.setValue('');
  }
}
