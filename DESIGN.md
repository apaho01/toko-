---
name: Apex Precision Rig Builder
colors:
  surface: '#131319'
  surface-dim: '#131319'
  surface-bright: '#39383f'
  surface-container-lowest: '#0e0e14'
  surface-container-low: '#1b1b21'
  surface-container: '#1f1f25'
  surface-container-high: '#2a2930'
  surface-container-highest: '#34343b'
  on-surface: '#e4e1ea'
  on-surface-variant: '#cbc3d7'
  inverse-surface: '#e4e1ea'
  inverse-on-surface: '#303036'
  outline: '#958ea0'
  outline-variant: '#494454'
  surface-tint: '#d0bcff'
  primary: '#d0bcff'
  on-primary: '#3c0091'
  primary-container: '#a078ff'
  on-primary-container: '#340080'
  inverse-primary: '#6d3bd7'
  secondary: '#d2bbff'
  on-secondary: '#3f008e'
  secondary-container: '#6001d1'
  on-secondary-container: '#c9aeff'
  tertiary: '#4cd7f6'
  on-tertiary: '#003640'
  tertiary-container: '#009eb9'
  on-tertiary-container: '#002f38'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#d0bcff'
  on-primary-fixed: '#23005c'
  on-primary-fixed-variant: '#5516be'
  secondary-fixed: '#eaddff'
  secondary-fixed-dim: '#d2bbff'
  on-secondary-fixed: '#25005a'
  on-secondary-fixed-variant: '#5a00c6'
  tertiary-fixed: '#acedff'
  tertiary-fixed-dim: '#4cd7f6'
  on-tertiary-fixed: '#001f26'
  on-tertiary-fixed-variant: '#004e5c'
  background: '#131319'
  on-background: '#e4e1ea'
  surface-variant: '#34343b'
typography:
  display-hero:
    fontFamily: Space Grotesk
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.03em
  display-hero-mobile:
    fontFamily: Space Grotesk
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-md:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.06em
  label-sm:
    fontFamily: Space Grotesk
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.08em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 3rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style
This design system defines an ultra-premium, enthusiast-grade custom PC configure-and-buy platform. Targeted at hardcore gamers, esports competitors, simulation hobbyists, and heavy 3D/AI creative professionals, the aesthetic balances high-precision engineering with immersive cyberpunk luxury. 

The aesthetic is built on a dark, layered glassmorphic foundation—marrying technical utility with neon violet illumination. The interface feels like configuring military-grade avionics or an exotic hypercar: pure deep-space black canvases, crystalline panels with translucent refraction, razor-sharp geometric typography, and energetic atmospheric glows that pulse when components are engaged. It eliminates juvenile gaming clutter in favor of sleek, monolithic craftsmanship and industrial authority.

## Colors
The color architecture relies on high-contrast luminescence over multi-tiered dark surfaces:

- **Canvases & Foundations:** Base background is `#0B0B0E`. Elevated panels and workspace sections use `#121218`, while card containers sit at `#1A1A24` or an overlaid translucent zinc mix (`rgba(24, 24, 27, 0.60)`).
- **Core Accents:** Electric Violet (`#8B5CF6`) serves as the active driver for interactive states, primary actions, and focused metrics. Royal Violet (`#7C3AED`) drives foundational gradient stops and pressed states.
- **Precision Neon Utility (Tertiary):** Cyber Cyan (`#06B6D4`) provides high-tech contrast specifically for liquid-cooling indicators, overclock status tags, and wattage safety rails.
- **Borders & Micro-Glows:** Structural containment uses low-alpha violet borders (`rgba(139, 92, 246, 0.20)`), elevating to `rgba(139, 92, 246, 0.60)` on interactive focus.
- **Text & Hierarchy:** Headers are Pure White (`#FFFFFF`), body text utilizes Titanium Silver (`#94A3B8`), and technical specs/metadata utilize Muted Violet-Silver (`#A78BFA` at 70% opacity or `#64748B`).

## Typography
The system employs a dual-typeface strategy to balance raw mechanical precision with effortless digital readability:

- **Display, Headlines & Badges (`Space Grotesk`):** Delivers a hard-edged, geometric tech identity. Used uppercase for hardware identifiers (e.g., `RTX 4090 24GB`, `CORE I9-14900KS`, `DDR5 6400MHZ`), prices, section headers, and data metrics.
- **Body & Configurator Descriptions (`Plus Jakarta Sans`):** Provides clean, highly legible, human-centric sans-serif rendering for long component bios, thermal breakdown notes, compatibility warnings, and checkout workflows.

## Layout & Spacing
The layout adheres to a strict 12-column grid system built to handle asymmetric workstation visualizers alongside multi-step configuration panels:

