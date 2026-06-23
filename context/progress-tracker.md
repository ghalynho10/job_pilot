# Progress Tracker

Update this file after every completed feature. Any AI agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 1 — Foundation
**Last completed:** 01 Homepage
**Next:** 02 Auth

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

- **Logo:** Used `/public/logo.png` (full lockup image) in Navbar and Footer via `next/image`.
- **Inter font:** Loaded via `next/font/google` with `variable: "--font-sans"` to match the `@theme` token in globals.css; applied on `<html>` element.
- **Geist fonts removed** from layout — Inter is the sole font per ui-tokens.md.
- **Hero screenshot:** `/public/images/dashboard-demo.png` displayed in a borderless card that bleeds into the features section.
- **BottomCta gradient:** Inline `style` used for the gradient because Tailwind v4 `@theme` does not support gradient definitions; all colors reference design token values.
- **Features section:** Three two-column blocks alternating image/text. Feature 3 reuses `jobs-lists.png` as a placeholder for the match score view until a dedicated screenshot is available.

---

## Notes

- Tailwind v4 canonical class: `max-w-300` = 1200px (IDE warned on `max-w-[1200px]`).
- No shadcn/ui components needed for the homepage — built with plain Tailwind + lucide-react icons.
