---
name: Aura Commerce
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45474a'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777b'
  outline-variant: '#c6c6ca'
  surface-tint: '#5e5e61'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1c1e'
  on-primary-container: '#848386'
  inverse-primary: '#c7c6c9'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#40000d'
  on-tertiary-container: '#f23d5c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e3e2e5'
  primary-fixed-dim: '#c7c6c9'
  on-primary-fixed: '#1b1c1e'
  on-primary-fixed-variant: '#464749'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#ffdadb'
  tertiary-fixed-dim: '#ffb2b7'
  on-tertiary-fixed: '#40000d'
  on-tertiary-fixed-variant: '#92002a'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 56px
    fontWeight: '800'
    lineHeight: 64px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 0.75rem
  margin: 3rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style
The design system embodies a modern, frictionless consumer commerce experience where products take center stage. The aesthetic balances architectural minimalism with warm, tactile editorial precision. The visual voice is direct, serene, and confident—eliminating non-essential decoration to induce focused decision-making and effortless checkout flows. 

Targeted at discerning modern consumers who appreciate design clarity, speed, and premium craftsmanship, the system avoids generic marketplace clutter. It relies on decisive typography, sharp contrast ratios, and generous negative space to cultivate immediate trust, product desirability, and cognitive ease.

## Colors
The palette leverages a pristine light slate foundation paired with deep carbon black for high-impact structural hierarchy and primary conversion actions.

- **Primary (`#090A0C`):** Deep carbon black. Reserved for core typography, structural headers, high-conviction primary CTA buttons ("Buy Now", "Add to Bag"), and assertive badge states.
- **Secondary (`#2563EB`):** Precision cobalt blue. Used purposefully for active navigation states, interactive links, shipping tier highlights, and contextual utilities.
- **Tertiary (`#F43F5E`):** Vivid rose. Applied strictly to urgent, high-value indicators such as low-stock alerts, sale tags, and destructive cart actions.
- **Neutral (`#F8FAFC`):** Cool porcelain/slate base canvas. Extended into tinted borders (`#E2E8F0`) and subtle container fills (`#F1F5F9`) to frame imagery without visual friction.

## Typography
Plus Jakarta Sans is utilized across all typographic roles to unify modern editorial polish with hyper-legible geometric precision. Product names, editorial lead-ins, and prices demand immediate visual clarity, achieved through negative letter tracking at large sizes and calculated line-heights.

Numerical data, pricing figures, and variant stock counts must always use proportional figures with tabular numeral support (`font-variant-numeric: tabular-nums`) to maintain alignment across product grids, mini-carts, and checkout summaries.

## Layout & Spacing
The layout adheres to a fixed-max-width 12-column grid capped at 1440px on desktop screens, shifting to an 8-column layout on tablet (640px–1024px) and a fluid 4-column layout on mobile (<640px).

- **Outer Canvas Margins:** Expand dynamically on ultra-wide viewports while locking to a standard `3rem` (`margin`) across desktop displays, compressing to `1rem` (`margin-mobile`) on phones to maximize product image real estate.
- **Product Listing Grids:** Standardize on 4 items per row on desktop (3 columns each), 2 items per row on tablet, and a unified 2-column or single-column carousel on mobile.
- **Micro Rhythms:** Internal card padding and form stacks operate strictly on the 4px/8px incremental scale (`space-xs` through `space-xl`).

## Elevation & Depth
Depth is rendered through crisp, subtle ambient occlusion combined with low-contrast hair-thin borders rather than diffuse, muddy drop shadows. This creates a razor-sharp, premium tactile presence.

- **Flat / Surface Level (Tier 0):** Pure `#FFFFFF` and base `#F8FAFC`. Unbroken planes bounded by `1px solid #E2E8F0`.
- **Card Rest State (Tier 1):** `box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.04);` with a border stroke of `1px solid #E2E8F0`.
- **Card Hover / Dropdown State (Tier 2):** `box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04);` with border transition to `#CBD5E1`.
- **Drawer / Modal Overlay (Tier 3):** Used for sliding quick-carts and checkout sheets: `box-shadow: -12px 0 36px -4px rgba(15, 23, 42, 0.12);` paired with a translucent backdrop blur (`backdrop-filter: blur(8px); background-color: rgba(15, 23, 42, 0.4)`).

## Shapes
A unified `roundedness: 2` (0.5rem base radius) defines the geometry, delivering a contemporary and polished appearance without veering into overly playful territory.

- **Buttons, Form Inputs, & Standard Product Chips:** Maintain `0.5rem` (`rounded`) corner radii for consistency and precision.
- **Product Display Cards & Modals:** Standardized on `1rem` (`rounded-lg`) to smoothly soften larger photographic panels.
- **Status Pills, Category Filter Tags, & Badges:** Use full circular radius (`9999px`) to establish distinct visual affordance from interactive actionable rectangles.

## Components

### Buttons
- **Primary CTA ("Add to Bag", "Proceed to Checkout"):** Solid `#090A0C` background, white text (`label-lg`), zero visible border, height `48px` (desktop) / `52px` (mobile touch optimization). Hover triggers subtle scale (`transform: translateY(-1px)`) and background shift to `#1E293B`.
- **Secondary Action:** Transparent fill with `1.5px solid #090A0C`, black label, active state transitions to full `#F1F5F9`.
- **Ghost/Tertiary:** Zero border, zero background, secondary blue or black label with subtle underline transition on focus.

### Product Cards
- Clean vertical stack: media container (aspect-ratio 4:5 or 1:1) framed in `#F1F5F9`, title (`headline-sm` or `label-lg`), sub-variant label (`body-sm` in slate gray), and tabular price display.
- Quick-add floating action appears on desktop hover with an effortless bottom-to-top slide and opacity fade (150ms ease-out).

### Chips & Filter Pills
- Inactive filters render in neutral background (`#F1F5F9`), slate text, border-free.
- Active filters invert to `#090A0C` fill with `#FFFFFF` text and an inline dismiss cross icon.

### Form Inputs & Quantity Selectors
- Single-line inputs: height `48px`, background `#FFFFFF`, border `1px solid #E2E8F0`, interior padding `12px 16px`. Focus triggers `border-color: #090A0C` with a clean `0 0 0 1px #090A0C` box-shadow ring.
- Quantity selectors use an integrated horizontal group (`-`, count, `+`) enclosed within a single bounded `1px solid #E2E8F0` pill-container.

### Checkboxes & Radios
- Size: `20px x 20px`. Inactive has `#E2E8F0` border. Active state fills solidly with `#090A0C` and a crisp white inner checkmark or concentric dot.

### Cart Drawer & Order Summary Line Items
- Slide-over mini-cart featuring pinned footer checkout triggers, item thumbnails with rounded `0.375rem` corners, inline quantity adjustments, and transparent cost breakdowns emphasizing absolute final balance.