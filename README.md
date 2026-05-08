# Joby — Work Task Tracker

A self-contained task tracker built for daily work use at TELUS Health. Runs entirely in the browser — no install, no sign-in, no cloud dependency.

---

## Features

### My Tasks

- Add tasks with priority (High / Medium / Low), category, due date, colour tag, and optional notes
- Filter by All / Pending / Done / High Priority / Overdue
- Search and sort (by date added, priority, due date, or A–Z)
- Drag and drop to reorder tasks
- **Drag right to indent** — create visual subtasks up to 3 levels deep; sort keeps subtasks with their parent
- **Parent completion guard** — cannot mark a parent done while children are still open
- Progress bar showing completion percentage
- Edit tasks inline via modal
- **Soft delete with 5-second undo** — deleting a task shows an Undo button in the toast; removal is only committed to storage after the window expires
- Speech-to-text input (mic button — Chrome / Edge)
- Export task list to CSV
- Import / Export full backup as JSON
- Overdue tasks get a full red border

### Brain Dump Inbox ⚡

- Fixed **⚡ FAB button** (bottom-right, always visible) opens a quick-capture modal
- Press **Space** (when no input is focused) to open capture instantly
- Captured items appear in a collapsible **📥 Inbox** panel above the task list
- Each inbox item can be **promoted to a task** (pre-fills the add form) or deleted
- Inbox count shown in the panel header

### Engagement & Rewards

- **🔥 Streak counter** — consecutive days with at least one task completed; shown as a badge in the header; pulses when it increments
- **Confetti** — 28 coloured particles burst from the checkbox when you mark a task done
- **Context-aware taglines** — the header tagline prioritises streak milestones, active streaks, strong performance, and inbox items before falling back to static lines
- **📊 Stats tab** — GitHub-style 13-week activity heatmap (TELUS purple colour scale) + stat cards: current/longest streak, completions this week / this month / all time, completion rate, most productive day of the week

### Jira Integration

- Connects to your Atlassian instance via a local Python proxy (no API token required, bypasses corporate CORS/SSO restrictions)
- Fetches issues assigned to you: unresolved, In Progress or To Do
- **Visual JQL builder** — checkboxes for assignee, resolution, status (with NOT toggle), priority, updated timeframe, and project filter; live JQL preview
- Custom JQL override field — disables the builder automatically when filled; ✕ button to clear
- Filter Jira issues by status, priority, and project
- Promote any Jira issue to My Tasks with one click — auto-fills title, priority, due date, and a link back to the issue
- Promoted issues are tracked so you don't double-add them
- Pagination for large backlogs

### Persistence

- Uses the **Origin Private File System (OPFS)** to save tasks locally — survives browser cache clears, no permission prompts
- Falls back to `localStorage` as a belt-and-suspenders backup
- Auto-saves on every change (800ms debounce)
- Save indicator in the header (green = saved, amber = saving, red = failed)

### Design

- TELUS Health branding — official logo, purple (`#4b0082`) and green (`#66cc00`) palette
- Light mode and dark mode toggle
- Dark mode inspired by the TELUS I.R.I.S. app — deep navy, vibrant violet accent
- Logo automatically swaps between light and dark variants

---

## Setup

### Requirements

- Chrome or Edge (recommended — required for speech-to-text and OPFS)
- Python 3 (for the Jira proxy)
- [VSCode Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) or any local web server

### Getting Started

1. Open the `Task Organizer` folder in VSCode
2. Right-click `Work Task Tracker.html` → **Open with Live Server**
3. Start adding tasks — data saves automatically

### Jira Setup

The Jira integration uses a lightweight local Python proxy that forwards requests to your Atlassian instance using your browser session cookie. This approach works around corporate SSO and CORS restrictions without requiring IT involvement or API tokens.

#### Step 1 — Start the proxy

Open a terminal in the `Task Organizer` folder and run:

```text
python jira-proxy.py
```

You should see: `Jira proxy running → http://localhost:3333`

Keep this terminal open while using the Jira tab. Cookies expire after ~24 hours — the Settings UI lets you refresh without restarting the proxy.

#### Step 2 — Add your Jira cookie

1. In the tracker, click **⚙ Settings**
2. Expand **"How to get your cookie"** for step-by-step instructions
3. Paste your cookie and click **Update Cookie**
4. Click **Test Proxy** — you should see `✓ Connected as [Your Name]`
5. Click **Save Settings**

#### Step 3 — Load your issues

Switch to the **Jira** tab — your assigned issues load automatically.

### Sharing with Co-workers

Each person needs their own copy of the cookie (cookies are personal session tokens). The workflow is the same for everyone:

1. Copy the `Task Organizer` folder
2. Run `python jira-proxy.py` in a terminal
3. Open the tracker via Live Server
4. Go to Settings → paste their own Jira cookie → **Update Cookie**

The `jira-cookie.txt` file that gets created is personal — do not share it.

---

## File Structure

