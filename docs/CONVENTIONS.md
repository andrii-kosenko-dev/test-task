# Conventions

- **Components:** standalone, `ChangeDetectionStrategy.OnPush`, `inject()` for DI, signals for state, `input()` / `output()`, new control flow (`@if`, `@for` with `track`). Separate `.ts`, `.html` and `.scss` files unless a template is tiny.
- **State:** NgRx for app state (`createFeature`, `createActionGroup`, entity adapter). Components read with `selectSignal` and dispatch actions. Local UI state (selected gallery image, image-failed flags) stays in component signals.
- **Types:** strict TypeScript, no `any`. Models are `readonly`.
- **Naming:** files are kebab-case. A component class has no `Component` suffix (`ProductCard`). Specs are `<name>.spec.ts`.
- **Styling:** SCSS, mobile-first (`min-width` queries), Material system tokens (`--mat-sys-*`), `rem` units except for the fixed virtual-scroll row height. Icons are inline SVG, so there is no icon-font dependency.
- **Formatting:** Prettier (`printWidth` 100, single quotes). Lint with `npm run lint`.
- **Commits:** conventional commits, one coherent change each, tests included.
- **Docs:** update `AGENTS.md` and `docs/` when behavior, commands or structure change.
