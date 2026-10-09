import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { PRODUCTS_API_LATENCY_MS } from './core/api/fixture-products-api';
import { App } from './app';
import { appConfig } from './app.config';
import { SEARCH_DEBOUNCE_MS } from './store/products/products.effects';
import { queriesFeature } from './store/queries/queries.reducer';

/**
 * Functional / regression suite: the real store, effects, fixture API and components
 * wired together exactly as in production (only latency is zeroed).
 */
describe('App (integration)', () => {
  let fixture: ComponentFixture<App>;
  let store: Store;
  const el = () => fixture.nativeElement as HTMLElement;

  const settle = async (ms = SEARCH_DEBOUNCE_MS + 10) => {
    await vi.advanceTimersByTimeAsync(ms);
    await fixture.whenStable();
  };

  const type = async (text: string) => {
    const input = el().querySelector<HTMLInputElement>('input')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await settle();
  };

  const summary = () => el().querySelector('.summary')?.textContent?.trim();
  const cardTitles = () =>
    Array.from(el().querySelectorAll('app-product-card .title')).map((t) => t.textContent!.trim());

  beforeEach(async () => {
    vi.useFakeTimers();
    localStorage.clear();
    document.documentElement.className = '';
    TestBed.configureTestingModule({
      imports: [App],
      providers: [...appConfig.providers, { provide: PRODUCTS_API_LATENCY_MS, useValue: 0 }],
    });
    store = TestBed.inject(Store);
    fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    await settle();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.querySelectorAll('.cdk-overlay-container *').forEach((n) => n.remove());
  });

  it('lists every product on load, in the dark theme by default', () => {
    expect(summary()).toMatch(/^\d{3} products$/);
    expect(cardTitles().length).toBeGreaterThan(0);
    expect(document.documentElement.classList.contains('dark-theme')).toBe(true);
  });

  it('has a search field and no button to trigger the search', () => {
    expect(el().querySelector('input')).not.toBeNull();
    expect(el().querySelector('app-search-bar button[type="submit"]')).toBeNull();
  });

  it('searches in real time just by typing, ranking matching products first', async () => {
    await type('mascara');
    expect(summary()).toContain('for “mascara”');
    expect(cardTitles()[0].toLowerCase()).toContain('mascara');
    expect(cardTitles().every((t) => /mascara/i.test(t))).toBe(true);
  });

  it('supports partial words', async () => {
    await type('masc');
    expect(cardTitles()[0].toLowerCase()).toContain('mascara');
  });

  it('shows an empty state when nothing matches, and recovers on clear', async () => {
    await type('zzzzqqq');
    expect(el().querySelector('.empty')?.textContent).toContain('zzzzqqq');
    el().querySelector<HTMLButtonElement>('button.clear')!.click();
    await settle();
    expect(summary()).toMatch(/^\d{3} products$/);
  });

  it('debounces fast typing into a single search', async () => {
    const input = el().querySelector<HTMLInputElement>('input')!;
    for (const text of ['m', 'ma', 'mas', 'masc']) {
      input.value = text;
      input.dispatchEvent(new Event('input'));
      await vi.advanceTimersByTimeAsync(50);
    }
    await settle();
    expect(summary()).toContain('for “masc”');
  });

  it('remembers only meaningful queries in the store', async () => {
    await type('mascara');
    await type('zzzzqqq'); // no results → not remembered
    await type('x'); // too short → not remembered
    expect(await firstValueFrom(store.select(queriesFeature.selectIds))).toEqual(['mascara']);
  });

  it('suggests past queries and title terms while typing', async () => {
    await type('mascara');
    await type('');
    const input = el().querySelector<HTMLInputElement>('input')!;
    input.focus();
    input.value = 'mas';
    input.dispatchEvent(new Event('input'));
    await settle();
    const options = Array.from(document.querySelectorAll('mat-option')).map((o) =>
      o.textContent!.trim(),
    );
    expect(options.some((o) => o.includes('mascara'))).toBe(true);
  });

  it('opens a dialog with title, description and image when a card is clicked', async () => {
    const card = el().querySelector<HTMLButtonElement>('app-product-card button')!;
    const title = card.querySelector('.title')!.textContent!.trim();
    card.click();
    await settle(50);
    const dialog = document.querySelector('app-product-dialog')!;
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector('h2')?.textContent).toContain(title);
    expect(dialog.querySelector('.description')?.textContent?.trim()).not.toBe('');
    expect(dialog.querySelector('img.hero')?.getAttribute('src')).toMatch(/^https:/);
  });

  it('toggles the theme from the header', async () => {
    el().querySelector<HTMLButtonElement>('.theme-toggle')!.click();
    await settle(10);
    expect(document.documentElement.classList.contains('light-theme')).toBe(true);
    expect(document.documentElement.classList.contains('dark-theme')).toBe(false);
  });
});
