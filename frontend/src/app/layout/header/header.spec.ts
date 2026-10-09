import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemeService } from '../../core/theme/theme.service';
import { Header } from './header';

describe('Header', () => {
  let fixture: ComponentFixture<Header>;
  let el: HTMLElement;
  let theme: ThemeService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [Header] }).compileComponents();
    theme = TestBed.inject(ThemeService);
    fixture = TestBed.createComponent(Header);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  const toggle = () => el.querySelector<HTMLButtonElement>('button.theme-toggle')!;

  it('shows the app title', () => {
    expect(el.querySelector('.brand')?.textContent).toContain('Product Search');
  });

  it('renders the theme toggle after the title (top-right slot)', () => {
    const children = Array.from(el.querySelector('header')!.children);
    expect(children.indexOf(toggle())).toBeGreaterThan(
      children.indexOf(el.querySelector('.brand')!),
    );
  });

  it('offers to switch to light while in the default dark theme', () => {
    expect(toggle().getAttribute('aria-label')).toBe('Switch to light theme');
  });

  it('toggles the theme on click and updates the label', async () => {
    toggle().click();
    await fixture.whenStable();
    expect(theme.theme()).toBe('light');
    expect(toggle().getAttribute('aria-label')).toBe('Switch to dark theme');
  });

  it('exposes the pressed state for assistive tech', async () => {
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    toggle().click();
    await fixture.whenStable();
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
  });
});
