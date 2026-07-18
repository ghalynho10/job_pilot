# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Core database schema and the resumes storage bucket for job search data: profiles, agent runs, jobs, and agent logs, created through a versioned InsForge migration (see spec 0001)
- InsForge CLI and its agent skills (database, storage, debugging, third party auth integration) are now installed, and this project is linked to its InsForge backend project

### Changed
- The auth callback route no longer performs any analytics tracking; it only exchanges the OAuth code and redirects

### Removed
- Removed PostHog event captures that were not on the approved product event list (OAuth sign in start and completion, dashboard action selection, and sign out), keeping only the four documented product events

### Fixed
- The server side PostHog client now reads the documented `NEXT_PUBLIC_POSTHOG_KEY` environment variable and is named `createPostHogServer`, correcting a mismatched name and variable from initial setup

### Security
- Row level security now protects all four database tables and the resumes storage bucket, so a signed in user can only ever read or write their own data, verified against a live test with two separate accounts (see spec 0001)
