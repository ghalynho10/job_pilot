# UI Registry

Living document. Updated after every component is built. Read this before building any new component — match existing patterns exactly before inventing new ones.

---

## How to Use

Before building any component:

1. Check if a similar component already exists here
2. If yes — match its exact classes
3. If no — build it following ui-rules.md and ui-tokens.md, then add it here

After building any component — update this file with the component name, file path, and exact classes used.

---

## Components

- `Navbar` — `components/layout/Navbar.tsx`: `h-16`, `bg-surface`, `border-b border-border`, centered `max-w-[1440px]` layout, dark overlay CTA.
- `Footer` — `components/layout/Footer.tsx`: `bg-surface`, `border-t border-border`, centered `max-w-[1440px]` layout with brand and text links.
- `Hero` — `components/homepage/Hero.tsx`: `hero-gradient` hero surface, large centered type, paired CTA buttons, bordered dashboard image preview.
- `HowItWorks` — `components/homepage/HowItWorks.tsx`: two column desktop product section, `bg-surface-muted` visual panel, active `border-s-2 border-s-accent` feature item.
- `Features` — `components/homepage/Features.tsx`: alternating product section, success story, and gradient closing CTA with the shared CTA button styling.
