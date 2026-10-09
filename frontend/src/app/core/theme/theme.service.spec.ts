import { TestBed } from '@angular/core/testing';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  const create = () => TestBed.inject(ThemeService);

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.style.colorScheme = '';
  });

  it('defaults to dark', () => {
    expect(create().theme()).toBe('dark');
  });

  it('applies the theme to <html>', () => {
    const service = create();
    TestBed.tick();
    expect(document.documentElement.classList.contains('dark-theme')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    service.toggle();
    TestBed.tick();
    expect(document.documentElement.classList.contains('light-theme')).toBe(true);
    expect(document.documentElement.classList.contains('dark-theme')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('toggles between dark and light', () => {
    const service = create();
    service.toggle();
    expect(service.theme()).toBe('light');
    service.toggle();
    expect(service.theme()).toBe('dark');
  });

  it('persists the choice', () => {
    const service = create();
    service.toggle();
    TestBed.tick();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('restores a stored choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(create().theme()).toBe('light');
  });

  it('ignores an invalid stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(create().theme()).toBe('dark');
  });

  it('still works when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const service = create();
    expect(service.theme()).toBe('dark');
    expect(() => {
      service.toggle();
      TestBed.tick();
    }).not.toThrow();
    vi.restoreAllMocks();
  });
});
