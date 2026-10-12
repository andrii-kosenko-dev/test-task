import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import type { Polygon } from '../../core/drawing/polygon.model';
import type { Product } from '../../core/models/product.model';
import { DrawingsActions } from '../../store/drawings/drawings.actions';
import { drawingKey, drawingsFeature } from '../../store/drawings/drawings.reducer';
import { PolygonCanvas } from '../polygon-canvas/polygon-canvas';

const NO_POLYGONS: readonly Polygon[] = [];

export interface ProductDialogData {
  readonly product: Product;
}

@Component({
  selector: 'app-product-dialog',
  imports: [CurrencyPipe, MatDialogTitle, MatDialogContent, MatIconButton, PolygonCanvas],
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

  private readonly store = inject(Store);
  private readonly drawings = this.store.selectSignal(drawingsFeature.selectByImage);
  /** Natural width ÷ height of the displayed image; null until it has loaded. */
  protected readonly aspect = signal<number | null>(null);
  private readonly drawingKey = computed(() => drawingKey(this.product.id, this.current()));
  protected readonly polygons = computed(() => this.drawings()[this.drawingKey()] ?? NO_POLYGONS);

  protected select(index: number): void {
    this.selectedIndex.set(index);
    this.imageFailed.set(false);
    this.aspect.set(null);
  }

  protected onImageLoad(img: HTMLImageElement): void {
    const { naturalWidth, naturalHeight } = img;
    this.aspect.set(naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : null);
  }

  protected onImageError(): void {
    this.imageFailed.set(true);
    this.aspect.set(null);
  }

  protected savePolygons(polygons: readonly Polygon[]): void {
    this.store.dispatch(DrawingsActions.polygonsChanged({ key: this.drawingKey(), polygons }));
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
