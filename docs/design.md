# NAH Design System

> Visual design system for New Again Houses apps. Source of truth for colors, typography, components, and visual language. Share this doc with any sibling app at NAH so the brand feels unified across products.

Pulled from this repo's [tailwind.config.ts](../tailwind.config.ts) and [app/globals.css](../app/globals.css). If those files diverge from this doc, update this doc.

---

## Brand identity

| Item            | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| Primary color   | NAH Blue `#00a1e1`                                                 |
| Accent color    | NAH Yellow `#f5a800`                                               |
| Headline font   | Signika (Google Fonts)                                             |
| Body font       | Roboto (Google Fonts)                                              |
| Mono font       | JetBrains Mono → Fira Code → Courier New                           |
| Visual language | Glassmorphism (translucent white, 8px backdrop blur, soft shadows) |
| Background tone | Soft cool gray `#f4f7f8` (not pure white)                          |

Both fonts loaded via Google Fonts:

```
https://fonts.googleapis.com/css2?family=Signika:wght@300;400;500;600;700&family=Roboto:wght@300;400;500;700&display=swap
```

---

## Color palette

### Brand

| Token                 | Hex       | Usage                                         |
| --------------------- | --------- | --------------------------------------------- |
| `nah-blue`            | `#00a1e1` | Primary actions, links, focus rings, Scout AI |
| `nah-blue-hover`      | `#0090ca` | Hover state for primary blue                  |
| `nah-blue-active`     | `#0080b5` | Pressed/active state                          |
| `nah-blue-light`      | `#e6f7fd` | Tinted backgrounds, badges, pills             |
| `nah-blue-mid`        | `#b3e4f7` | Subtle dividers, decorative                   |
| `accent-yellow`       | `#f5a800` | Highlighted CTAs, "hot" lead state, warnings  |
| `accent-yellow-hover` | `#e09700` | Hover for accent                              |
| `accent-yellow-light` | `#fef3e2` | Tinted yellow backgrounds                     |
| `brand-gray`          | `#898a8d` | Brand-defined neutral                         |

### Surface & background

| Token           | Value                    | Usage                             |
| --------------- | ------------------------ | --------------------------------- |
| `bg-primary`    | `#f4f7f8`                | App background (default page)     |
| `bg-secondary`  | `rgba(255,255,255,0.75)` | Translucent surface (glass cards) |
| `bg-tertiary`   | `#f1f5f9`                | Hover/inactive areas              |
| `bg-hover`      | `rgba(0,161,225,0.05)`   | Row/cell hover tint               |
| `bg-active`     | `rgba(0,161,225,0.10)`   | Pressed/selected tint             |
| `surface-glass` | `rgba(255,255,255,0.75)` | Glass card body                   |
| `surface-solid` | `#ffffff`                | Modal/elevated surfaces           |

### Text

| Token            | Hex       | Usage                                  |
| ---------------- | --------- | -------------------------------------- |
| `text-primary`   | `#1e293b` | Body, headings                         |
| `text-secondary` | `#64748b` | Captions, metadata                     |
| `text-tertiary`  | `#94a3b8` | Placeholder, disabled                  |
| `text-inverse`   | `#ffffff` | Text on filled buttons / dark surfaces |

### Semantic

| Token     | Hex       | Usage                            |
| --------- | --------- | -------------------------------- |
| `success` | `#059669` | Confirmations, "completed"       |
| `warning` | `#f5a800` | Cautions (matches yellow accent) |
| `danger`  | `#ef4444` | Errors, destructive actions      |
| `info`    | `#00a1e1` | Informational (matches NAH blue) |

### Borders

| Token            | Value                   |
| ---------------- | ----------------------- |
| `border-default` | `rgba(0,0,0,0.06)`      |
| `border-hover`   | `rgba(0,0,0,0.12)`      |
| `border-focus`   | `#00a1e1`               |
| `border-glass`   | `rgba(255,255,255,0.6)` |

---

## Typography

Two-font system: **Signika for headlines, Roboto for body**.

### Type scale

