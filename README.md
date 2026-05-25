# Joby — Task Tracker

A self-contained task tracker for work and personal use. Runs entirely in the browser — no install, no sign-in, no cloud dependency.

---

## Features

### Work / Personal Mode

- **Mode toggle** in the header (📋 Work / 🌿 Personal) — compact pill, always visible
- Each mode has completely independent data: tasks, stats, streaks, inbox, and theme
- **Work categories** — Work, Dev, Meeting, Review, Admin, Jira, Other
- **Personal categories** — Home, Chores, Shopping, Health, Finance, Family, Car, Study, Garden, Errands, Personal
- Sort preference and compact view saved separately per mode
- Jira tab hidden in Personal mode
- Logo swaps automatically: TELUS logo in Work mode, Joby logo in Personal mode
- **Home-only build** (`node build.js --home`) strips the Work mode UI entirely — ideal for a shared family device

### My Tasks

- Add tasks with priority (High / Medium / Low), category, due date, colour tag, and optional notes
- Filter by All / Pending / Done / High Priority / Overdue
- Search and sort (by date added, priority, due date, or A–Z)
- Drag and drop to reorder tasks
- **Drag right to indent** — create visual subtasks up to 3 levels deep; sort keeps subtasks with their parent; L-shaped dot connectors show the parent→child relationship
- **Parent completion guard** — cannot mark a parent done while children are still open
- Progress bar showing completion percentage
- Edit tasks inline via modal
- **Soft delete with 5-second undo** — deleting a task shows an Undo button in the toast; removal is only committed to storage after the window expires
- Speech-to-text input (mic button — Chrome / Edge)
- **Ghost row** — press `n` or click `+ Add a task…` to expand the inline add form; press Escape to collapse
- Export task list to CSV
- Import / Export full backup as JSON
- Overdue tasks get a full red border

### Recurring Tasks

- Mark any task as **Daily / Weekly / Bi-weekly / Monthly** using the repeat selector
- On completion, the task automatically resets: both the creation date and the due date slide forward by the repeat interval, preserving the original lead-time buffer
- A ↻ badge appears on recurring task cards

### Compact View

- **≡ Compact** toggle in the filter bar collapses all tasks to single-line rows — priority dot, category, due date, and 📎/↻ indicators remain visible
- Click any compacted task row to expand it inline and see notes, badges, and the added date; click again to collapse
- Preference is saved and restored between sessions

### Themes & Customisation

18 built-in presets covering a range of aesthetics:

| Preset | Style |
| --- | --- |
| Default | TELUS Health brand (purple + green) |
| LCARS | Star Trek LCARS interface |
| Outer Rim | Dark sci-fi red |
| Don't Panic | Deep space amber |
| Knight Rider | Black-on-black red scanner |
| Sakura | Soft cherry blossom pink |
| Enchanted Forest | Soft blue-purple |
| Synthwave | Neon pink retro |
| Coffee House | Warm espresso |
| Island Vacation | Sandy teal |
| Pip-Boy | Fallout terminal green |
| Steampunk | Victorian copper |
| Midnight Dev | Hacker black-violet |
| Executive Silver | Corporate navy |
| Nord | Arctic blue-grey |
| Dracula | Classic dark purple |
| Solarized | Warm light base |
| Deep Ocean | Bioluminescent teal |

**Custom Theme Studio** — radius slider (square → round) and colour pickers for background, card, and accent; changes layer on top of any preset and persist independently.

- Dark/light mode toggle is hidden when a named preset is active (the preset owns its mode)
- Remove the active theme from the Settings modal to return to Default

### Sidebar Stats (always visible)

The left sidebar shows everything at a glance without switching tabs:

- **Task counts** — Total, Pending, Completed, High Priority, Overdue + progress bar
- **Productivity cards** — Current streak, completions this week / this month / all time, completion rate, most productive day of the week
- **Activity heatmap** — 13-week GitHub-style grid in TELUS purple; updates live as tasks are completed

### Brain Dump Inbox ⚡

- Fixed **⚡ FAB button** (bottom-right, always visible) opens a quick-capture modal
- Press **Space** (when no input is focused) to open capture instantly
- Captured items appear in a collapsible **📥 Inbox** panel in the sidebar
- Each inbox item can be **promoted to a task** (pre-fills the add form) or deleted

### Engagement & Rewards

- **🔥 Streak counter** — consecutive days with at least one task completed; shown as a badge in the header; pulses when it increments; milestone flashes at 3/7/14/30 days
- **Confetti** — 28 coloured particles burst from the checkbox when you mark a task done
- **Context-aware taglines** — the header tagline prioritises streak milestones, active streaks, strong performance, and inbox items before falling back to static lines

### Jira Integration

