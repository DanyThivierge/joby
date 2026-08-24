# Lean Reminders Panel — design

Source: Dany's design doc (`Lean_Reminders_Panel_Design_Doc.md`, Google Drive,
`00_Personal/Dany/`), reviewed and refined in conversation on 2026-08-24. This
file captures the decisions actually being built against, not a copy of the
full doc — see the original for the full context/rationale.

## What this is

A left-docked panel on the Digest tab that surfaces Lean vocabulary/prompts
while people work through tickets — a nudge, not a training module or a
compliance feature. Full detail in the source doc; the parts resolved here
are the ones the doc left open.

## Decisions

- **Persistence**: a dedicated localStorage key, not routed through
  `js/storage.js`'s OPFS-backed settings payload (that pipeline has an
  explicit whitelisted field list; Digest already keeps its own persistence
  path separate from it, same reasoning applies here). Two independent keys:
  - `joby-lean-collapsed` (`'1'` / absent) — inline expand/collapse toggle on
    the panel itself.
  - `joby-lean-hidden` (`'1'` / absent) — Settings-only "Show Lean reminders"
    checkbox. Independent of the collapsed state: un-hiding restores
    whichever of expanded/collapsed was last set.
- **Content**: a hardcoded JS data module for v1 (`js/lean-panel.js`), using
  the doc's §4.4 starter set verbatim. No admin UI, no Drive-file-backed
  content store — explicitly not worth building until the content library
  actually grows past what's easy to hand-edit in a file.
- **Desktop only.** No mobile/responsive treatment. Not hidden on narrow
  viewports, just not designed for them — consistent with the doc's own
  call that this isn't used on mobile.
- **Layout**: the Digest tab's content becomes a flex row — this new
  sidebar on the left, the existing stats bar + toolbar + ticket list in a
  column to its right. The save-failure warning banner (shipped earlier
  today) stays full-width above that row, not scoped to either column — a
  connectivity problem affects the whole tab, not just the ticket list.
- **Rotation**: two pools, Continuous Improvement Focus entries weighted to
  appear roughly 2x as often as Quick Prompts (duplicate-entries-in-the-pool
  trick, same technique already used for Joby's hat/move rotation odds).
  Auto-advances once per page load, then every 15-20 min while the tab
  stays open. A "Next" button steps through one combined, unweighted,
  sequential list (all Continuous Improvement entries, then all Quick
  Prompts) — for skimming on demand, independent of the timer.
- **Collapsed state**: ~32px vertical strip, icon + accent color, click to
  re-expand.
- **Visual**: reuses existing Joby card styling (white card, thin border,
  `var(--radius-card)`); header uses the green/purple accent already used
  elsewhere, not an alert color.

## Non-goals (unchanged from source doc)

No training module, no waste-scoring/gamification, no read-tracking
telemetry.
