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

Last updated: 2026-07-25

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

Use as the shared 64px site header. Public routes show the dark overlay CTA; authenticated routes replace it with the supplied account action or hide the action entirely. Navigation remains text-only and the active state remains color-only, matching `ui-rules.md`'s no-underline rule.

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

Full profile UI in a single narrower centered column (unlike the dashboard's wide `max-w-[1440px]` layout), matching `context/designs/profile.png`. Fetches the real `profiles` row and renders `CompletionIndicator` plus `ProfileEditor` (which composes `ResumeUpload` and `ProfileForm`); no mock data. Save logic per spec 0002 (feature 06, second revision: resume uploads on select).

### CompletionIndicator

File: `components/profile/CompletionIndicator.tsx`

Last updated: 2026-07-24

| Property | Class |
| --- | --- |
| Card surface | `rounded-xl border border-border bg-surface p-6 shadow-sm` |
| Heading (incomplete) | `text-lg font-semibold text-text-primary`, "Profile needs attention", with `AlertCircle` icon (`text-error`) |
| Heading (complete) | same classes, "Profile complete", with `CheckCircle` icon (`text-success`) |
| Body text | `text-sm text-text-secondary`, copy swaps with the complete/incomplete state |
| Missing field pill | `rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-error`, only rendered when `missingFields.length > 0` |
| Ring | inline SVG, 128px, `strokeLinecap="round"`, `-rotate-90`; track + arc use `text-error`/`text-error/15` when incomplete, `text-success`/`text-success/15` when `missingFields.length === 0` |
| Ring center label | `text-2xl font-bold text-text-primary` |

Server-renderable (no client state); takes a `ProfileCompletion` (`percentage`, `missingFields`) prop. `isComplete = missingFields.length === 0` drives every conditional (heading, icon, body copy, ring color) — a real bug caught after feature 06 shipped: the component only ever rendered the red "needs attention" state, even at 100%, since feature 05 never reached a genuinely complete profile against static mock data. Any future banner-style completion indicator in this project should branch the same way, not just gate the pill list.

### ResumeUpload

File: `components/profile/ResumeUpload.tsx`

Last updated: 2026-07-30

| Property | Class |
| --- | --- |
| Card surface | `rounded-xl border border-border bg-surface p-6 shadow-sm` |
| Dropzone (idle) | `rounded-xl border-2 border-dashed border-border-muted bg-surface-secondary` |
| Dropzone (drag-over) | `border-accent bg-accent-muted` |
| Dropzone (disabled, uploading/extracting/generating) | `disabled:cursor-not-allowed disabled:opacity-70` on the dropzone `button` and the hidden file `input`, matching `ProfileForm`'s Save Profile disabled treatment |
| Dropzone icon badge | `size-11 rounded-full bg-surface shadow-sm` with `UploadCloud` icon (`text-accent`) |
| Select Resume (secondary) | `rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-secondary` |
| Extract from Resume (secondary, icon) | same secondary classes as Select Resume, with `Sparkles` icon; only rendered once `canExtract` |
| Generate Resume (primary) | `rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-70` with `FileText` icon; disabled while any of `isUploading`/`isExtracting`/`isGenerating` is true, or while `!canGenerate` |
| Generate hint (disabled, not busy) | `mt-2 text-xs text-text-muted`, shown only when `!canGenerate`, e.g. "Add your full name and at least one work experience entry to generate a resume." |
| Generate success + View resume | `mt-2 flex flex-col items-start gap-1`; success line `text-xs text-text-secondary` ("Your resume is ready."); View resume is a text style action, `text-xs font-medium text-accent underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-70`, disabled while `isFetchingViewLink` |
| Error text | `text-xs text-error`, `role="alert"`, the same pattern used for the client side validation error, `uploadError`, `extractError`, `generateError`, and `viewLinkError` alike |
| Focus (dropzone, Extract, Generate, View resume) | `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` |

Client component, purely presentational: tracks drag-over state, opens a hidden file input, and calls `onFileSelected(file)` after a passing client side check, but never touches storage or the network itself. `ProfileEditor` owns the actual upload (`uploadResumeFile`, spec 0002's second revision), extraction (`/api/resume/extract`, spec 0003), and generation (`/api/resume/generate` plus `/api/resume/signed-url`, spec 0004), feeding back their busy/error/success state as props. The dropzone button and file input are disabled while any of `isUploading`, `isExtracting`, or `isGenerating` is true (`isBusy`), so no two of these three flows can race each other.

**Note:** the View resume button was initially built without `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`, the project wide rule this same file's own Pattern notes calls out below. Caught and fixed during this `/imprint` pass, the same class of miss caught before on the Add/Add role/dropzone/tag-remove buttons; a regression test now locks it in (`tests/profile-contract.test.mjs`).

### ProfileForm

File: `components/profile/ProfileForm.tsx`

Last updated: 2026-07-29

| Property | Class |
| --- | --- |
| Card surface | `rounded-xl border border-border bg-surface p-6 shadow-sm` |
| Section divider | `border-t border-border pt-6` between Personal Info / Professional Info / Work Experience / Education / Job Preferences |
| Input / select / textarea | `w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent disabled:bg-surface-secondary disabled:text-text-secondary` |
| Blank select placeholder | First `<option value="">...` for Work Authorization, Experience Level, Highest Degree, and Remote Preference, so empty profile values render as empty choices instead of visually implying the first saved option |
| Field label | `text-xs font-medium uppercase tracking-wide text-text-secondary` |
| Skill / industry tag pill | `rounded-full bg-surface-secondary px-3 py-1 text-xs font-medium text-text-primary` with inline `X` remove icon |
| Work experience entry card | `rounded-lg border border-border bg-surface-secondary p-4` |
| Add role action | `text-sm font-medium text-accent hover:text-accent-dark` with `Plus` icon, disabled past 3 entries |
| Save Profile (primary, full width) | `w-full rounded-md bg-accent px-4 py-3 text-sm font-medium text-accent-foreground hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-70`, disabled while saving (`isSaving`, shows "Saving…") or while a resume upload is in flight (`saveDisabled`, text stays "Save Profile" since no save is actually happening yet) |
| Save result text | `text-sm text-error` (`role="alert"`) for `saveError`, `text-sm text-success` (`role="status"`, `aria-live="polite"`) for `saveSuccess` |
| Focus (all buttons, incl. tag-remove icon buttons) | `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` |
| Checkbox ("Currently working here") | `rounded border-border text-accent focus:ring-accent` |

Fully controlled client component (no internal `Profile` state); `profile`, `onProfileChange`, and the save wiring (`isSaving`, `saveDisabled`, `onSave`, `saveError`, `saveSuccess`) all come from `ProfileEditor`. Skills and industries are tag inputs (Enter or Add button); Work Experience supports up to 3 entries via Add role; "Currently working here" disables End Date. `saveDisabled` is a separate prop from `isSaving` on purpose: it disables the button without swapping its text to "Saving…", since a resume upload in flight is not itself a save (spec 0002's second revision, AC-9). Cover Letter Tone is intentionally absent from the current profile UI to match the delivered design; `cover_letter_tone` remains a reserved nullable DB column only.

### ProfileEditor

File: `components/profile/ProfileEditor.tsx`

Last updated: 2026-07-30

Non-visual client wrapper, no styling classes of its own; composes `ResumeUpload` and `ProfileForm` and owns every piece of state a Save Profile click, a resume selection, an extraction, or a generation touches: `profile`, `isUploading`/`uploadError`, `isExtracting`/`extractError`, `isGenerating`/`generateError`/`generateSuccess`, `isFetchingViewLink`/`viewLinkError`, plus the existing save `isPending`/`saveError`/`saveSuccess` trio. On `onFileSelected`, calls `uploadResumeFile` immediately (spec 0002's second revision: the resume uploads on select, not on Save Profile), passing the previous, still unsaved key so the server can best effort clean it up on a reselect. `saveProfile` still only fires on the Save Profile click, taking the resolved `resumeKey`.

`canGenerate` is derived straight from the live `profile` state (`fullName` non empty and `workExperience.length > 0`), not its own flag, so it always reflects the current, possibly unsaved, form values (spec 0004). `handleGenerate` posts to `/api/resume/generate` and calls `router.refresh()` on success, so the server re-reads the updated `resume_pdf_url`; `handleViewResume` fetches `/api/resume/signed-url` fresh on every click and opens it in a new tab, deliberately never storing the link anywhere in component state or `sessionStorage` (spec 0004's "mint only on click" decision). `saveDisabled` on `ProfileForm` now folds in `isGenerating` alongside `isUploading`/`isExtracting`.

`resumeKey`/`resumeFileName` are not `useState` (spec 0002's third revision, AC-10: survive a page refresh within the same tab). They are read live from `sessionStorage` via `useSyncExternalStore` (`lib/staged-resume-storage.ts`: `getStagedResumeKey`, `getStagedResumeFileName`, `getStagedResumeServerSnapshot`, `subscribeToStagedResume`), namespaced per user (`profile-staged-resume:${userId}`, the `userId` prop threaded from `app/profile/page.tsx`'s session). `writeStagedResume` runs on a successful upload in place of `setResumeKey`/`setResumeFileName`; `clearStagedResume` runs on a successful save in place of resetting them to `null`. `useSyncExternalStore`, not a plain `useState` initializer or a `useEffect` that calls `setState`, because this component is server rendered first (no `sessionStorage` there): either of those would either desync the client's first render from the server's (a real hydration mismatch, not cosmetic) or trip this project's own `react-hooks/set-state-in-effect` lint rule (from `eslint-config-next/core-web-vitals`, unmodified). `getStagedResumeKey`/`getStagedResumeFileName` return plain strings (or `null`), not an object, specifically so `useSyncExternalStore`'s `Object.is` snapshot comparison works by value and never loops.

**Pattern notes:** every interactive element in this project (buttons, links, icon-only remove buttons) must carry `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`, matching `Navbar`, `OAuthButton`, and `DashboardPage`. The `ProfileForm`/`ResumeUpload` Add, Add role, dropzone, and tag-remove buttons were initially built without it and caught and fixed during `/imprint` — check for this specifically on any new icon-only or non-primary button.

### FindJobsPage

File: `app/find-jobs/page.tsx` (auth shell) + `components/find-jobs/FindJobsPage.tsx` (interactive client component)

Last updated: 2026-07-30 (feature 10, Adzuna job discovery)

| Property | Class |
| --- | --- |
| Card surface (search card, results card) | `rounded-xl border border-border bg-surface p-6 shadow-sm` / `rounded-xl border border-border bg-surface shadow-sm` (results card, no `p-6`; the table and footer manage their own padding) |
| Field label | `text-xs font-medium uppercase tracking-wide text-text-secondary` |
| Text input (with leading icon) | `w-full rounded-md border border-border bg-surface py-2 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` |
| Native select (filter/sort) | `appearance-none rounded-md border border-border bg-surface py-2 pl-4 pr-9 text-sm font-medium text-text-primary focus:border-accent focus:ring-1 focus:ring-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`, custom chevron glyph overlaid (`appearance-none` hides the native arrow) |
| Find Jobs (primary) | `rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` with a leading `Search` icon |
| Success banner | `rounded-lg bg-success-lightest px-4 py-3 text-sm font-medium text-success-foreground` with a leading `Sparkles` icon, `role="status"` |
| Empty results banner | `rounded-lg bg-surface-secondary px-4 py-3 text-sm font-medium text-text-secondary`, no icon, `role="status"` |
| Error banner | `rounded-lg bg-error px-4 py-3 text-sm font-medium text-error-foreground` with a leading `AlertCircle` icon, `role="alert"` (this project's first use of the `error`/`error-foreground` tokens; there is no `error-light`/`error-lightest` variant in `ui-tokens.md` the way `success` has, so this banner is solid, not a tinted light background) |
| No-skills warning banner | `rounded-lg bg-warning px-4 py-3 text-sm font-medium text-warning-foreground` with a leading `AlertCircle` icon, `role="status"` |
| Match score bar | track `h-1 w-24 rounded-full bg-border-light`, fill `h-1 rounded-full` + a tier class (`bg-success` at 90%+, `bg-info-medium` at 80 to 89%, `bg-warning` below 80%); percentage text stays `text-text-primary`, never colored |
| Source badge | pill `rounded-full px-2 py-0.5 text-xs font-medium`; `search` → `bg-accent-muted text-accent`, `url` → `bg-surface-secondary text-text-secondary` (this project's first use of the `search` source; `url` matches `ui-tokens.md`'s existing Source Badges table) |
| Company icon slot | `flex size-9 items-center justify-center rounded-md bg-surface-secondary` with a `Building2` icon, `text-text-secondary` |
| Table row | `border-t border-border hover:bg-surface-secondary`, wrapped in `overflow-x-auto` with `min-w-[720px]` on the `table` itself so no column clips on narrow viewports |
| Pagination button | `rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50` |
| Pagination active page | `rounded-md border border-accent bg-accent-light px-3 py-1.5 text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`, `aria-current="page"` |

Server `app/find-jobs/page.tsx` follows the exact `DashboardPage`/`ProfilePage` auth pattern (`createInsforgeServer`, redirect to `/login?error=session` if no session), then additionally reads the caller's `profiles.skills` and passes `hasSkills`/`userId` down to the client `FindJobsPage` component alongside the shared `Navbar`. Per spec [0006](../docs/specs/0006-adzuna-job-discovery/index.md), feature 10 replaced feature 09's static mock shell with a real search: `components/find-jobs/FindJobsPage.tsx` now owns controlled `jobTitle`/`location` inputs plus a single `status` state machine (`idle` / `loading` / `success` / `empty` / `error`) instead of the old `hasSearched` boolean. Submitting fires `job_search_started` client side, posts to `POST /api/agent/find`, then on success refetches the real saved rows via `insforge.database.from("jobs")` rather than rendering the old fixed `lib/mock-jobs.ts` array (deleted, nothing imports it anymore). The results table renders only once `status === "success"` and at least one job came back; a distinct empty banner shows when the search legitimately found zero jobs, and the error banner shows on any request failure. If the caller's profile has no skills recorded, the whole form is disabled up front and a warning banner explains why, so a search is never even attempted without something to score against. The filter input, both `<select>` dropdowns, and every pagination button are still exactly as static as feature 09 left them (no `onChange`/`onClick` wiring); feature 11 (Filter + Sort + Pagination) still owns wiring that markup to real behavior. The match score color bands here (green ≥90%, blue 80 to 89%, orange below 80%, now driven by `lib/match-score.ts` rather than the deleted `lib/mock-jobs.ts`) remain a page-local display rule, a different concern from feature 11's own High/Low Match semantics (`>= 70%` / `< 70%`) — don't conflate the two if reusing this bar elsewhere.

### JobDetailsPage

File: `app/find-jobs/[id]/page.tsx` (auth shell) + `components/job-details/*` (server-renderable detail components)

Last updated: 2026-07-31

| Property | Class |
| --- | --- |
| Page background | `bg-background` |
| Main shell | `max-w-[1440px] px-6 py-10 sm:px-8` |
| Detail column | `max-w-4xl gap-6` |
| Back link | `inline-flex w-fit items-center gap-2 text-base font-medium text-text-secondary hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` |
| Card surface | `rounded-xl border border-border bg-surface p-6 shadow-sm` |
| Header icon slot | `size-16 rounded-xl border border-border bg-surface-secondary` with `Building2` icon in `text-text-muted` |
| Header title | `text-3xl font-semibold leading-tight text-text-primary` |
| Match badge | `rounded-full bg-success-lightest px-3 py-1 text-sm font-medium text-success-foreground`; null score falls back to `bg-surface-secondary text-text-secondary` |
| Secondary external action | `inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` |
| Info cards | `rounded-xl border border-border bg-surface p-4 shadow-sm`, grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` |
| Info icon badges | `size-11 rounded-lg`, token tone per fact: salary `bg-success-lightest text-success`, location `bg-info-lightest text-info-foreground`, job type `bg-accent-muted text-accent`, date `bg-surface-secondary text-text-secondary` |
| Section eyebrow | `text-xs font-semibold uppercase tracking-wide text-text-secondary` |
| Body paragraph | `text-base font-medium leading-7 text-text-primary` |
| Preview description callout | `mt-5 rounded-lg border border-border bg-surface-secondary p-4`, copy `text-sm leading-6 text-text-secondary`, link `mt-3 inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` |
| Matched skill pill | `inline-flex items-center gap-1 rounded-full bg-success-lightest px-3 py-1 text-sm font-medium text-success-foreground` |
| Missing skill pill | `inline-flex items-center gap-1 rounded-full bg-accent-muted px-3 py-1 text-sm font-medium text-accent` |
| Company Research card | `overflow-hidden rounded-xl border border-border bg-surface shadow-sm`, header `border-b border-border p-6` |
| Research Company action | `rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70`, only rendered when no dossier exists yet; disabled and shows a `Loader2 animate-spin` icon plus "Researching…" while a request is in flight |
| Research empty state | `min-h-72 px-6 py-12 text-center`, icon box `size-14 rounded-xl bg-surface-secondary`, muted copy `text-text-muted` |
| Research error state | same `min-h-72` layout, icon box `bg-error/10` with a `text-error` icon, message rendered `role="alert"` |
| Dossier section heading | `text-base font-semibold text-text-primary` |
| Dossier tag list (Tech Stack) | `inline-flex items-center rounded-full bg-accent-muted px-3 py-1 text-sm font-medium text-accent` |
| Dossier bullet lists (Culture, Your Edge, Gaps to Address, Smart Questions, Interview Prep) | reuse `StructuredList` |
| Dossier sources | `space-y-1 text-xs text-text-muted` |
| Primary Apply Now action | `min-h-12 w-full rounded-md bg-accent px-4 py-3 text-base font-medium text-accent-foreground hover:bg-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` |

Server route follows the protected page pattern (`createInsforgeServer`, current user read, redirect to `/login?error=session` when the page itself sees no valid session). `proxy.ts` now also sends direct signed out `/find-jobs/[id]` visits to the same session-error login URL while leaving the broader "first time visitor gets plain /login" behavior intact. The job details row read is always `.eq("id", id).eq("user_id", data.user.id).maybeSingle()` after a UUID check, so invalid ids, missing rows, and cross-user rows all become not found without revealing ownership.

`lib/job-details.ts` centralizes the small display rules: `resolveExternalJobUrl` accepts only parsed `http:` or `https:` urls and prefers `external_apply_url` over `source_url`; `formatNullableText` and `formatFoundAt` supply deliberate fallbacks; `normalizeStringList` trims and drops blank structured entries; `isLikelyTruncatedDescription` detects provider preview text that ends in an ellipsis. Keep these helpers as the single source for job detail display normalization, rather than reimplementing url, nullable, list, or preview handling inside components. When a saved job description is only a provider preview, `JobDescriptionCard` shows the saved text exactly as received and adds a `bg-surface-secondary` callout linking to the safe external job post when one exists, instead of silently ending mid sentence or inventing missing text.

Feature 13 turned `CompanyResearchCard` into a client component (`"use client"`). With no saved `company_research`, it shows the empty state and an enabled Research Company button; pressing it posts to `POST /api/agent/research`, disables the button and shows a loading state for the duration, then calls `router.refresh()` on success so the server-rendered `job.company_research` comes back populated. On failure it shows an inline `role="alert"` error state with the button re-enabled for retry. Once a dossier is saved, the card renders all nine fields directly (`companyOverview`, `techStack`, `culture`, `whyThisRole`, `yourEdge`, `gapsToAddress`, `smartQuestions`, `interviewPrep`, `sources`) and shows no button or empty state — there is no refresh/re-research action in this first slice. The card itself never calls InsForge or Stagehand directly; all of that lives in `agent/research.ts` and `app/api/agent/research/route.ts`. See [spec 0009](../docs/specs/0009-company-research-agent/index.md).
