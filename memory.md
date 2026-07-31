# Memory — Feature 12 completed and merged

Last updated: 2026-07-31

## What was built

Feature 12, Job Details Page, is complete. It was designed, built, tested, verified, reviewed, fixed after review, and merged.

Main code added or changed:

- `app/find-jobs/[id]/page.tsx`, authenticated saved job detail route.
- `components/job-details/*`, the server renderable detail page pieces.
- `lib/job-details.ts`, shared display helpers for safe external links, nullable text, found date, structured string lists, and provider preview detection.
- `components/find-jobs/FindJobsPage.tsx`, job title links now navigate to `/find-jobs/[id]`.
- `app/find-jobs/page.tsx`, saved jobs are scoped to the signed in user.
- `proxy.ts`, direct signed out job detail visits redirect to `/login?error=session`.
- `types/index.ts`, `JobRow` now includes all detail fields read by the page.
- `tests/job-details.test.mjs` and `tests/find-jobs-contract.test.mjs`, Feature 12 contract coverage.
- `docs/specs/0008-job-details-page/`, Feature 12 spec.
- `docs/reviews/2026-07-31-feature-12-verify.md`, final verify evidence.
- `docs/reviews/2026-07-31-job-details-page.md` and `docs/reviews/2026-07-31-job-details-page-rereview.md`, review records.
- `context/ui-registry.md`, Job Details patterns, including the preview description callout.
- `context/progress-tracker.md`, Feature 12 marked complete.

Late debug fix:

- A saved job description could end mid sentence with an ellipsis, for example `in t…`.
- The detail page was not clipping it. The saved `about_role` value already came from the provider as a preview.
- The UI now detects descriptions that end in `…` or `...` and shows a callout linking to the safe external job post. It does not invent missing text.

## Decisions made

- The job detail route is server rendered and reads exactly one `jobs` row scoped by both `id` and `user_id`.
- Invalid ids, missing rows, and cross user rows all use the app not found state, so ownership is not leaked.
- External job links use one resolver, preferring `external_apply_url`, then `source_url`, accepting only `http:` and `https:`.
- Company Research stays as a disabled empty state in Feature 12. Feature 13 owns the real research agent and dossier rendering.
- Saved job descriptions are treated as source data. If the provider only saved a preview, the app shows that preview honestly and links to the original post.
- `normalizeStringList` accepts unknown legacy data and keeps only non blank strings, so malformed array values cannot crash the page.

## Problems solved

- Review found malformed structured arrays could crash the detail page. Fixed by filtering to strings before trimming. Regression test added.
- Review found long job fact values were clipped. Fixed by replacing truncation with wrapping in the info cards.
- Verify was originally blocked because there was no authenticated browser evidence. The engineer supplied real desktop and mobile screenshots, and the verify report now records the pass.
- A later debug found that truncated job descriptions were provider previews, not CSS clipping. Fixed with the preview callout and safe source link.

## Current state

- `main` is clean and up to date with `origin/main`.
- Latest visible commit is `768fb8b added view job description for truncated job descriptions (#7)`.
- Feature 12 is complete in the tracker.
- Final gates after the debug fix passed:
  - `npm test`, 252 tests passed.
  - `npx tsc --noEmit` passed.
  - `npm run lint` passed.
  - `npm run build` passed with network access for the Google Fonts fetch.

## Next session starts with

Start Feature 13, Company Research Agent.

Recommended first command:

```text
/architect feature 13
```

Feature 13 should extend the existing Job Details page. The Company Research card already exists as a disabled empty state, and Feature 13 should replace or activate it with the real research flow.

## Open questions

- Feature 13 still needs its own spec and design decisions.
- The full strategy for company research storage, refresh behavior, and failure states is not decided yet.
- Some older verify gaps remain documented in their own reports, especially live PostHog event readback and simulated Adzuna failure paths. They are not blockers for Feature 12.