- Connects to your Atlassian instance via a local Python proxy (no API token required, bypasses corporate CORS/SSO restrictions)
- Fetches issues assigned to you: unresolved, In Progress or To Do
- **Visual JQL builder** — checkboxes for assignee, resolution, status (with NOT toggle), priority, updated timeframe, and project filter; live JQL preview
- Custom JQL override field — disables the builder automatically when filled; ✕ button to clear
- Filter Jira issues by status, priority, and project
- Promote any Jira issue to My Tasks with one click — auto-fills title, priority, due date, and a link back to the issue
- Promoted issues are tracked so you don't double-add them
- Pagination for large backlogs

### Persistence & Saving

- Uses the **Origin Private File System (OPFS)** to save tasks locally — survives browser cache clears, no permission prompts
- Falls back to `localStorage` automatically (works when opening the file directly without a server)
- Auto-saves on every change (800ms debounce)
- Save indicator in the header (green = saved, amber = saving, red = failed)

---

## Setup

### Requirements

- Chrome or Edge (recommended — required for speech-to-text; OPFS requires a served URL)
- Python 3 (for the Jira proxy)
- Any local web server to get OPFS persistence (e.g. [VSCode Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer))

> **No server?** Opening `dist/Work Task Tracker.html` directly from the file system works fine — tasks save to `localStorage` and all features work except OPFS. The save indicator will show "Saved" correctly in either mode.

### Getting Started

1. Open the `Task Organizer` folder in VSCode
2. Right-click `Work Task Tracker.html` → **Open with Live Server**
3. Start adding tasks — data saves automatically

Or open `dist/Work Task Tracker.html` directly in your browser for a zero-setup experience.

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

1. Copy the `Task Organizer` folder (or share the `dist/Work Task Tracker.html` build)
2. Run `python jira-proxy.py` in a terminal
3. Open the tracker
4. Go to Settings → paste their own Jira cookie → **Update Cookie**

The `jira-cookie.txt` file that gets created is personal — do not share it.

---

## File Structure

```text
Task Organizer/
├── Work Task Tracker.html   # App shell — open this in Live Server
├── css/
│   └── styles.css           # All styles
├── js/
│   ├── constants.js         # Magic strings, numbers, config (load first)
│   ├── state.js             # Global mutable state (tasks, settings, streak, inbox, compactView)
│   ├── utils.js             # Helpers: escHtml, linkify, toast, date helpers, recurrence
│   ├── theme.js             # 18 theme presets, Custom Studio, dark/light toggle, speech-to-text
│   ├── colors.js            # Color swatch UI
│   ├── storage.js           # OPFS + localStorage persistence, export/import
│   ├── tasks.js             # Task CRUD, streak, confetti, recurring reset, edit modal
│   ├── render.js            # Task list rendering, tabs, stats bar, compact view, CSV export
│   ├── drag.js              # Drag-and-drop reorder + indent detection
│   ├── jira.js              # Jira integration, JQL builder, proxy calls
│   ├── inbox.js             # Brain Dump capture modal and inbox panel
│   ├── stats.js             # Heatmap, sidebar stats cards, motivational taglines
│   └── main.js              # Keyboard shortcuts + app boot
├── dist/
│   ├── Work Task Tracker.html  # Standard build (run: node build.js)
│   ├── gas/
│   │   ├── Index.html          # Google Apps Script build — logos embedded as base64
│   │   └── Code.gs             # GAS entry point (doGet)
│   └── home/
│       └── Joby Home.html      # Personal-only build — no Work mode, no Jira
├── build.js                 # Bundle script — inlines CSS + JS, outputs to dist/
├── jira-proxy.py            # Local proxy for Jira API access
├── jira-cookie.txt          # Your personal session cookie (auto-created, do not share)
├── th_logo_en.png           # TELUS Health logo (light mode — Work)
├── telus_logo_dark.png      # TELUS Health logo (dark mode — Work)
├── Joby_logo.png            # Joby logo (Personal mode)
├── Joby_logo_dark.png       # Joby logo dark variant (optional — falls back to Joby_logo.png)
├── favicon.png              # Browser tab icon
└── README.md
```

### Production build

Three build targets, all zero-dependency (Node.js built-ins only):

```text
node build.js           → dist/Work Task Tracker.html      Full app, local use
node build.js --gas     → dist/gas/Index.html + Code.gs    Google Apps Script deploy
node build.js --home    → dist/home/Joby Home.html         Personal-only, no Work / Jira
```

The `--gas` build embeds all logo images as base64 data URIs so they work without a local file server. The `--home` build locks the app to Personal mode and strips the Work toggle and Jira tab.

---

## Save Data Format

Tasks and settings are stored in OPFS — `work-tasks.json` for Work mode and `personal-tasks.json` for Personal mode. Both files share the same schema:

```json
{
  "version": "1.7",
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
      "color": "",
      "recurFreq": null
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
    "jiraProjects": "",
    "themePreset": "default",
    "themeCustom": {},
    "compactView": false,
    "sortPreference": "added"
  },
  "promotedJiraIds": ["1366029", "1362011"]
}
```

