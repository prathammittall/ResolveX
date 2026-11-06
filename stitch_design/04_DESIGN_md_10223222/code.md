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