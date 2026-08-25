# Joby — Wishlist & Nice-to-Haves

Low-priority ideas and non-bug improvements. Not scheduled, just tracked.

---

## UX / Accessibility

- **Custom date picker (full i18n)** — Chrome's native calendar popup language follows the browser's system setting, not the page `lang` attribute. Joby's language toggle already translates the input format (`dd/mm/yyyy`) and the rest of the UI, but the calendar popup day names / month names / buttons (Clear, Today) stay in the browser language. A custom-built date picker would give full control. Low priority since most users' system language will match their preferred Joby language anyway.

---

## Features

- **More Joby (octopus mascot) moods and moves** — shipped 2026-08-21 (see README changelog and `docs/superpowers/specs/2026-08-21-joby-animations-design.md` for what's already live). Still deferred: sunglasses (needs a new eye-level render slot, not the existing head-hat anchor), a 30-day streak tier with a sparkle overlay, and a dedicated animated pose for Digest-awareness (currently bubble-only).
- **Holiday-aware streaks** — `updateStreak()` (`js/tasks.js`) already treats weekends as non-breaking in Work mode via `prevWorkday()` (`js/utils.js`), but that function only skips Sat/Sun — a statutory holiday still breaks the streak today. Needs a decision on approach (a fixed holiday-date list vs. a simpler "one extra grace day" heuristic) before building.

---

## Build / Dev

*(nothing yet)*
