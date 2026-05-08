# Joby v1.5 — Engagement & Rewards Upgrade

## Status Legend
- [ ] Not started
- [~] In progress
- [x] Done

---

## Features

| # | Feature | Status |
|---|---------|--------|
| 1 | Brain Dump Inbox | [x] |
| 2 | Confetti / completion animation | [x] |
| 3 | Streak counter (header badge) | [x] |
| 4 | Calendar heatmap (Stats tab) | [x] |
| 5 | Motivational / context-aware taglines | [x] |

---

## 1 — Brain Dump Inbox

### What
A quick-capture zone for fleeting thoughts. No priority, no category required.
Triage later by promoting to a real task.

### UX
- Fixed ⚡ FAB button (bottom-right, always visible on all tabs)
- Clicking opens a minimal capture modal: textarea + Enter/Capture button
- Keyboard shortcut: `Space` when no input is focused opens capture
- Captured items stored in `inboxItems[]` array in OPFS
- Inbox panel in My Tasks tab (collapsible, above task controls)
  - Each inbox card shows text + captured time
  - Actions: **→ Add to Tasks** (opens edit modal pre-filled), **🗑 Delete**
  - Count badge on the collapse header ("📥 Inbox (3)")

### Data
```json
"inboxItems": [
  { "id": 1234567890, "text": "Look into the new API docs", "capturedAt": "2026-05-08" }
]
```

### Key functions
- `openCapture()` / `closeCapture()` / `saveCapture()`
- `renderInbox()`
- `promoteInboxItem(id)` → pre-fills add-task form and removes from inbox
- `deleteInboxItem(id)`

---

## 2 — Confetti / Completion Animation

### What
A burst of coloured confetti particles fires from the task checkbox when a task
is marked done. A subtle bounce/scale animation plays on the task card.

### Implementation
- Pure JS + CSS — no external libraries
- `fireConfetti(x, y)` spawns ~28 divs with class `.confetti-particle`
- Each particle has random colour (TELUS purple/green + festive accents),
  random trajectory (`--dx`, `--dy` CSS vars), random rotation
- CSS `@keyframes confetti-fly`: translate + rotate + fade in 0.75s, then `el.remove()`
- Task card gets `.task-just-done` class briefly for a scale/glow pulse
- `toggleTask(id, evt)` receives the MouseEvent to get spawn coordinates

### Key CSS
```
.confetti-particle { position:fixed; width:8px; height:8px; border-radius:2px;
  pointer-events:none; z-index:500; animation: confetti-fly 0.75s ease-out forwards; }
@keyframes confetti-fly { to { transform: translate(var(--dx),var(--dy))
  rotate(var(--rot)); opacity:0; } }
@keyframes task-pulse { 0%,100%{transform:scale(1)} 40%{transform:scale(1.03)} }
```

---

## 3 — Streak Counter

### What
Consecutive days with at least one task completed. Shown as 🔥 N in the header.

### Data
```json
"streak": { "current": 5, "lastDate": "2026-05-08", "longest": 12 }
```

### Logic (called from toggleTask when marking done)
1. Get `today` as `en-CA` date string
2. If `streak.lastDate === today` → already counted, skip
3. If `streak.lastDate === yesterday` → `streak.current += 1`
4. Else (gap > 1 day) → `streak.current = 1`
5. Update `streak.lastDate = today`, update `streak.longest`
6. Call `renderStreakBadge()` to update header

### Display
- Header badge next to save indicator: `🔥 5` (hidden when streak = 0)
- Tooltip: "5-day streak! Longest: 12 days"
- Pulse animation when streak increments

### Also: completionLog
```json
"completionLog": { "2026-05-08": 4, "2026-05-07": 7 }
```
Incremented by `logCompletion()` on every task-done toggle.
Used by both streak logic and heatmap.

---

## 4 — Calendar Heatmap

### What
GitHub-style contribution grid. 13 weeks × 7 days, coloured by tasks completed.
Lives in a new **📊 Stats** tab.

### Layout
```
     May           Apr           Mar  ...
Mon  □ □ □ □ □ □ □ □ □ □ □ □ □
Tue  □ ...
...
Sun  □ ...
```
- Each cell: 14×14px square, 3px gap, rounded corners
- Colour scale (TELUS purple):
  - 0 tasks  → `var(--border)` (neutral grey)
  - 1–2      → purple 20% opacity
  - 3–5      → purple 50% opacity
  - 6–9      → purple 80% opacity
  - 10+      → `var(--purple)` full
- Hover tooltip shows date + count
- Month labels above grid

### Stats cards below heatmap
- Current streak / Longest streak
- Tasks completed this week / this month / all time
- Most productive day of week (e.g. "You tend to crush it on Tuesdays 💪")
- Completion rate (done / total tasks ever created)

### Key functions
- `renderHeatmap()` — called when Stats tab opens
- `switchTab()` updated to call it

---

## 5 — Motivational / Context-Aware Taglines

### What
The existing rotating tagline in the header becomes context-aware.
Priority order for message selection:

1. **Milestone just hit**: "🔥 7-day streak — you're on fire!"
2. **Active streak**: "🔥 {n} days in a row — keep it going!"
3. **Strong yesterday**: "You crushed {n} tasks yesterday 💪"
4. **Good today**: "{n} done today already — nice pace! 🎯"
5. **Inbox items waiting**: "{n} ideas waiting in your inbox 💡"
6. **Static taglines** (existing list) — fallback

### Implementation
- Replace the static `lines[]` array lookup with `getMotivationalTagline()`
- Function reads `streak`, `completionLog`, `inboxItems` at call time
- Rotation interval stays at 5 minutes
- On streak milestone (3, 7, 14, 30 days) → show milestone message immediately

---

## Data Model — v1.5

```json
{
  "version": "1.5",
  "tasks": [ ...existing... ],
  "inboxItems": [ { "id": 0, "text": "", "capturedAt": "" } ],
  "completionLog": { "YYYY-MM-DD": 0 },
  "streak": { "current": 0, "lastDate": "", "longest": 0 },
  "settings": { ...existing... },
  "promotedJiraIds": []
}
```

`normalizeSettings` → keep as-is (settings unchanged)
`normalizeData` (new helper) → fills in missing top-level keys for old saves

---

## Implementation Order

1. [x] Write this plan file
2. [x] Data model: add inboxItems, completionLog, streak to state + payload + normalize
3. [x] Streak counter: updateStreak(), logCompletion(), renderStreakBadge(), header badge HTML
4. [x] Confetti: fireConfetti(), CSS keyframes, update toggleTask signature
5. [x] Motivational taglines: getMotivationalTagline() replaces static array
6. [x] Brain Dump Inbox: FAB, capture modal, inbox panel HTML+CSS+JS
7. [x] Stats tab: tab button, tab div, renderHeatmap(), stats cards
8. [x] Final: bump version to 1.5, update this file

---

## Resumption Notes
_If context is lost, resume from the first unchecked item in Implementation Order above._
_All code lives in a single file: `Work Task Tracker.html`_
_Backup of pre-v1.5 code exists (user confirmed)._
