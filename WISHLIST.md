# Joby — Wishlist & Nice-to-Haves

Low-priority ideas and non-bug improvements. Not scheduled, just tracked.

---

## UX / Accessibility

- **Custom date picker (full i18n)** — Chrome's native calendar popup language follows the browser's system setting, not the page `lang` attribute. Joby's language toggle already translates the input format (`dd/mm/yyyy`) and the rest of the UI, but the calendar popup day names / month names / buttons (Clear, Today) stay in the browser language. A custom-built date picker would give full control. Low priority since most users' system language will match their preferred Joby language anyway.

---

## Features

- **More Joby (octopus mascot) moods and moves** — a teammate noticed Joby and asked if more animations are planned. Shipped 2026-08-21 across three rounds (see `docs/superpowers/specs/2026-08-21-joby-animations-design.md`): bulk-complete reaction, time-of-day-weighted idle moves, a Santa hat (December) and sun hat (June–August) in the rotation, a streak≥7 bias toward the crown hat, Digest-awareness bubble nudge + bigger combined celebration when Tasks and Digest are both clear, click-to-pet, swappable color skins (`window.setJobySkin()`: classic/neon/matcha/pastel/sunset/boba/cyberpunk), a `detective` hat, double-click-to-spin, and 9 more idle animations in total (reading, juggling, bubble-blowing, workout, laptop, sticky-note, magnifying-glass, plant-watering, paper-airplane). Along the way, fixed two pre-existing gaps that predate this week's work: `coffeeBreak` and `spinAround` had been sitting in the move pool since the original build with no actual visual. Deferred for later: sunglasses (needs a new eye-level render slot, not the existing head-hat anchor), a 30-day streak tier with a sparkle overlay, and a dedicated animated pose for Digest-awareness (currently bubble-only).
- **Holiday-aware streaks** — `updateStreak()` (`js/tasks.js`) already treats weekends as non-breaking in Work mode via `prevWorkday()` (`js/utils.js`), but that function only skips Sat/Sun — a statutory holiday still breaks the streak today. Needs a decision on approach (a fixed holiday-date list vs. a simpler "one extra grace day" heuristic) before building.

---

## Build / Dev

*(nothing yet)*
