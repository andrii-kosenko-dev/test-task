import { BreakpointObserver } from '@angular/cdk/layout';
import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import type { Product } from '../../core/models/product.model';
import { ProductDialog, type ProductDialogData } from './product-dialog';

const HANDSET_QUERY = '(max-width: 599.98px)';

@Injectable({ providedIn: 'root' })
export class ProductDialogService {
  private readonly dialog = inject(MatDialog);
  private readonly breakpoints = inject(BreakpointObserver);

  open(product: Product): void {
    const base = {
      data: { product } satisfies ProductDialogData,
      autoFocus: 'dialog' as const,
      restoreFocus: true,
    };

    if (this.breakpoints.isMatched(HANDSET_QUERY)) {
      this.dialog.open(ProductDialog, {
        ...base,
        width: '100vw',
        maxWidth: '100vw',
        height: '100dvh',
        maxHeight: '100dvh',
        panelClass: 'fullscreen-dialog',
      });
    } else {
      this.dialog.open(ProductDialog, {
        ...base,
        width: 'min(60rem, 92vw)',
        maxWidth: '92vw',
        panelClass: 'product-dialog',
      });
    }
  }
}
