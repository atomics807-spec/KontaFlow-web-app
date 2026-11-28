# KontaFlow design system

KontaFlow is a bookkeeping product, so the interface has one job: make money
legible. The system is built from a small set of tokens, a compact component
kit, and motion that never competes with the numbers.

## Brand

- Tagline: "Intelligence behind every business decision."
- Impression: calm, confident, African fintech. Deep forest green as the
  anchor, jade for affirmative actions, mango for attention. No neon, no
  glassmorphism, no oversized decoration.
- Voice in UI copy: short declarative sentences, concrete amounts, no jargon.

## Colour tokens

Components must use semantic tokens, never raw palette values. Raw shades exist
only for brand surfaces (`bg-forest`) and decorative gradients.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `page` | `#f8f5ee` | `#071310` | App background |
| `page-soft` | `#f0ebdf` | `#0a1a15` | Footer, input disabled |
| `panel` | `#ffffff` | `#0f2019` | Cards, dialogs, menus |
| `panel-muted` | `#fbf9f4` | `#13261e` | Table headers, inset areas |
| `line` | `#e5dfd1` | `#22392f` | Default borders |
| `line-strong` | `#d6cebd` | `#2f4d3f` | Dashed empty states |
| `ink` | `#08140f` | `#e8f1eb` | Body text |
| `heading` | `#0a3327` | `#f3faf6` | Titles |
| `muted` | `#55675f` | `#9db3a7` | Secondary text, labels |
| `accent` | `#075e46` | `#7fd6b5` | Links, eyebrows, active nav |
| `accent-strong` | `#0b7a5a` | `#a6dcc7` | Focus, chart lines |
| `accent-soft` | `#eaf7f1` | `#143229` | Pills, icon chips |
| `accent-line` | `#cdeade` | `#23503f` | Chip borders |
| `danger` / `danger-soft` | `#b4453a` / `#f8e7e4` | `#ff9d90` / `#3a1d19` | Void, errors |
| `warn` / `warn-soft` | `#a86410` / `#fdf0d5` | `#f6c465` / `#33270f` | Expense, pending |
| `brand-soft` | `rgba(10,51,39,.07)` | `rgba(127,214,181,.12)` | Hover wash, grid lines |

Brand surfaces (`bg-forest`, `bg-forest-700`) stay fixed in both themes; white
text on them is intentional and contrast-checked.

The token values live in `src/app/globals.css` (`:root` and `.dark`). Tailwind
utilities are wired through `@theme inline`, which means `text-muted` resolves
`var(--kf-muted)` at runtime instead of being inlined as a literal. Do not
redeclare `--color-ink`, `--color-line` or `--color-muted` inside the plain
`@theme` block: the literal would win and dark mode would silently break.

## Typography

- Sans: Plus Jakarta Sans (400–800), `--font-sans`.
- Numerals: JetBrains Mono via `kpi-value` and `tnum`, tabular figures so
  columns of amounts never jitter.
- Scale: 2.55/3.75rem hero, 1.7rem page title, 1rem card title, 0.95rem body,
  0.8rem uppercase label (tracking `0.08em`), 0.7rem eyebrow (`0.16em`).
- Headings use `-0.02em` tracking and `text-balance` for marketing copy.

## Spacing, radius, elevation

- Base unit: 4px. Section rhythm: `py-20`/`py-24`; card padding `p-5`/`p-6`.
- Radius: cards `1.25rem` (`--radius-card`), controls `0.75rem`, pills full.
- Shadows: `--shadow-soft` (resting cards), `--shadow-lift` (menus, toasts),
  `--shadow-pop` (dialogs, hero frame). Avoid stacking more than one.

## Components (`src/components/ui`)