---

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `n` | Open the inline add-task form |
| `Space` | Open the Brain Dump capture modal |
| `Escape` | Close any open modal or form |
| `Tab` (on task checkbox) | Indent the task one level |
| `Shift+Tab` (on task checkbox) | Dedent the task one level |
| `Alt+↑ / Alt+↓` | Move the focused task up or down |
| `Enter` (in task input) | Add the task |

---

## Changelog

### v1.7 (2026-05-25)

- **Work / Personal mode toggle** — header pill (📋 / 🌿) switches between two fully independent contexts: separate OPFS files, tasks, stats, streaks, inbox, and theme; Jira tab hidden in Personal mode
- **Personal categories** — Home, Chores, Shopping, Health, Finance, Family, Car, Study, Garden, Errands, Personal; dropdowns repopulate on mode switch
- **Per-mode preferences** — sort order and compact view each saved independently per mode
- **Logo swap on mode switch** — TELUS logo in Work mode, Joby logo in Personal mode; respects dark/light theme
- **Home-only build** (`node build.js --home`) — Personal-mode-only single-file build with Work toggle and Jira tab removed; Joby logo embedded as base64
- **GAS build logo embed** — `node build.js --gas` now embeds all logos as base64 data URIs so they display without a local file server
- **Theme logo visibility** — added white drop-shadow glow to Outer Rim, Synthwave, Dracula, Deep Ocean, and Nord so logos read clearly on dark backgrounds

### v1.6 (2026-05-25)

- **Theme system** — 18 built-in presets (LCARS, Outer Rim, Don't Panic, Knight Rider, Sakura, Enchanted Forest, Synthwave, Coffee House, Island Vacation, Pip-Boy, Steampunk, Midnight Dev, Executive Silver, Nord, Dracula, Solarized, Deep Ocean, Default); presets define colours, border radius, and fonts; Custom Theme Studio adds a radius slider and bg/card/accent pickers that layer on top of any preset; dark/light toggle hidden when a named preset is active; "Remove theme" button in Settings
- **Recurring tasks** — Daily/Weekly/Bi-weekly/Monthly; both `createdAt` and `dueDate` advance by the repeat interval on completion, preserving the original lead-time buffer; 1.6s reset delay so confetti completes; ↻ badge on recurring cards
- **Subtask dot connectors** — purple dot marker + L-shaped CSS line visually connects subtasks to their parent
- **Compact view** — ≡ Compact toggle in the filter bar; single-line task rows with inline priority dot, category, due date, and 📎/↻ indicators; click a row to expand it inline; preference persisted in settings
- **Stats always visible** — activity heatmap and productivity cards (streak, weekly/monthly/all-time completions, completion rate, best day) moved to the left sidebar; Stats tab removed
- **Font split** — `--font-app` applies only to the app name in the header; `--font-body` controls all task/body text; prevents decorative theme fonts (e.g. Impact) from inflating task text
- **Save indicator fix** — "Save failed" no longer appears when running from a `file://` URL; localStorage success is correctly treated as saved

### v1.5 (2026-05-08)

- **Brain Dump Inbox** — ⚡ FAB button + Space shortcut to capture fleeting thoughts; collapsible inbox panel in the sidebar; promote to task or delete
- **Streak counter** — 🔥 header badge for consecutive days with completions; pulses on increment; milestone flashes at 3/7/14/30 days
- **Confetti** — particle burst on task completion (pure CSS + JS, no libraries)
- **Context-aware taglines** — header tagline checks streak, yesterday's output, today's pace, and inbox count before falling back to static lines
- **Stats tab** — 13-week GitHub-style activity heatmap + stat cards (streak, weekly, monthly, all-time, most productive day)
- **Unmark fix** — unchecking a task correctly decrements `completionLog` and recomputes the streak from scratch
- Task `doneAt` field tracks which day a task was completed
- **Multi-file refactor** — split from one 1,864-line HTML into `css/styles.css` + 13 JS modules; zero behaviour changes
- **`constants.js`** — all magic strings, numbers, and config in one place
- **`build.js`** — zero-dependency Node.js bundle script
- **Soft delete with undo** — 5-second undo toast before removal is committed

### v1.4 (internal)

- Task colour picker (7 light-shade colours + none)
- Visual subtask indentation via drag (up to 3 levels); subtasks sort with their parent
- Parent completion guard
- Overdue tasks: full red border
- Settings modal widened; Export/Import/CSV moved inside Settings

### v1.2 (2026-05-07)

- Renamed app to **Joby** with rotating taglines
- Replaced API token auth with local Python proxy using browser session cookie
- TELUS Health brand colours and official logo
- Dark mode overhaul — deep navy palette

### v1.1 (2026-05-06)

- Jira tab: issue fetch, filters, promote-to-task
- OPFS persistence
- Settings panel with Jira connection test
- Speech-to-text input

### v1.0

- Initial release: task list, priorities, categories, due dates, drag-and-drop, CSV export, dark mode