| Token           | Size             | Weight | Line height | Letter spacing | Usage                       |
| --------------- | ---------------- | ------ | ----------- | -------------- | --------------------------- |
| `hero`          | 3.5rem (56px)    | 600    | 1.2         | -1px           | Landing page hero           |
| `page-title`    | 2rem (32px)      | 600    | 1.25        | -0.5px         | Top of every page           |
| `section-title` | 1.5rem (24px)    | 600    | 1.3         | –              | Card group / section header |
| `card-title`    | 1.125rem (18px)  | 600    | 1.4         | –              | Individual card title       |
| `subtitle`      | 1.25rem (20px)   | 400    | 1.5         | –              | Page subtitle/lede          |
| `body-lg`       | 1rem (16px)      | 400    | 1.5         | –              | Body, comfortable read      |
| `body`          | 0.875rem (14px)  | 400    | 1.5         | –              | Default body in app UI      |
| `body-sm`       | 0.8125rem (13px) | 400    | 1.5         | –              | Compact rows, dense tables  |
| `caption`       | 0.8125rem (13px) | 400    | 1.4         | –              | Secondary metadata          |
| `label-caps`    | 0.75rem (12px)   | 700    | 1.2         | 1.2px          | UPPERCASE labels            |
| `overline`      | 0.75rem (12px)   | 700    | 1.2         | 1.2px          | Group header above cards    |
| `metric`        | 2rem (32px)      | 700    | 1.1         | –              | Big number on metric card   |
| `metric-sm`     | 1.25rem (20px)   | 600    | 1.2         | –              | Compact metric              |
| `nav`           | 0.9375rem (15px) | 500    | 1.0         | –              | Sidebar nav item            |
| `button`        | 0.875rem (14px)  | 500    | 1.0         | –              | Button label                |
| `badge`         | 0.75rem (12px)   | 600    | 1.0         | 0.3px          | Pill/chip text              |

### Heading rule

All `h1`–`h6` automatically use Signika. Body, buttons, badges, inputs use Roboto.

---

## Spacing, radii, shadow

### Border radius

| Token  | Value | Usage                         |
| ------ | ----- | ----------------------------- |
| `sm`   | 4px   | Tight elements (tags)         |
| `md`   | 8px   | Default — inputs, small cards |
| `lg`   | 12px  | Buttons, mid cards            |
| `xl`   | 16px  | Main card surfaces            |
| `pill` | 40px  | Pills, chips, prompt chips    |

### Shadow

- Default card: `0 4px 20px rgba(0, 0, 0, 0.03)` — very soft, low-contrast
- FAB (Scout): `0 4px 20px rgba(0, 161, 225, 0.4)` (uses brand blue for color spill)
- FAB hover: `0 6px 28px rgba(0, 161, 225, 0.5)` plus `scale(1.08)`

### Backdrop blur

Glass surfaces use `backdrop-filter: blur(8px)`. Heavy variant uses `blur(24px)` (modals, sidebars).

### Layout

| Token             | Value                                |
| ----------------- | ------------------------------------ |
| Sidebar collapsed | 80px                                 |
| Sidebar expanded  | 280px                                |
| Max content width | 1280px                               |
| Topbar height     | 0px (no topbar — full-bleed content) |

---

## Component patterns

### Buttons

```
.btn-primary    → NAH blue background, white text. Default CTA.
.btn-secondary  → glass white, dark text, subtle border. Cancel/dismiss.
.btn-accent     → yellow background, white text. Highlighted CTAs.
.btn-ghost      → no background, text-secondary color, hover tints.
```

All buttons:

- Roboto, 14px, font-weight 500
- Padding: `px-5 py-2.5` (20px × 10px)
- Radius `lg` (12px)
- `active:scale-[0.98]` micro-press feedback
- Transitions: 150ms

### Cards

```
.card           → 75% white background, 16px radius, 24px padding, 8px blur, soft shadow.
.card-glass     → identical look, used as a class fragment.
.card-glass-heavy → 55% white, 24px blur — for elevated/floating surfaces.
```

### Inputs

```
.input       → 75% white, 8px radius, focus ring 3px @ 12% blue opacity.
.input-pill  → same surface, 50px radius, used for search and Scout chat.
.prompt-chip → 40px radius, 75% white, hover tints blue.
```

