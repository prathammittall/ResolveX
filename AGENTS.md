<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": true` in the root `turbo.json` or `turbo.jsonc` to opt in; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

---

# War-Room Frontend Architecture & UI Guidelines (`apps/web`)

## 1. Source of Truth & Design Assets
All original Stitch reference exports live in [`stitch_design/`](./stitch_design):
- **Design System Spec**: [`stitch_design/DESIGN_SYSTEM.md`](./stitch_design/DESIGN_SYSTEM.md) & [`stitch_design/04_DESIGN_md_10223222/code.md`](./stitch_design/04_DESIGN_md_10223222/code.md)
- **Screen 1 — Overview Dashboard**: [`stitch_design/03_War-Room___Overview_c3d6affc/code.html`](./stitch_design/03_War-Room___Overview_c3d6affc/code.html) (Route: `/dashboard`)
- **Screen 2 — Incident Summary (`INC-1042`)**: [`stitch_design/05_War-Room___Incident_INC-1042_bcee5c2c/code.html`](./stitch_design/05_War-Room___Incident_INC-1042_bcee5c2c/code.html) (Route: `/incidents/[id]`)
- **Screen 3 — Incident Live War-Room (`INC-1042`)**: [`stitch_design/01_War-Room___Incident_War_Room_INC-1042_7ce71d2f/code.html`](./stitch_design/01_War-Room___Incident_War_Room_INC-1042_7ce71d2f/code.html) (Route: `/incidents/[id]/war-room`)
- **Screen 4 — Public Status Page (`Acme Co`)**: [`stitch_design/02_Acme_Co___Public_Status_Page_ac2a010c/code.html`](./stitch_design/02_Acme_Co___Public_Status_Page_ac2a010c/code.html) (Route: `/status`)

## 2. Absolute Constraints ("Do No Harm" Rules)
1. **Color Scheme Lock**: Strictly inherit and preserve the exact Stitch color palette defined in [`apps/web/app/globals.css`](./apps/web/app/globals.css):
   - Canvas Background: `#F7F5EF` (`--bg-canvas`)
   - Elevated Card Surface: `#FFFDF8` (`--bg-card`)
   - Crisp 1px Structural Border: `#E5E2DA` (`--border-card`)
   - Primary Cobalt Blue (Buttons, Links, Active Nav only): `#315E8C` (`--accent-primary`) / Deep Hover `#134673` (`--accent-primary-deep`)
   - Headings Deep Navy: `#172B40` (`--text-heading`)
   - Body Text: `#252D32` (`--text-main`), Secondary Metadata: `#71808A` (`--text-secondary`)
   - Accents (Sparingly): Sage `#879B84` (`--accent-sage`), Sandstone `#C9B79D` (`--accent-sandstone`)
   - Semantic Incident Severity Only: Muted Red `#B84A39` (`--severity-red`), Amber `#C47D15` (`--severity-amber`), Green `#3D7A5D` (`--severity-green`)
2. **Architectural Integrity**: Preserve core routing, data flow, and API routes (e.g., `apps/web/app/api/webhooks/alerts/route.ts`).
3. **Conditional Modification**: Only alter layout or components when the change measurably improves minimalism, typographic hierarchy, or user intuitiveness.

## 3. The "Anti-Slop" Refinement Filter
- **Flatten & Sharpen**: Zero drop shadows, zero glows, zero glassmorphism (`backdrop-blur` removed), zero gradients. Use crisp `1px solid #E5E2DA` borders and sharp radii (`0px`–`4px` for badges/controls, `8px` max where specified by `DESIGN.md` for primary focal cards).
- **8px Baseline Grid Enforcement**: All margins, paddings, and gaps must snap to multiples of `8px` (`8px`, `16px`, `24px`, `32px`, `40px`, `48px`), with `4px` permitted only for micro inline sub-grid alignment.
- **Negative Space Over Containers**: Avoid nesting cards inside cards (e.g., remove inner bordered boxes inside the On-Call roster and metadata panels; use whitespace and `1px` hairline horizontal dividers instead).
- **Typographic Hierarchy**:
  - **Primary Focal Data / Headlines**: `Inter` `24px`/`32px` (`600` weight) in `#172B40`.
  - **Body Copy**: `Inter` `15px`/`24px` (`400`–`500` weight) in `#252D32`.
  - **Metadata, Timestamps, IDs & Utility Labels**: `JetBrains Mono` `11px`–`12px`/`16px` in `#71808A` with `tabular-nums` for live timers and metrics.
- **Utilitarian Copy**: Blunt, direct, operational engineering terminology; zero marketing filler.

## 4. Modular Component Structure (`apps/web`)
Keep all UI code DRY and decomposed into reusable primitives under `apps/web/components/`:
- `layout/AppShell.tsx`: Slim left sidebar (max 5 nav items, icons + labels, active indicator, single user profile footer) + flat top status bar (eliminating duplicate profile avatars and glassmorphic blur).
- `layout/TopographicWatermark.tsx`: Reusable 5% opacity SVG corner contour line decoration (at most one per screen).
- `ui/SeverityBadge.tsx`: Semantic severity/status indicator (`SEV-1`, `Investigating`, `Operational`, `Degraded`, `Live`) in `JetBrains Mono`.
- `ui/LiveTimer.tsx`: Client-side elapsed duration counter with `font-variant-numeric: tabular-nums`.
- `ui/UptimeTimeline24h.tsx`: 24-segment hourly availability bar with accessible tooltips and summary row.
- `ui/StatusStepper.tsx`: 5-stage horizontal incident lifecycle track (`Triggered` -> `Acknowledged` -> `Investigating` -> `Identified` -> `Resolved`).
- `ui/ResponderAvatar.tsx`: Initials/avatar primitive (replacing brittle external Google usercontent URLs with deterministic local SVG/initial avatars so nothing breaks offline or expires).

## 5. Mandatory Stage-by-Stage Execution Workflow
For any UI page or major component modification:
1. **Stage 1 — The Intuitiveness Audit**: Document Current State Assessment, Friction Points, and Proposed Interventions.
2. **Stage 2 — The Minimalist Blueprint**: Document exact color remapping, spacing (8px grid), and typographic scale changes.
3. **Stage 3 — Surgical Code Implementation**: Execute only after Stages 1 and 2 are reviewed and approved by the human in the loop.
