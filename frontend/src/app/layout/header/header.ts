import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-header',
  imports: [MatIconButton],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  private readonly themeService = inject(ThemeService);

  protected readonly isDark = computed(() => this.themeService.theme() === 'dark');
  protected readonly label = computed(() => `Switch to ${this.isDark() ? 'light' : 'dark'} theme`);

  protected toggle(): void {
    this.themeService.toggle();
  }
}
