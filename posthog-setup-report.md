# PostHog post-wizard report

PostHog has been integrated into the Next.js App Router application. The browser SDK initializes through `instrumentation-client.ts` using environment configuration, and the Node SDK records successful OAuth callbacks with a shared authenticated user ID. Client-side tracking covers OAuth initiation, dashboard activation choices, and sign-out. The integration also enables exception capture, identifies authenticated dashboard visitors, and configures ingestion rewrites.

| Event name | Description | File |
| --- | --- | --- |
| `oauth_sign_in_started` | Tracks when a visitor begins sign-in with an OAuth provider. | `components/auth/OAuthButton.tsx` |
| `oauth_sign_in_completed` | Tracks successful OAuth authentication on the server. | `app/(auth)/callback/route.ts` |
| `dashboard_profile_setup_selected` | Tracks when an authenticated user starts profile setup from the dashboard. | `components/dashboard/DashboardActions.tsx` |
| `dashboard_job_search_selected` | Tracks when an authenticated user begins a job search from the dashboard. | `components/dashboard/DashboardActions.tsx` |
| `user_signed_out` | Tracks when an authenticated user signs out. | `components/layout/Navbar.tsx` |

## Next steps

A dashboard has been created for these signals:

- [Analytics basics (wizard)](https://us.posthog.com/project/518284/dashboard/1869016)

No saved insights were added yet because the newly instrumented custom events have not reached the project schema. Trigger the application flows above, then create trends or a funnel from the confirmed events.

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add the exact PostHog env var names added to `.env.example` and any monorepo/bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or the bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path also calls `identify` — a handler that only identifies on fresh login can leave returning sessions on anonymous distinct IDs.

### Agent skill

The project includes an agent skill folder for future PostHog-aware development.
