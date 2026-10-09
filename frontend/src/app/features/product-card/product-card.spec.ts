import { ComponentFixture, TestBed } from '@angular/core/testing';
import { makeProduct } from '../../testing/product.factory';
import { ProductCard } from './product-card';

describe('ProductCard', () => {
  let fixture: ComponentFixture<ProductCard>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProductCard] }).compileComponents();
    fixture = TestBed.createComponent(ProductCard);
    fixture.componentRef.setInput(
      'product',
      makeProduct(7, { title: 'Red Lipstick', price: 12.5 }),
    );
    await fixture.whenStable();
  });

  it('shows title, description, category and price', () => {
    expect(el().querySelector('.title')?.textContent).toContain('Red Lipstick');
    expect(el().querySelector('.description')?.textContent).toContain('Description of product 7');
    expect(el().querySelector('.category')?.textContent).toContain('beauty');
    expect(el().querySelector('.price')?.textContent).toContain('$12.50');
  });

  it('shows the miniature (thumbnail) lazily loaded', () => {
    const img = el().querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://cdn.test/7/thumb.webp');
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('is a single focusable button so the whole card is clickable by keyboard', () => {
    const buttons = el().querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('emits the product when clicked', () => {
    const emitted: unknown[] = [];
    fixture.componentInstance.selected.subscribe((p) => emitted.push(p));
    el().querySelector('button')!.click();
    expect(emitted).toEqual([expect.objectContaining({ id: 7 })]);
  });

  it('falls back to a placeholder when the thumbnail fails to load', async () => {
    el().querySelector('img')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(el().querySelector('img')).toBeNull();
    expect(el().querySelector('.placeholder')).not.toBeNull();
  });
});