| Component | Notes |
| --- | --- |
| `button.tsx` | cva variants: primary, secondary, ghost, dark, danger, mango, link; sizes sm/md/lg/icon |
| `input.tsx` | `Input`, `Textarea`, `Select`, `Label`, `Field` with hint/error wiring |
| `card.tsx` | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` |
| `table.tsx` | `TableWrap` (horizontal scroll), `Table`, `Th` (headers on `panel-muted`), `Td` |
| `badge.tsx`, `alert.tsx` | tonal status surfaces using semantic tokens |
| `dialog.tsx` | native `<dialog>`; focus trap, Escape, backdrop click, `aria-labelledby` |
| `confirm-dialog.tsx` | destructive confirmation, accepts a server action |
| `drawer.tsx` | sheet panel for mobile navigation |
| `dropdown.tsx` | menu with Arrow/Home/End roving focus and outside-click dismissal |
| `toast.tsx` | `ToastProvider` + `useToast`, `aria-live="polite"`, 5.2s auto-dismiss |
| `tooltip.tsx` | CSS-only, hover + focus-within, `role="tooltip"` |
| `skeleton.tsx` | shimmering placeholders, animation disabled by reduced motion |
| `empty-state.tsx` | dashed surface, accent icon chip, optional action |

Rules: every interactive element is a real `button`/`a`/`select`; icon-only
controls carry `aria-label`; dialogs always have a title; toasts never carry the
only copy of a critical error (the inline alert stays).

## Theming

- Modes: `light`, `dark`, `system`; cookie `kontaflow_theme`, `localStorage`-free.
- `THEME_INIT_SCRIPT` runs in `<head>` before paint, so there is no flash and
  the server-rendered `class="dark"` state matches the client.
- `ThemeProvider` resolves `system` via `useSyncExternalStore` on
  `prefers-color-scheme` and writes `color-scheme` for native form controls.
- `ThemeToggle` is a three-state segmented control with tooltips; it appears in
  the marketing header, footer, dashboard sidebar and dashboard header.

## Motion

- `MotionProvider` sets `MotionConfig reducedMotion="user"`, so transforms and
  layout animations are dropped when the OS asks for stillness; opacity fades
  remain.
- `PageTransition` cross-fades dashboard route content (8px rise, 300ms).
- `Reveal` drives scroll-in sections with `whileInView` and `once: true`.
- Charts animate on mount only, and `isAnimationActive={!useReducedMotion()}`
  turns Recharts animation off for reduced-motion users.
- Toasts, the mobile menu and the success check use short opacity/transform
  animations. Nothing animates width, height or box-shadow, so low-end Android
  devices stay smooth.
- CSS fallback: `@media (prefers-reduced-motion: reduce)` collapses all
  animation and transition durations.

## Imagery

- All marketing art is original SVG in `public/illustrations/`, drawn with the
  brand palette: `hero-app.svg` (product), `bookkeeping.svg`, `reports.svg`,
  `ai-insights.svg`, `mobile-access.svg`.
- Images render through `next/image` with explicit `width`/`height`, `priority`
  on the hero and `loading="lazy"` below the fold. `unoptimized` is set because
  these are hand-authored SVGs: Next would pass them through unchanged anyway,
  and Cloudflare/OpenNext serves them as static assets.
- No stock photography. Illustrations use baked-in rounded corners and a dark
  forest canvas so they read on both themes.

## Charts

`useChartPalette()` returns concrete hex values per theme (Recharts cannot take
CSS variables for tick fills and gradients). Palette pairs: jade for income,
mango for expense; dashed `chart-grid`; tooltips use `panel`/`line`.

## Accessibility baseline

- Skip link in the locale layout, `main id="main"` on every page.
- `:focus-visible` ring uses `accent-strong`, 2px with 2px offset.
- Colour is never the only status signal: badges carry text, chart series carry
  a legend and an accessible data table in `figcaption`.
- Touch targets are at least 36×36px (40×40 for primary actions).
- Landmarks: `header`, `nav` with labels, `main`, `footer`, `section` with
  `aria-labelledby` where a heading exists.

## Low-literacy Easy Mode

`/{locale}/easy` is a separate visual density, not a new brand. It keeps the
same palette and type family but raises the floor:

- Primary actions use 56–64px heights and 64px keypad keys, with a 12-key number
  pad and a single primary action per step.
- Every action pairs an icon or picture with a short label. Colour is reinforced
  by arrows and words, never used alone.
- The shell hides the advanced sidebar on easy routes, so the user sees only the
  logo, language, sign-out and a way back to the full app.
- Amounts are shown at 32–60px; category choices use a two-column picture grid.
- Easy Mode is silent. It has no read-aloud, speech-recognition or microphone
  controls; all guidance is visual and text-based. Keep `microphone=()` in the
  Permissions-Policy unless a future reviewed feature explicitly needs it.
- Easy Mode uses the same `TransactionForm` submit path and offline outbox as the
  full app, so accessibility does not create a second financial code path.
