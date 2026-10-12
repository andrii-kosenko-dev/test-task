import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { PRODUCTS_API_LATENCY_MS } from './core/api/fixture-products-api';
import { App } from './app';
import { appConfig } from './app.config';
import { SEARCH_DEBOUNCE_MS } from './store/products/products.effects';
import { DRAWINGS_STORAGE_KEY } from './store/drawings/drawings.storage';
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

  describe('polygon drawing', () => {
    const openFirstCard = async () => {
      el().querySelector<HTMLButtonElement>('app-product-card button')!.click();
      await settle(50);
      const dialog = document.querySelector('app-product-dialog')!;
      const img = dialog.querySelector<HTMLImageElement>('img.hero')!;
      Object.defineProperty(img, 'naturalWidth', { value: 600, configurable: true });
      Object.defineProperty(img, 'naturalHeight', { value: 400, configurable: true });
      img.dispatchEvent(new Event('load'));
      await settle(10);
      return dialog;
    };
    const closeDialog = async () => {
      document.querySelector<HTMLButtonElement>('app-product-dialog button.close')!.click();
      await settle(300);
    };
    const pointer = (canvas: Element, type: string, x: number, y: number) =>
      canvas.dispatchEvent(
        new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 }),
      );

    beforeEach(() => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 600,
        bottom: 400,
        x: 0,
        y: 0,
        width: 600,
        height: 400,
      } as DOMRect);
    });
    afterEach(() => vi.restoreAllMocks());

    it('keeps drawn polygons when the dialog is closed and reopened, and across reloads', async () => {
      let dialog = await openFirstCard();
      const canvas = dialog.querySelector('canvas')!;
      expect(canvas).not.toBeNull();

      // A freehand square outline in canvas pixels, ending back at its start.
      const outline = [
        [100, 100],
        [200, 100],
        [300, 100],
        [300, 200],
        [300, 300],
        [200, 300],
        [100, 300],
        [100, 200],
        [100, 100],
      ];
      pointer(canvas, 'pointerdown', ...(outline[0] as [number, number]));
      for (const [x, y] of outline.slice(1)) pointer(canvas, 'pointermove', x, y);
      pointer(canvas, 'pointerup', 100, 100);
      await settle(10);

      await closeDialog();
      expect(document.querySelector('app-product-dialog')).toBeNull();

      dialog = await openFirstCard();
      expect(dialog.querySelector('canvas')).not.toBeNull();

      const saved = JSON.parse(localStorage.getItem(DRAWINGS_STORAGE_KEY)!) as Record<
        string,
        unknown[]
      >;
      expect(Object.values(saved)[0]).toHaveLength(1);
    });
  });

  it('toggles the theme from the header', async () => {
    el().querySelector<HTMLButtonElement>('.theme-toggle')!.click();
    await settle(10);
    expect(document.documentElement.classList.contains('light-theme')).toBe(true);
    expect(document.documentElement.classList.contains('dark-theme')).toBe(false);
  });
});
