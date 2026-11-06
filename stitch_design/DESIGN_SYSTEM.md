---
name: War-Room
colors:
  surface: '#f9f9fd'
  surface-dim: '#d9dade'
  surface-bright: '#f9f9fd'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f8'
  surface-container: '#ededf2'
  surface-container-high: '#e8e8ec'
  surface-container-highest: '#e2e2e6'
  on-surface: '#1a1c1f'
  on-surface-variant: '#42474f'
  inverse-surface: '#2f3034'
  inverse-on-surface: '#f0f0f5'
  outline: '#727780'
  outline-variant: '#c2c7d0'
  surface-tint: '#34618f'
  primary: '#134673'
  on-primary: '#ffffff'
  primary-container: '#315e8c'
  on-primary-container: '#b8d7ff'
  inverse-primary: '#9fcafe'
  secondary: '#4d6077'
  on-secondary: '#ffffff'
  secondary-container: '#cde1fd'
  on-secondary-container: '#51647c'
  tertiary: '#5b3f00'
  on-tertiary: '#ffffff'
  tertiary-container: '#785506'
  on-tertiary-container: '#fdcc77'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d1e4ff'
  primary-fixed-dim: '#9fcafe'
  on-primary-fixed: '#001d36'
  on-primary-fixed-variant: '#174976'
  secondary-fixed: '#d1e4ff'
  secondary-fixed-dim: '#b4c8e3'
  on-secondary-fixed: '#071d31'
  on-secondary-fixed-variant: '#35485f'
  tertiary-fixed: '#ffdea9'
  tertiary-fixed-dim: '#efbf6b'
  on-tertiary-fixed: '#271900'
  on-tertiary-fixed-variant: '#5e4100'
  background: '#F7F5EF'
  on-background: '#1a1c1f'
  surface-variant: '#e2e2e6'
  card: '#FFFDF8'
  card-border: '#E5E2DA'
  text-main: '#252D32'
  text-secondary: '#71808A'
  accent-sage: '#879B84'
  accent-sandstone: '#C9B79D'
  severity-red: '#B84A39'
  severity-amber: '#C47D15'
  severity-green: '#3D7A5D'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  caption-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 2rem
  margin: 2.5rem
  space-xs: 0.5rem
  space-sm: 1rem
  space-md: 1.5rem
  space-lg: 2rem
  space-xl: 3rem
---

Design a minimalist web app called "War-Room", an incident response tool for small engineering teams. Desktop-first, 1440px.
Style: calm, editorial, quiet. Think Linear meets a well-designed paper notebook. Lots of whitespace, few elements per screen, one clear focal point per screen. Information density is LOW. If in doubt, remove it.
Colors:
- Background: warm ivory #F7F5EF
- Cards: #FFFDF8 with 1px border #E5E2DA, 8px radius, no shadows
- Primary: cobalt blue #315E8C (buttons, links, active nav only)
- Deep navy #172B40 for headings
- Text: #252D32, secondary text #71808A
- Accents (sparingly): sage #879B84, sandstone #C9B79D
- Status colors only for incident severity: muted red, amber, green
Typography: Inter for UI, JetBrains Mono for timestamps and IDs. Few sizes: one heading, one body, one caption.
Layout rules: slim left sidebar (icons plus labels, 5 items max), generous 32px+ spacing, max 2 columns, no more than 3 cards per screen, no dense tables (max 5 rows).
Decoration: at most one faint topographic contour line pattern in an empty corner at 5% opacity. Nothing else.
Avoid: gradients, glass effects, neon, pill-shaped everything, charts unless requested, clutter, tiny text, multiple competing sections.
Sample data used throughout: INC-1042 "API latency elevated", service Payments API, SEV-1, commander Asha Sharma, responder Rohan Kumar.