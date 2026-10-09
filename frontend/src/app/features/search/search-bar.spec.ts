import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatAutocompleteHarness } from '@angular/material/autocomplete/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import type { MockInstance } from 'vitest';
import { ProductsApi } from '../../core/api/products-api';
import { ProductsActions } from '../../store/products/products.actions';
import { initialQueriesState, queriesAdapter } from '../../store/queries/queries.reducer';
import { SearchBar } from './search-bar';

describe('SearchBar', () => {
  let fixture: ComponentFixture<SearchBar>;
  let loader: HarnessLoader;
  let dispatch: MockInstance<MockStore['dispatch']>;

  beforeEach(async () => {
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
    await TestBed.configureTestingModule({
      imports: [SearchBar],
      providers: [
        provideMockStore({ initialState: { queries } }),
        {
          provide: ProductsApi,
          useValue: { titles: () => of(['Mascara Lash', 'Nail Polish']), search: vi.fn() },
        },
      ],
    }).compileComponents();
    dispatch = vi.spyOn(TestBed.inject(MockStore), 'dispatch');
    fixture = TestBed.createComponent(SearchBar);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  });

  const autocomplete = () => loader.getHarness(MatAutocompleteHarness);
  const el = () => fixture.nativeElement as HTMLElement;

  it('has an accessible label and no submit/search button', () => {
    expect(el().querySelector('label, mat-label')?.textContent).toContain('Search products');
    expect(el().querySelector('button[type="submit"]')).toBeNull();
    expect(el().querySelector('form')).toBeNull();
  });

  it('dispatches the query as the user types (no button needed)', async () => {
    await (await autocomplete()).enterText('mas');
    expect(dispatch).toHaveBeenLastCalledWith(ProductsActions.queryChanged({ query: 'mas' }));
  });

  it('dispatches on every keystroke; debouncing lives in the effect', async () => {
    await (await autocomplete()).enterText('ma');
    const queries = dispatch.mock.calls.map(
      ([action]) => (action as unknown as { query: string }).query,
    );
    expect(queries).toEqual(['m', 'ma']);
  });

  it('shows history first, then title-term suggestions', async () => {
    const ac = await autocomplete();
    await ac.enterText('mas');
    const options = await ac.getOptions();
    expect(await Promise.all(options.map((o) => o.getText()))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('mascara waterproof'),
        expect.stringContaining('mascara'),
      ]),
    );
    expect(await options[0].getText()).toContain('mascara waterproof');
  });

  it('shows no suggestions for an empty input', async () => {
    const ac = await autocomplete();
    await ac.focus();
    expect(await ac.isOpen()).toBe(false);
  });

  it('applies a picked suggestion to the input and searches for it', async () => {
    const ac = await autocomplete();
    await ac.enterText('nai');
    await ac.selectOption({ text: /nail/ });
    expect(await ac.getValue()).toBe('nail');
    expect(dispatch).toHaveBeenLastCalledWith(ProductsActions.queryChanged({ query: 'nail' }));
  });

  it('clears the input and the search with the clear button', async () => {
    const ac = await autocomplete();
    expect(el().querySelector('.clear')).toBeNull();
    await ac.enterText('phone');
    fixture.detectChanges();
    el().querySelector<HTMLButtonElement>('.clear')!.click();
    await fixture.whenStable();
    expect(await ac.getValue()).toBe('');
    expect(dispatch).toHaveBeenLastCalledWith(ProductsActions.queryChanged({ query: '' }));
  });
});
