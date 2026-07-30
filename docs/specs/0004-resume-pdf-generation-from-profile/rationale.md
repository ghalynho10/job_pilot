# 0004. Generate a resume PDF from profile data — Rationale

## Context

Feature 07 already lets a user upload a resume and pull structured fields out of it into their profile. This feature runs the other direction: it takes the profile fields the user has already filled in or corrected and turns them back into a clean, presentable resume document, without requiring the user to have ever uploaded a file at all.

The "Generate Resume from Profile" button already exists in the profile page UI (built ahead of time in an earlier feature pass) but has no logic behind it yet. The forces at play: the generated content has to read as professional, not like raw form data pasted into a template; the app must never invent facts (employers, dates, achievements) that are not present in the user's own profile, since that would put false information on a document the user might send to an employer; and the app already has a private storage bucket, a signed link convention, and a "never overwrite a storage key" rule from earlier features, all of which this feature must follow rather than invent new patterns for.

The consequence of not building this: the button stays dead, and Phase 2 (the Profile Page) stays incomplete, since this is its last remaining feature.

## Options considered

### Option 1: Generate on demand through a route handler (chosen)

A single `POST` endpoint reads the caller's saved profile row, calls GPT-4o for the written content, renders a PDF in memory, uploads it, and updates the profile row, all within one request.

**Pros**:
- Matches the shape already used for feature 07's extraction endpoint, so the team is not learning a new pattern.
- One request, one clear success or failure outcome; nothing to reconcile later.

**Cons**:
- A single slow step (a slow AI response, for example) makes the whole request slow; there is no partial progress shown to the user during generation.

### Option 2: Background job with a status the client polls

The click enqueues a job; a background worker does the AI call and PDF work, then a separate status endpoint tells the client when it's done.

**Pros**:
- The click returns instantly, and a slow AI call never times out an HTTP request.

**Cons**:
- Needs a job queue and a worker process that do not exist anywhere else in this project yet; a real amount of new infrastructure for a single button that, in practice, takes a few seconds.

### Option 3: Generate content client side, render PDF client side

The browser calls an API for just the written content, then a client side PDF library builds and downloads the file directly, with no server side rendering or storage step.

**Pros**:
- No server side rendering code at all.

**Cons**:
- The chosen PDF library (`@react-pdf/renderer`) is documented in this project as server only; using it client side is not the supported path here. It would also mean the file never lands in the resumes bucket, breaking the "resume_pdf_url always points at something durable and shareable later" expectation the rest of the profile page relies on.

## Rationale

This project has no background job runner today, and adding one only for this feature would be a disproportionate amount of new infrastructure for a request that, based on the extraction endpoint's real world timing, completes in a few seconds. The single request shape also keeps the failure model simple: either the whole operation succeeds and the user sees a working resume, or it fails clearly at one identifiable step, which matches this project's existing "one try, one clear outcome" convention from feature 07's extraction flow. `@react-pdf/renderer` is explicitly documented in this project's library notes as a server only tool, which rules out Option 3 outright rather than leaving it a live tradeoff.
