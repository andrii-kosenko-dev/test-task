import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import type { Polygon } from '../../core/drawing/polygon.model';
import { DrawingsActions } from '../../store/drawings/drawings.actions';
import { drawingKey } from '../../store/drawings/drawings.reducer';
import { makeProduct } from '../../testing/product.factory';
import { PolygonCanvas } from '../polygon-canvas/polygon-canvas';
import { ProductDialog } from './product-dialog';

const tri = (id: string): Polygon => ({
  id,
  points: [
    { x: 0.1, y: 0.1 },
    { x: 0.3, y: 0.1 },
    { x: 0.2, y: 0.3 },
  ],
});

describe('ProductDialog', () => {
  let fixture: ComponentFixture<ProductDialog>;
  const close = vi.fn();
  const el = () => fixture.nativeElement as HTMLElement;

  const create = async (
    product = makeProduct(3, { title: 'Desk Lamp', description: 'Bright and warm.' }),
    byImage: Record<string, readonly Polygon[]> = {},
  ) => {
    TestBed.configureTestingModule({
      imports: [ProductDialog],
      providers: [
        provideMockStore({ initialState: { drawings: { byImage } } }),
        { provide: MAT_DIALOG_DATA, useValue: { product } },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    fixture = TestBed.createComponent(ProductDialog);
    await fixture.whenStable();
  };

  beforeEach(() => close.mockClear());

  it('shows title, description and the large image', async () => {
    await create();
    expect(el().querySelector('h2')?.textContent).toContain('Desk Lamp');
    expect(el().querySelector('.description')?.textContent).toContain('Bright and warm.');
    const hero = el().querySelector<HTMLImageElement>('img.hero')!;
    expect(hero.getAttribute('src')).toBe('https://cdn.test/3/1.webp');
    expect(hero.getAttribute('alt')).toBe('Desk Lamp');
  });

  it('shows category, brand and price', async () => {
    await create();
    expect(el().textContent).toContain('beauty');
    expect(el().textContent).toContain('Acme');
    expect(el().textContent).toContain('$9.99');
  });

  it('lets the user switch between gallery images', async () => {
    await create();
    const thumbs = el().querySelectorAll<HTMLButtonElement>('.gallery button');
    expect(thumbs).toHaveLength(2);
    thumbs[1].click();
    await fixture.whenStable();
    expect(el().querySelector('img.hero')?.getAttribute('src')).toBe('https://cdn.test/3/2.webp');
    expect(thumbs[1].getAttribute('aria-current')).toBe('true');
  });

  it('hides the gallery when there is a single image', async () => {
    await create(makeProduct(4, { images: ['https://cdn.test/4/1.webp'] }));
    expect(el().querySelector('.gallery')).toBeNull();
  });

  it('falls back to the thumbnail when there are no images', async () => {
    await create(makeProduct(5, { images: [] }));
    expect(el().querySelector('img.hero')?.getAttribute('src')).toBe(
      'https://cdn.test/5/thumb.webp',
    );
  });

  it('shows a placeholder if the image fails to load', async () => {
    await create();
    el().querySelector('img.hero')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(el().querySelector('img.hero')).toBeNull();
    expect(el().querySelector('.placeholder')).not.toBeNull();
  });

  it('closes via the close button', async () => {
    await create();
    el().querySelector<HTMLButtonElement>('button.close')!.click();
    expect(close).toHaveBeenCalled();
  });

  describe('drawing', () => {
    const loadImage = async (width = 600, height = 400) => {
      const img = el().querySelector<HTMLImageElement>('img.hero')!;
      Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
      Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
      img.dispatchEvent(new Event('load'));
      await fixture.whenStable();
    };
    const canvasHost = () => fixture.debugElement.query(By.directive(PolygonCanvas));

    it('offers no canvas until the image has loaded', async () => {
      await create();
      expect(canvasHost()).toBeNull();
      await loadImage();
      expect(canvasHost()).not.toBeNull();
    });

    it('gives the canvas the image aspect ratio', async () => {
      await create();
      await loadImage(600, 400);
      expect(canvasHost().componentInstance.aspect()).toBeCloseTo(1.5);
    });

    it('does not show a canvas for an image with no size', async () => {
      await create();
      await loadImage(0, 0);
      expect(canvasHost()).toBeNull();
    });

    it('passes the stored polygons of the current image', async () => {
      const product = makeProduct(3);
      await create(product, { [drawingKey(3, product.images[0])]: [tri('a')] });
      await loadImage();
      expect(canvasHost().componentInstance.polygons()).toEqual([tri('a')]);
    });

    it('keeps polygons separate per gallery image', async () => {
      const product = makeProduct(3);
      await create(product, { [drawingKey(3, product.images[1])]: [tri('b')] });
      await loadImage();
      expect(canvasHost().componentInstance.polygons()).toEqual([]);

      el().querySelectorAll<HTMLButtonElement>('.gallery button')[1].click();
      await fixture.whenStable();
      await loadImage();
      expect(canvasHost().componentInstance.polygons()).toEqual([tri('b')]);
    });

    it('saves changes to the store under the image key', async () => {
      const product = makeProduct(3);
      await create(product);
      const dispatch = vi.spyOn(TestBed.inject(MockStore), 'dispatch');
      await loadImage();
      canvasHost().componentInstance.polygonsChange.emit([tri('a')]);
      expect(dispatch).toHaveBeenCalledWith(
        DrawingsActions.polygonsChanged({
          key: drawingKey(3, product.images[0]),
          polygons: [tri('a')],
        }),
      );
    });

    it('drops the canvas when the image fails to load', async () => {
      await create();
      await loadImage();
      el().querySelector('img.hero')!.dispatchEvent(new Event('error'));
      await fixture.whenStable();
      expect(canvasHost()).toBeNull();
    });
  });
});
