import { BreakpointObserver } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { makeProduct } from '../../testing/product.factory';
import { ProductDialog } from './product-dialog';
import { ProductDialogService } from './product-dialog.service';

describe('ProductDialogService', () => {
  const setup = (handset: boolean) => {
    TestBed.configureTestingModule({
      providers: [{ provide: BreakpointObserver, useValue: { isMatched: () => handset } }],
    });
    const open = vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue(undefined as never);
    return { service: TestBed.inject(ProductDialogService), open };
  };

  it('opens the product dialog with the product as data', () => {
    const { service, open } = setup(false);
    const product = makeProduct(1);
    service.open(product);
    expect(open).toHaveBeenCalledWith(
      ProductDialog,
      expect.objectContaining({ data: { product } }),
    );
  });

  it('uses a centered, bounded dialog on larger screens', () => {
    const { service, open } = setup(false);
    service.open(makeProduct(1));
    const config = open.mock.calls[0][1]!;
    expect(config.width).toMatch(/min\(/);
    expect(config.panelClass).not.toContain('fullscreen-dialog');
  });

  it('goes full-screen on mobile', () => {
    const { service, open } = setup(true);
    service.open(makeProduct(1));
    const config = open.mock.calls[0][1]!;
    expect(config).toMatchObject({ width: '100vw', maxWidth: '100vw', height: '100dvh' });
    expect(config.panelClass).toContain('fullscreen-dialog');
  });
});