Input focus ring: `box-shadow: 0 0 0 3px rgba(0, 161, 225, 0.12)`.

### Badges (10 variants)

| Class                          | Background         | Text      |
| ------------------------------ | ------------------ | --------- |
| `badge-hot`                    | `#f5a800` (yellow) | white     |
| `badge-warm`                   | `#fef3e2`          | `#f5a800` |
| `badge-cool`                   | `#e6f7fd`          | `#00a1e1` |
| `badge-cold`                   | `#f1f5f9`          | `#898a8d` |
| `badge-success`                | `#dcfce7`          | `#059669` |
| `badge-warning`                | `#fef3e2`          | `#f5a800` |
| `badge-error` / `badge-danger` | `#fee2e2`          | `#ef4444` |
| `badge-info`                   | `#e6f7fd`          | `#00a1e1` |
| `badge-neutral`                | `#f1f5f9`          | `#64748b` |

Shape: pill (40px radius), 12px text, weight 600, 0.3px letter-spacing.

### Stage pills

For pipeline/status displays — `stage-pill` is a light-blue rounded chip (`#e6f7fd` bg, `#00a1e1` text, 20px radius, 12px text).

### Metric card icon backgrounds

- `metric-icon-blue` → `#e6f7fd` bg, `#00a1e1` icon
- `metric-icon-yellow` → `#fef3e2` bg, `#f5a800` icon
- `metric-icon-green` → `#dcfce7` bg, `#059669` icon
- `metric-icon-gray` → `#f1f5f9` bg, `#64748b` icon

### Data tables

- Header: 12px uppercase, weight 700, 1px letter-spacing, secondary text color
- Alternating row tint: odd `rgba(255,255,255,0.6)`, even `rgba(244,247,248,0.8)`
- Row hover: `rgba(0, 161, 225, 0.05)` (light blue tint)
- Header is sticky, blurred white background

### Tabs

- Bottom-border style (not pill tabs)
- Active tab: NAH blue text + 2px blue underline
- Hover: NAH blue text only

### Empty state

- Vertically centered, 48px×24px padding
- Icon at 48px, NAH blue at 40% opacity
- Title: Signika 18px / 600
- Body: Roboto 14px / secondary text

---

## Aesthetic principles

1. **Glass everywhere.** Surfaces sit on the page as translucent panes (75% white + 8px blur) rather than opaque cards. The cool-gray page background `#f4f7f8` shows through.
2. **Soft shadows, soft borders.** No hard 1px black lines or harsh dropshadows. Default border is `rgba(0,0,0,0.06)`, default shadow is barely visible (`0.03` alpha).
3. **NAH blue as the only "color of interaction."** Hover tints, focus rings, links, active tabs, primary buttons — all blue. Yellow is the second voice, reserved for highlighted or hot states.
4. **Two-font hierarchy.** Signika for any heading. Roboto for everything else. Don't mix in additional families.
5. **Compact density.** App default body is 14px (Tailwind `text-body`), not 16px. Tables and lists go denser.
6. **Subtle motion.** 150ms transitions, 0.98 active-scale on press, 1.08 scale on FAB hover. No bouncy/elastic easings.
7. **Light mode only (for now).** No dark mode variants in tokens. Background is always the cool gray, never white.

---

## Reusing this system in a sibling app

Minimum to match the visual language:

1. **Load the same fonts** — Signika + Roboto via Google Fonts.
2. **Copy the color tokens** in this doc into your Tailwind config (or CSS vars).
3. **Use `bg: #f4f7f8`** for the page, not white.
4. **Make headings Signika** via a global `h1–h6 { font-family: Signika }` rule.
5. **Build cards as glass** — 75% white, 16px radius, 8px backdrop blur, soft shadow.
6. **Primary CTA = NAH blue.** Yellow is for emphasis, not for primary actions.
7. **Use 14px Roboto as default body**, not 16px.

If the sibling app needs the same React components, the patterns are implemented as Tailwind component classes in [app/globals.css](../app/globals.css) — they can be copied verbatim, no React/Tailwind plugins required beyond `@tailwindcss/typography`.
