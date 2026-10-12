import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { ThemeService } from '../../core/theme/theme.service';
import type { Point } from '../../core/drawing/geometry';
import { PolygonEditor } from '../../core/drawing/polygon-editor';
import type { Polygon } from '../../core/drawing/polygon.model';

const NUDGE = 0.01;
const NUDGE_BIG = 0.05;
const ROTATE_STEP = (5 * Math.PI) / 180;
const HANDLE_RADIUS_PX = 9;

interface Palette {
  readonly accent: string;
  readonly onAccent: string;
}

/**
 * Transparent canvas laid over an image's displayed area. Polygons live in image units
 * (fraction of image width), so they scale with the image whatever the viewport does.
 * The component is a thin shell: all gesture logic is in `PolygonEditor`.
 */
@Component({
  selector: 'app-polygon-canvas',
  imports: [MatIconButton],
  templateUrl: './polygon-canvas.html',
  styleUrl: './polygon-canvas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolygonCanvas {
  /** Natural image width ÷ height. */
  readonly aspect = input.required<number>();
  readonly polygons = input<readonly Polygon[]>([]);
  readonly polygonsChange = output<readonly Polygon[]>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly theme = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);
  private dragging = false;

  /** Bumped after every editor mutation, because the editor is not signal-based. */
  private readonly version = signal(0);
  private readonly hostSize = signal({ width: 0, height: 0 });
  protected readonly cursor = signal('crosshair');

  private readonly editor = computed(
    () => new PolygonEditor({ width: 1, height: 1 / this.aspect() }),
  );

  /** The image is letterboxed inside the stage (object-fit: contain); fit the canvas to it. */
  protected readonly box = computed(() => {
    const { width: w, height: h } = this.hostSize();
    const aspect = this.aspect();
    return w / h > aspect ? { width: h * aspect, height: h } : { width: w, height: w / aspect };
  });

  protected readonly hasSelection = computed(() => {
    this.version();
    return this.editor().selectedId !== null;
  });

  constructor() {
    // Adopt polygons that changed outside (another image, a store update from elsewhere).
    effect(() => {
      const incoming = this.polygons();
      const editor = this.editor();
      if (editor.polygons !== incoming) {
        editor.setPolygons(incoming);
        this.version.update((v) => v + 1);
      }
    });

    effect(() => {
      this.version();
      this.theme.theme();
      const { width, height } = this.box();
      this.draw(width, height);
    });

    afterNextRender(() => {
      this.measure();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.measure());
      observer.observe(this.host);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    const canvas = this.canvasRef().nativeElement;
    canvas.setPointerCapture?.(e.pointerId);
    const editor = this.editor();
    editor.setScale(this.pixelsPerUnit());
    editor.pointerDown(this.toUnits(e));
    this.dragging = true;
    this.version.update((v) => v + 1);
  }

  protected onPointerMove(e: PointerEvent): void {
    const editor = this.editor();
    editor.setScale(this.pixelsPerUnit());
    const point = this.toUnits(e);
    if (this.dragging) {
      editor.pointerMove(point);
      this.version.update((v) => v + 1);
    } else {
      const hit = editor.hitTest(point);
      this.cursor.set(hit === 'rotate' ? 'grab' : hit === 'move' ? 'move' : 'crosshair');
    }
  }

  protected onPointerUp(e: PointerEvent): void {
    if (!this.dragging) return;
    const editor = this.editor();
    editor.pointerMove(this.toUnits(e));
    this.dragging = false;
    this.commit(editor.pointerUp());
  }

  protected onPointerCancel(): void {
    this.editor().cancel();
    this.dragging = false;
    this.version.update((v) => v + 1);
  }

  protected onKeydown(e: KeyboardEvent): void {
    const editor = this.editor();
    const step = e.shiftKey ? NUDGE_BIG : NUDGE;
    let changed = false;
    switch (e.key) {
      case 'Enter':
        editor.selectNext();
        this.version.update((v) => v + 1);
        break;
      case 'Delete':
      case 'Backspace':
        changed = editor.deleteSelected();
        break;
      case 'ArrowLeft':
        changed = editor.nudge(-step, 0);
        break;
      case 'ArrowRight':
        changed = editor.nudge(step, 0);
        break;
      case 'ArrowUp':
        changed = editor.nudge(0, -step);
        break;
      case 'ArrowDown':
        changed = editor.nudge(0, step);
        break;
      case '[':
        changed = editor.rotateSelected(-ROTATE_STEP);
        break;
      case ']':
        changed = editor.rotateSelected(ROTATE_STEP);
        break;
      case 'Escape':
        editor.cancel();
        this.dragging = false;
        this.version.update((v) => v + 1);
        return;
      default:
        return;
    }
    e.preventDefault();
    this.commit(changed);
  }

  protected deleteSelected(): void {
    this.commit(this.editor().deleteSelected());
  }

  private commit(changed: boolean): void {
    this.version.update((v) => v + 1);
    if (changed) this.polygonsChange.emit(this.editor().polygons);
  }

  private measure(): void {
    const { width, height } = this.host.getBoundingClientRect();
    this.hostSize.set({ width, height });
  }

  private pixelsPerUnit(): number {
    return this.canvasRef().nativeElement.getBoundingClientRect().width || 1;
  }

  private toUnits(e: PointerEvent): Point {
    const rect = this.canvasRef().nativeElement.getBoundingClientRect();
    const scale = rect.width || 1;
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  }

  private palette(canvas: HTMLCanvasElement): Palette {
    // Canvas cannot resolve `light-dark()` custom properties, but computed `color` values can.
    const style = getComputedStyle(canvas);
    return { accent: style.color || '#6750a4', onAccent: style.borderTopColor || '#ffffff' };
  }

  private draw(cssWidth: number, cssHeight: number): void {
    const canvas = this.canvasRef().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx || cssWidth <= 0 || cssHeight <= 0) return;

    const dpr = globalThis.devicePixelRatio || 1;
    const bitmapWidth = Math.round(cssWidth * dpr);
    const bitmapHeight = Math.round(cssHeight * dpr);
    if (canvas.width !== bitmapWidth) canvas.width = bitmapWidth;
    if (canvas.height !== bitmapHeight) canvas.height = bitmapHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const editor = this.editor();
    const { accent, onAccent } = this.palette(canvas);
    const px = (p: Point): [number, number] => [p.x * cssWidth, p.y * cssWidth];
    const trace = (points: readonly Point[], close: boolean) => {
      ctx.beginPath();
      points.forEach((p, i) => (i === 0 ? ctx.moveTo(...px(p)) : ctx.lineTo(...px(p))));
      if (close) ctx.closePath();
    };

    ctx.lineJoin = 'round';
    for (const polygon of editor.polygons) {
      const selected = polygon.id === editor.selectedId;
      trace(polygon.points, true);
      ctx.globalAlpha = selected ? 0.35 : 0.2;
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = selected ? 3 : 2;
      ctx.strokeStyle = onAccent;
      ctx.stroke();
      ctx.lineWidth = selected ? 1.5 : 1;
      ctx.strokeStyle = accent;
      ctx.stroke();
    }

    if (editor.draft.length > 1) {
      trace(editor.draft, false);
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = accent;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const handle = editor.handlePosition();
    const selected = editor.polygons.find((p) => p.id === editor.selectedId);
    if (handle && selected) {
      const [hx, hy] = px(handle);
      ctx.beginPath();
      ctx.arc(hx, hy, HANDLE_RADIUS_PX, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = onAccent;
      ctx.stroke();
    }
  }
}
