import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { makeProduct } from '../../testing/product.factory';
import { ProductDialog } from './product-dialog';

describe('ProductDialog', () => {
  let fixture: ComponentFixture<ProductDialog>;
  const close = vi.fn();
  const el = () => fixture.nativeElement as HTMLElement;

  const create = async (
    product = makeProduct(3, { title: 'Desk Lamp', description: 'Bright and warm.' }),
  ) => {
    TestBed.configureTestingModule({
      imports: [ProductDialog],
      providers: [
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
});
