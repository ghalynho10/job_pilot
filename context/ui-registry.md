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

### ProfilePage

File: `app/profile/page.tsx`

Last updated: 2026-07-18

| Property | Class |
| --- | --- |
| Page background | `bg-background` |
| Main layout | `max-w-4xl gap-6 px-6 py-10 sm:px-8` |
| Card surface (all sections) | `rounded-xl border border-border bg-surface p-6 shadow-sm` |
| Card title | `text-lg font-semibold text-text-primary` |
| Subsection heading | `text-base font-semibold text-text-primary` |
| Field label | `text-xs font-medium uppercase tracking-wide text-text-secondary` |

Full profile UI in a single narrower centered column (unlike the dashboard's wide `max-w-[1440px]` layout), matching `context/designs/profile.png`. Composed of `CompletionIndicator`, `ResumeUpload`, and `ProfileForm`. Mock data only — no save logic yet (feature 06).

### CompletionIndicator

File: `components/profile/CompletionIndicator.tsx`

Last updated: 2026-07-18

| Property | Class |
| --- | --- |
| Card surface | `rounded-xl border border-border bg-surface p-6 shadow-sm` |
| Heading | `text-lg font-semibold text-text-primary` with `AlertCircle` icon (`text-error`) |
| Body text | `text-sm text-text-secondary` |
| Missing field pill | `rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-error` |
| Ring | inline SVG, 128px, `text-error/15` track + `text-error` progress arc, `strokeLinecap="round"`, `-rotate-90` |
| Ring center label | `text-2xl font-bold text-text-primary` |

Server-renderable (no client state); takes a `ProfileCompletion` (`percentage`, `missingFields`) prop.

### ResumeUpload

File: `components/profile/ResumeUpload.tsx`

Last updated: 2026-07-18

| Property | Class |
| --- | --- |
| Card surface | `rounded-xl border border-border bg-surface p-6 shadow-sm` |
| Dropzone (idle) | `rounded-xl border-2 border-dashed border-border-muted bg-surface-secondary` |
| Dropzone (drag-over) | `border-accent bg-accent-muted` |
| Dropzone icon badge | `size-11 rounded-full bg-surface shadow-sm` with `UploadCloud` icon (`text-accent`) |
| Select Resume (secondary) | `rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-secondary` |
| Generate Resume (primary) | `rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent-dark` with `FileText` icon |
| Focus (dropzone + Generate) | `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` |

Client component — tracks drag-over state visually and opens a hidden file input; no upload wiring yet (feature 06).

### ProfileForm

File: `components/profile/ProfileForm.tsx`

Last updated: 2026-07-18

| Property | Class |
| --- | --- |
| Card surface | `rounded-xl border border-border bg-surface p-6 shadow-sm` |
| Section divider | `border-t border-border pt-6` between Personal Info / Professional Info / Work Experience / Education / Job Preferences |
| Input / select / textarea | `w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent disabled:bg-surface-secondary disabled:text-text-secondary` |
| Field label | `text-xs font-medium uppercase tracking-wide text-text-secondary` |
| Skill / industry tag pill | `rounded-full bg-surface-secondary px-3 py-1 text-xs font-medium text-text-primary` with inline `X` remove icon |
| Work experience entry card | `rounded-lg border border-border bg-surface-secondary p-4` |
| Add role action | `text-sm font-medium text-accent hover:text-accent-dark` with `Plus` icon, disabled past 3 entries |
| Save Profile (primary, full width) | `w-full rounded-md bg-accent px-4 py-3 text-sm font-medium text-accent-foreground hover:bg-accent-dark` |
| Focus (all buttons, incl. tag-remove icon buttons) | `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` |
| Checkbox ("Currently working here") | `rounded border-border text-accent focus:ring-accent` |

Client component holding one `Profile` state object (`useState`, initialized from a mock/server-fetched value via `initialProfile` prop). Skills and industries are tag inputs (Enter or Add button); Work Experience supports up to 3 entries via Add role; "Currently working here" disables End Date. Save Profile button is not yet wired (feature 06). Note: the design screenshot has no Cover Letter Tone field under Job Preferences even though `build-plan.md` and the `profiles` DB schema mention one — built to match the screenshot per the source-of-truth rule in `ui-rules.md`; flag this gap when the field is eventually needed.

**Pattern notes:** every interactive element in this project (buttons, links, icon-only remove buttons) must carry `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`, matching `Navbar`, `OAuthButton`, and `DashboardPage`. The `ProfileForm`/`ResumeUpload` Add, Add role, dropzone, and tag-remove buttons were initially built without it and caught and fixed during `/imprint` — check for this specifically on any new icon-only or non-primary button.
