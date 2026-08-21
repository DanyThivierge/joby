# Joby (octopus mascot) — more moods, moves, and status awareness — design

## Problem

A teammate testing the Digest badge feature noticed Joby (the SVG octopus
mascot, `js/tamagoshi_svg.js`) and asked whether more animation variety is
planned. Feedback was vague — "more diversity, more movements, more idle
animations" — so this spec turns that into five concrete additions, picked
to reuse existing mechanisms (mood system, hat rotation, boredom moves,
speech bubbles) rather than building new infrastructure.

Joby already has: 8 moods driven by real task state, 9 idle "boredom" moves,
6 rotating hats, and a treat-feeding reaction on task completion
(`tamaTaskDone` / `tamaAllDone`, called from `toggleTask()` in `js/tasks.js`).

## Scope for this pass

All five, since the request was "as much as possible." Ordered by how much
new art/logic each needs:

### 1. Bulk-complete celebration (gap fix)

`bulkComplete()` in `js/tasks.js` currently calls no Joby hook at all —
not even the single-treat reaction `toggleTask()` gives you. Fix:
- Bulk-completing exactly 1 task → same `tamaTaskDone(null)` reaction as
  the single-checkbox path (parity, no click position available in bulk
  context).
- Bulk-completing 2+ → new `tamaBulkDone(count)`: reuses the existing
  "party" sparkle rendering (already built for the all-clear celebration)
  for a shorter burst (`partyFrames = 30` vs. all-clear's 60), so it's
  visibly bigger than a single treat but distinct from clearing your whole
  list. Bubble: "🎉 Nice, N done!"
- If the bulk-complete also empties the whole list, `tamaAllDone()` fires
  instead (same priority order `toggleTask()` already uses).

### 2. Time-of-day flavor (no new art)

`RARE_MOVES` is a flat uniform-random pick today (`js/tamagoshi_svg.js`,
the boredom-selection block). Bias it by local hour instead of adding new
poses: `coffeeBreak` more likely in the morning (6–11), the existing
`stretch` (yawn) move more likely in late afternoon/evening (16–20).
Implemented as extra duplicate entries in the pool for the relevant hours
— reuses `Math.random()` picking a wider array, no new selection algorithm.

### 3. Seasonal hats

Existing hats are minimalist single-stroke line art (`drawHat()`), not
filled/colored images — so new hats need to match that style, not be a
different kind of asset. Two additions, both fitting the existing
head-hat anchor (no new render slot, which is why sunglasses — an
eye-level accessory — were cut from this pass):
- **Santa hat** — December only (`new Date().getMonth() === 11`), joins
  the rotation pool alongside the existing 6.
- **Sun hat** — June–August, same mechanism.

Neither replaces the random rotation — they're additional options Joby
might pick, same as any other hat.

### 4. Streak-tier hat bias (no new art)

At `streak.current >= 7`, bias the hat pool toward the existing `crown`
hat (duplicate entries, same mechanism as the seasonal hats) rather than
inventing a new "trophy" hat. A higher 30-day tier with an extra visual
(e.g. sparkle overlay) was considered and cut for this pass — the
existing `drawSparkles()` is tuned for the party-mood's sparkle density
and would need rework to look right outside that context; not worth the
risk for this slice.

### 5. Digest-awareness (new cross-module hook)

Joby currently has no idea the Digest tab exists. Rather than a whole new
animated pose (highest-effort option), this ships as:
- `digest.js`'s `renderDigestTabBadge()` reports its open-item total to a
  new `window.tamaSetDigestPending(n)` hook after every render.
- When that count is > 0, Joby occasionally (low frequency, independent of
  the boredom-move state machine) shows a bubble: "🔔 psst, N waiting in
  your Digest" — using the same `showBubble()` mechanism as the existing
  "Yummy! ⭐" / "ALL DONE!" messages, so no new rendering code.
- `tamaAllDone()` checks whether Digest is *also* at zero. If so, it fires
  a longer celebration (`partyFrames = 90` vs. 60) with a distinct bubble
  ("🎉🐙 Tasks AND Digest clear! Amazing!") instead of a new pose.

This gives Joby a reaction to the whole app, not just the Tasks tab,
without a new body-pose asset.

## Non-goals (this pass)

- Sunglasses / any accessory needing a render slot other than the
  existing head-hat anchor.
- A dedicated new animated pose for Digest-awareness (bubble-only for v1).
- Scaling the bulk-celebration visual by count (flat burst regardless of
  how many were completed — the difference isn't perceptible in practice).
- A 30-day streak tier beyond the crown-bias.

## Testing

No automated test suite for this module (consistent with the rest of the
project). Manual verification: trigger each path in a running instance
(bulk-complete 1 and 3+ tasks, force the system clock or stub
`new Date()` to check December/summer hat pools, set a streak ≥ 7, and
drive `digestItems` to a non-zero and then zero open count) and confirm
visually via the browser preview that new hats render as valid, non-broken
SVG shapes and existing moods/moves are unaffected.
