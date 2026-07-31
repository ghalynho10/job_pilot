## Context

`app/dashboard/page.tsx` is still the authenticated landing shell built to prove the auth redirect works (a welcome header, a short paragraph, and a "Complete profile" / "Find jobs" CTA card). It has never shown any of the job search data the product is actually built around.

The build plan calls for a full dashboard UI next, and a matching design screenshot exists (`context/designs/dashboard.png`): four stat cards, a Recent Activity list, and three charts (two bar, one line). The project has followed this same two step pattern before, a mock data UI feature first (05 Profile Page, 09 Find Jobs Page), then a follow up feature that wires it to real InsForge data (06/07, 10/11). Features 15, 16, and 17 already exist on the build plan as that follow up work for this page's stats, activity, and analytics respectively.

The one gap: no charting library is installed, so a decision is needed on the smallest, most idiomatic choice for a Tailwind based React project before any chart can be built.

## Options considered

### Option 1: Recharts

A composable, SVG based React charting library built on top of D3. Charts are written as declarative React components (`<BarChart>`, `<Bar>`, `<LineChart>`, `<Area>`), and colors are plain props, so this project's existing CSS variable tokens (`var(--color-accent)`, etc.) plug in directly.

**Pros**:
- Idiomatic in a React and Tailwind codebase, no imperative canvas API to manage.
- Covers all three chart types needed (bar, area/line) out of the box with a small, well documented API.
- Large community and long track record; the boring, proven choice for a React dashboard.

**Cons**:
- Heavier bundle than a bare bones canvas library, though irrelevant at this page's scale (three small charts).

### Option 2: visx

A set of low level, unstyled D3 primitives maintained by Airbnb, meant to be composed into fully custom charts.

**Pros**:
- Smaller runtime footprint since only the primitives actually used are pulled in.
- Maximum control over every pixel, useful if the design ever needs a chart Recharts cannot express.

**Cons**:
- Every chart (axes, scales, tooltips, gridlines) has to be hand assembled from primitives; far more code for the same three charts than Recharts ships as components.

### Option 3: Chart.js with react-chartjs-2

A canvas based charting library with a thin React wrapper.

**Pros**:
- Mature, widely used, minimal configuration for standard bar and line charts.

**Cons**:
- Canvas rendering, not SVG, so styling with Tailwind's CSS variable tokens is more indirect (JS config objects instead of component props or CSS), and it does not compose as naturally into a React tree as an SVG based library.

## Rationale

The dashboard needs exactly two chart shapes, bar and line/area, both trivial in Recharts's declarative API. Its SVG based rendering means the existing `ui-tokens.md` CSS variables (`--color-accent`, `--color-info-medium`, `--color-success`) can be passed straight into `fill`/`stroke` props, keeping this feature's colors on the same token system as every other component in `ui-registry.md`, rather than introducing a second, canvas config based styling path (Chart.js) or hand rolling axes and gridlines from scratch (visx). visx's extra control is not needed since the design does not call for any chart shape outside Recharts's built in set.
