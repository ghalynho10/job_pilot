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

- `Footer` — `components/layout/Footer.tsx`: `bg-surface`, `border-t border-border`, centered `max-w-[1440px]` layout with brand and text links.
- `Hero` — `components/homepage/Hero.tsx`: `hero-gradient` hero surface, large centered type, paired CTA buttons, bordered dashboard image preview.
- `HowItWorks` — `components/homepage/HowItWorks.tsx`: two column desktop product section, `bg-surface-muted` visual panel, active `border-s-2 border-s-accent` feature item.
- `Features` — `components/homepage/Features.tsx`: alternating product section, success story, and gradient closing CTA with the shared CTA button styling.
- `PostHogProvider` — `app/PostHogProvider.tsx`: non-visual root client provider; no styling classes.

### Navbar

File: `components/layout/Navbar.tsx`

Last updated: 2026-07-17

| Property | Class |
| --- | --- |
| Background | `bg-surface` |
| Border | `border-b border-border` |
| Radius | None |
| Shadow | None |
| Height | `h-16` |
| Layout | `max-w-[1440px] px-6` |
| Navigation spacing | `gap-10` |
| Navigation text | `text-base font-medium text-text-dark` |
| Navigation interaction | `hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent` |
| Primary action | `rounded-md bg-overlay px-5 py-3 text-sm font-medium text-accent-foreground hover:bg-overlay-dark` |
| Secondary action | `rounded-md border border-border bg-surface px-5 py-3 text-sm font-medium text-text-primary hover:bg-surface-secondary` |

Use as the shared 64px site header. Public routes show the dark overlay CTA; authenticated routes replace it with the supplied account action or hide the action entirely.

### OAuthButton

File: `components/auth/OAuthButton.tsx`

Last updated: 2026-07-17

| Property | Class |
| --- | --- |
| Background | `bg-surface` |
| Border | `border border-border` |
| Radius | `rounded-md` |
| Shadow | None |
| Height | `min-h-12` |
| Padding | `px-4 py-3` |
| Content spacing | `gap-3` |
| Typography | `text-base font-medium text-text-primary` |
| Hover | `hover:bg-surface-secondary` |
| Focus | `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` |
| Disabled | `disabled:cursor-not-allowed disabled:text-text-muted` |

Use for full-width OAuth provider actions. Keep the provider icon in `currentColor`, stack multiple providers with `gap-3`, and expose pending copy through the component's live status text.

### LoginPage

File: `app/(auth)/login/page.tsx`

Last updated: 2026-07-17

| Property | Class |
| --- | --- |
| Page background | `bg-surface` |
| Form panel padding | `px-6 py-8` |
| Form heading | `text-3xl font-semibold text-text-primary` |
| Supporting text | `text-base text-text-secondary` |
| Provider spacing | `gap-3` |
| Error alert | `rounded-md border border-error bg-surface px-4 py-3 text-base text-error` |
| Marketing panel | `hero-gradient` |
| Marketing heading | `text-4xl font-semibold leading-tight text-text-primary` |
| Marketing preview | `rounded-md border border-border bg-surface p-3 shadow-sm` |
| Footer text | `text-sm text-text-muted` |

Use this split auth shell for sign-in entry points. Keep the shared navbar, one visible `h1`, stacked provider actions, and a tokenized `role="alert"` error. The marketing preview remains a desktop-only companion to the focused form.

### DashboardPage

File: `app/dashboard/page.tsx`

Last updated: 2026-07-17

| Property | Class |
| --- | --- |
| Page background | `bg-background` |
| Main layout | `max-w-[1440px] gap-6 px-6 py-10` |
| Page heading | `text-3xl font-semibold text-text-primary` |
| Eyebrow | `text-base font-medium text-accent` |
| Empty-state surface | `rounded-md border border-border bg-surface p-6 shadow-sm` |
| Surface heading | `text-xl font-semibold text-text-primary` |
| Body text | `text-base leading-7 text-text-secondary` |
| Primary action | `rounded-md bg-accent px-4 py-3 text-base font-medium text-accent-foreground hover:bg-accent-dark` |
| Secondary action | `rounded-md border border-border bg-surface px-4 py-3 text-base font-medium text-text-primary hover:bg-surface-secondary` |
| Focus | `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` |

Use as the authenticated landing shell and empty-state pattern. Pair the authenticated navbar with a concise account greeting, one bordered surface, and clear primary and secondary next-step actions.