```text
Task Organizer/
├── Work Task Tracker.html   # App shell — open this in Live Server
├── css/
│   └── styles.css           # All styles (~340 lines)
├── js/
│   ├── constants.js         # Magic strings, numbers, config (load first)
│   ├── state.js             # Global mutable state (tasks, settings, streak, inbox)
│   ├── utils.js             # Helpers: escHtml, linkify, toast, date strings
│   ├── theme.js             # Dark mode + speech-to-text
│   ├── colors.js            # Color swatch UI
│   ├── storage.js           # OPFS + localStorage persistence, export/import
│   ├── tasks.js             # Task CRUD, streak, confetti, edit modal
│   ├── render.js            # Task list rendering, tabs, stats bar, CSV export
│   ├── drag.js              # Drag-and-drop reorder + indent detection
│   ├── jira.js              # Jira integration, JQL builder, proxy calls
│   ├── inbox.js             # Brain Dump capture modal and inbox panel
│   ├── stats.js             # Heatmap, stats cards, motivational taglines
│   └── main.js              # Keyboard shortcuts + app boot
├── dist/
│   └── Work Task Tracker.html  # Single-file production build (run: node build.js)
├── build.js                 # Bundle script — inlines CSS + JS, outputs to dist/
├── jira-proxy.py            # Local proxy for Jira API access
├── jira-cookie.txt          # Your personal session cookie (auto-created, do not share)
├── th_logo_en.png           # TELUS Health logo (light mode)
├── telus_logo_dark.png      # TELUS Health logo (dark mode, optional — falls back to light)
├── favicon.ico              # Browser tab icon
└── README.md
```

### Production build

To generate a single-file bundle for deployment (e.g. sharing with a co-worker who doesn't have Live Server):

```text
node build.js
```

This inlines `css/styles.css` and all 13 JS files into `dist/Work Task Tracker.html`. No npm, no dependencies — just Node.js built-ins.

---

## Save Data Format

Tasks and settings are stored in OPFS as `work-tasks.json`:

```json
{
  "version": "1.5",
  "tasks": [
    {
      "id": 1234567890,
      "text": "Task title",
      "notes": "Optional notes or URL",
      "priority": "high",
      "category": "Work",
      "dueDate": "2026-05-10",
      "done": false,
      "doneAt": null,
      "createdAt": "2026-05-07",
      "indent": 0,
      "color": ""
    }
  ],
  "inboxItems": [
    { "id": 1234567890, "text": "Fleeting thought", "capturedAt": "2026-05-08" }
  ],
  "completionLog": { "2026-05-08": 4, "2026-05-07": 7 },
  "streak": { "current": 5, "lastDate": "2026-05-08", "longest": 12 },
  "settings": {
    "jiraUrl": "https://yourcompany.atlassian.net",
    "jiraJql": "",
    "jiraAssigneeMe": true,
    "jiraUnresolved": true,
    "jiraStatuses": "In Progress,To Do",
    "jiraStatusNot": false,
    "jiraPriorities": "",
    "jiraUpdatedDays": "",
    "jiraProjects": ""
  },
  "promotedJiraIds": ["1366029", "1362011"]
}
```

---

## Changelog

### v1.5 (2026-05-08)

- **Brain Dump Inbox** — ⚡ FAB button + Space shortcut to capture fleeting thoughts; collapsible inbox panel above task list; promote to task or delete
- **Streak counter** — 🔥 header badge for consecutive days with completions; pulses on increment; milestone flashes at 3/7/14/30 days
- **Confetti** — particle burst on task completion (pure CSS + JS, no libraries)
- **Context-aware taglines** — header tagline now checks streak, yesterday's output, today's pace, and inbox count before falling back to static lines
- **📊 Stats tab** — 13-week GitHub-style activity heatmap + stat cards (streak, weekly, monthly, all-time, most productive day)
- **Unmark fix** — unchecking a task correctly decrements `completionLog` for the day it was marked done and recomputes the streak from scratch
- Task `doneAt` field tracks which day a task was completed
- **Multi-file refactor** — split from one 1,864-line HTML into `css/styles.css` + 13 JS modules loaded via `<script src="">` (classic globals, not ES modules — avoids shared-state issues); zero behaviour changes
- **`constants.js`** — all magic strings, numbers, and config values in one place; loaded first so every file can reference them
- **`build.js`** — zero-dependency Node.js bundle script; inlines CSS + JS into a single-file `dist/` HTML for easy sharing
- **Soft delete with undo** — deleting a task shows an Undo toast for 5 seconds; only committed to storage after the window expires
- **Toast/FAB overlap fix** — toast now appears above the ⚡ FAB instead of behind it
- **Dark logo fallback** — if `telus_logo_dark.png` is missing, the logo silently falls back to the light variant (no broken image)

### v1.4 (internal)

- Task colour picker (7 light-shade colours + none), shown on add and edit
- Visual subtask indentation via drag (up to 3 levels); subtasks sort with their parent
- Parent completion guard — blocks marking done if open children exist
- Overdue tasks: full red border on all 4 sides
- Settings modal widened to 700px; Export/Import/CSV moved into Settings menu
- JQL builder: 2-column layout, NOT toggle for statuses
- Browser tab title → "Joby | TELUS Health"
- Jira status "Done" → "Closed"

### v1.2 (2026-05-07)

- Renamed app to **Joby** with rotating taglines in the header
- Replaced API token auth with **local Python proxy** using browser session cookie
- Cookie management moved entirely into the Settings UI — no file editing needed
- Cookie updates apply live without restarting the proxy
- Updated to **TELUS Health brand colors** (`#4b0082` purple, matched to markdown-converter)
- Replaced text logo with **official TELUS Health logo image** (`th_logo_en.png`)
- Added **favicon**
- **Dark mode overhaul** — deep navy palette inspired by TELUS I.R.I.S. app
- Panel headers now have a green bottom border (TELUS brand pattern)
- Step-by-step cookie instructions built into the Settings modal

### v1.1 (2026-05-06)

- Added Jira tab with issue fetch, filters, and promote-to-task
- Added OPFS persistence (replaces File System Access API)
- Added Settings panel with Jira connection test
- Added tab layout (My Tasks / Jira)
- Added JIRA category to task list
- Speech-to-text input via Web Speech API (Chrome / Edge)

### v1.0

- Initial release: task list, priorities, categories, due dates, drag-and-drop, CSV export, dark mode toggle
