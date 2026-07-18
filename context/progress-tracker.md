# Progress Tracker

Update this file after every completed feature. Any AI agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 1 — Foundation
**Last completed:** 01 Homepage
**In progress:** 02 Auth
**Next:** 02 Auth verification

---

## Progress

### Phase 1 — Foundation

- [x] 01 Homepage
- [ ] 02 Auth
- [ ] 03 PostHog Initialization
- [ ] 04 Database Schema

### Phase 2 — Profile Page

- [ ] 05 Profile Page — Full UI
- [ ] 06 Profile Save Logic
- [ ] 07 AI Profile Extraction from Resume
- [ ] 08 Resume PDF Generation from Profile

### Phase 3 — Find Jobs Page

- [ ] 09 Find Jobs Page — Full UI
- [ ] 10 Adzuna Job Discovery
- [ ] 11 Filter + Sort + Pagination

### Phase 4 — Job Details Page

- [ ] 12 Job Details Page — Full UI
- [ ] 13 Company Research Agent

### Phase 5 — Dashboard

- [ ] 14 Dashboard Page — Full UI
- [ ] 15 Stats Bar — Real Data
- [ ] 16 Recent Activity — Real Data
- [ ] 17 Analytics Charts — PostHog Data

---

## Decisions Made During Build

- Auth uses `@insforge/sdk/ssr` with server owned PKCE cookies.
- Next.js 16 route protection lives in `proxy.ts`.
- OAuth callbacks exchange the InsForge code at `/callback`, then redirect to `/dashboard`.
- The current dashboard page is the authenticated landing shell required to verify the auth redirect. Feature 14 replaces it with the full dashboard UI.

---

## Notes

- Add `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_INSFORGE_URL`, and `NEXT_PUBLIC_INSFORGE_ANON_KEY` to `.env.local` before testing OAuth.
- Production build verification is pending because the sandbox could not fetch Inter from Google Fonts. Auth tests, TypeScript, and ESLint pass.
