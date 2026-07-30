# 0005. Find Jobs page UI — Rationale

## Context

Phase 2 (the Profile page) is complete. Phase 3 starts the job discovery experience, and `context/build-plan.md` splits it into three features: 09 (this page's full UI on mock data, no logic), 10 (the real Adzuna search and scoring that fills the `jobs` table), and 11 (wiring filter, sort, and pagination to that real data, with its own defined semantics: All Matches / High Match `>= 70` / Low Match `< 70`, sort by Match Score / Newest / Oldest, 20 rows per page, text search by company or title).

An earlier draft of this spec, produced before feature 11 was cross referenced against `build-plan.md`, made the filter, sort, and pagination controls fully interactive against a client side mock array, using invented semantics (90/80 score bands for filtering, 6 rows per page, high to low/low to high sort). A cross check pass caught that this duplicates feature 11's job with different, incompatible rules, meaning that work would likely be discarded and rebuilt once feature 11 lands. The engineer confirmed, once this was surfaced, that feature 09 should stay UI only per the literal `build-plan.md` scope, leaving all real interactivity to feature 11.

## Options considered

### Option 1: Fully static UI, no interactivity

The page matches the design exactly: 6 fixed mock rows, a Find Jobs button that reveals the results area, and filter/sort/pagination controls that render correctly but do nothing when used. No client side data manipulation logic is built.

**Pros**:
- Builds nothing that feature 11 will discard or contradict; a clean handoff
- Matches `build-plan.md`'s literal feature 09 scope ("UI with mock data, no logic yet") and feature 11's separate, already defined scope
- Smaller surface to build, review, and test than any interactive option

**Cons**:
- Feels visibly unfinished when demoed (typing in the filter, clicking a dropdown, or paging does nothing)
- Can't be used to preview or sanity check the table with more than the 6 rows the design shows

### Option 2: Full interactivity now, using feature 11's real semantics

Instead of inventing filter/sort/pagination rules, build the exact behavior feature 11 specifies (High/Low Match at 70%, Match Score/Newest/Oldest sort, 20 rows per page, text search) against a larger mock dataset now, so feature 11 only has to swap the data source.

**Pros**:
- No wasted rework: feature 11 becomes a pure data source swap
- Fully demoable and testable interaction, closer to the real experience sooner

**Cons**:
- Pulls a materially large piece of feature 11's scope (its whole logic surface) into a feature `build-plan.md` scopes as UI only, blurring the project's own phase boundaries and making feature 11's later "done when" harder to state cleanly (what's left for it to do?)
- Requires generating a larger, more elaborate mock dataset than the design shows, and deciding tie breaking, empty states, and other logic details that are really feature 11's decisions to make, not this feature's

### Option 3: Fully interactive now, using invented semantics (the earlier draft)

Build filter/sort/pagination as functional against a mock array, but with semantics decided independently of feature 11 (90/80 score bands, 6 rows per page).

**Pros**:
- Fully demoable sooner, without waiting to read feature 11's spec closely

**Cons**:
- Directly contradicts feature 11's already defined semantics in `build-plan.md`; this logic would need to be thrown out and rebuilt, not extended, once feature 11 is designed and built
- The engineer never asked for interactivity that diverges from the project's own existing plan; this was a process miss, not a considered tradeoff

## Rationale

Option 1 was chosen because it is the only option that doesn't fight the project's own phase boundaries. `build-plan.md` already gives feature 11 clear ownership of filter/sort/pagination semantics; anything this feature builds ahead of that either has to guess those semantics right (Option 2, which pulls forward work and decisions that belong to feature 11) or guesses them wrong (Option 3, the earlier draft, confirmed wrong by the cross check against `build-plan.md`). Option 1's cost, a page that looks finished but doesn't yet respond to input, is temporary and expected: it is resolved by feature 11 shipping next, which `context/progress-tracker.md` will show as the very next phase 3 feature after this one. The mock data shape still mirrors the real `jobs` table (including fields this page doesn't render, like `location` and `externalApplyUrl`) so no time is lost when feature 10 and 11 build on top of it.

## References

Not included; the engineer opted out of a References section for this spec (reuses the existing stack entirely, no new external tools or providers).