- **Desktop (1280px+):** 12 columns with 24px (`1.5rem`) gutters and a minimum 48px (`3rem`) outer margin. In rig configuration mode, the viewport splits into an 8-column visual live 3D chassis stage and a 4-column sticky component drawer.
- **Tablet (768px - 1024px):** 8 columns, 16px (`1rem`) gutters, 24px (`1.5rem`) outer margin. Visualizer cascades above tabbed component selection bars.
- **Mobile (< 768px):** 4 columns, 16px (`1rem`) gutters, 16px (`1rem`) outer margin. The rig visualizer collapses to an expandable sticky header or full-bleed swipeable preview carousel.

## Elevation & Depth
Elevation is constructed via glassmorphic light filtration and atmospheric purple photonic projection rather than opaque traditional drop shadows:

- **Base Floor (`#0B0B0E`):** Zero elevation. Deep space void acting as high-contrast backing for hardware photography and RGB lighting.
- **Sub-tier Workspaces (`#121218`):** Foundation for side panels, configurator trees, and filtration sidebars.
- **Glassmorphic Paneling:** Background `rgba(24, 24, 27, 0.60)` compounded with `backdrop-filter: blur(16px)` and a subtle interior edge highlight `inset 0 1px 0 0 rgba(255, 255, 255, 0.08)`. Border is crisp `1px solid rgba(139, 92, 246, 0.20)`.
- **Glow & Radiant Elevation:**
  - *Resting Card:* Neutral boundary with no shadow.
  - *Interactive Hover:* `box-shadow: 0 0 15px rgba(139, 92, 246, 0.30), 0 8px 30px rgba(0, 0, 0, 0.80)`. Border transitions to `rgba(139, 92, 246, 0.60)`.
  - *Active Selected Rig Component:* `box-shadow: 0 0 25px rgba(139, 92, 246, 0.50), inset 0 0 12px rgba(139, 92, 246, 0.15)`.

## Shapes
The design avoids organic, hyper-circular styling, favoring refined architectural radiuses that match anodized aluminum computer chassis, tempered glass panels, and mechanical components:

- **Standard Elements (Cards, Panels, Inputs, Modals):** Scaled at level `2` (8px / `0.5rem` on standard containers; 12px–16px on large workspace cards).
- **Control Hardware (Chips, Status Badges, System Pills):** Retain tight, controlled rounding (4px–6px) to emulate mechanical hardware labels.
- **Interactive Action Points:** Buttons and CTAs feature 8px corner radii, maintaining razor-sharp geometric alignment with the underlying grid.

## Components

### Buttons & Interactive CTAs
- **Primary CTA ("Deploy Build", "Add to Cart"):** Gradient fill `linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)`, text pure white (`Space Grotesk` uppercase, bold), `box-shadow: 0 0 20px rgba(139, 92, 246, 0.40)`. Hover shifts luminance upward and increases outer neon blur to 30px.
- **Secondary Ghost:** Transparent center, 1px border `rgba(139, 92, 246, 0.40)`, text Titanium Silver. On hover, background shifts to `rgba(139, 92, 246, 0.10)` with a subtle purple border bloom.

### Product & Component Cards
- **Chassis:** High-density glass surface (`bg-zinc-900/60`, `backdrop-blur-md`, `border border-purple-500/20`).
- **Interactive State:** Hover invokes `translateY(-3px)`, increases border intensity to `border-purple-500/60`, and triggers `shadow-[0_0_20px_rgba(139,92,246,0.30)]`.
- **Anatomy:** Top status badge row, centered high-res hardware visual against radial gradient vignette, title in `Space Grotesk`, dynamic real-time wattage / performance metric readouts, and bottom price/selector bar.

### Status Badges & Hardware Tags
- Compact micro-tags with `label-sm` tracking.
- **"In Stock" / "Ready to Ship":** Neon emerald tint (`rgba(16, 185, 129, 0.15)` bg, emerald border, emerald glowing glyph).
- **"RTX 4090" / Flagship Tier:** High-voltage purple tint (`rgba(139, 92, 246, 0.20)` bg, `#A78BFA` text, `border-purple-500/40`).
- **"Liquid Cooled":** Deep cyan tint (`rgba(6, 182, 212, 0.15)` bg, `#22D3EE` text, `border-cyan-500/30`).

### Checkboxes, Radios & Component Selectors
- **Selection Units:** Custom hex-inspired square frames with 4px border radius. 
- **Checked State:** Solid `#8B5CF6` core with an outer `0 0 10px rgba(139, 92, 246, 0.8)` laser aura.
- **Row Selector:** Entire component card acts as a radio tile when picking CPUs, GPUs, or motherboards, illuminating with a full purple peripheral frame on selection.

### Input Fields & Search Bars
- Background `rgba(18, 18, 24, 0.80)`, 1px border `rgba(255, 255, 255, 0.10)`.
- Focus state: Border shifts instantly to `#8B5CF6`, activating an ambient `0 0 12px rgba(139, 92, 246, 0.25)` glow with crisp titanium white text input.

### Rig Builder Wattage & FPS Gauge
- Specialized persistent telemetry bar at the base of the configurator. Shows live estimated wattage meter with safe/warning load limits, estimated FPS badges across top titles (4K Cyberpunk, CS2, MW3), and real-time total price calculation with glowing monospace digits.