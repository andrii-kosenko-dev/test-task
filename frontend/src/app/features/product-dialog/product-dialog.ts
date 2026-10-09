import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import type { Product } from '../../core/models/product.model';

export interface ProductDialogData {
  readonly product: Product;
}

@Component({
  selector: 'app-product-dialog',
  imports: [CurrencyPipe, MatDialogTitle, MatDialogContent, MatIconButton],
  templateUrl: './product-dialog.html',
  styleUrl: './product-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDialog {
  private readonly dialogRef = inject<MatDialogRef<ProductDialog>>(MatDialogRef);
  protected readonly product = inject<ProductDialogData>(MAT_DIALOG_DATA).product;

  protected readonly images = this.product.images.length
    ? this.product.images
    : [this.product.thumbnail];
  protected readonly selectedIndex = signal(0);
  protected readonly current = computed(() => this.images[this.selectedIndex()]);
  protected readonly imageFailed = signal(false);

  protected select(index: number): void {
    this.selectedIndex.set(index);
    this.imageFailed.set(false);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
