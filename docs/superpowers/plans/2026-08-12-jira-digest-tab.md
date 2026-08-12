# Jira Digest Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "Digest" tab to Joby that turns Jira comment/mention/watch activity into a triaged inbox — grouped by epic, bucketed into Review/Fix-Help/FYI, with a To Do/In Progress/Waiting/Done status per item — backed by `docs/superpowers/specs/2026-08-12-jira-digest-tab-design.md`.

**Architecture:** `jira-proxy.py` (already running locally for the existing Jira tab) gains two new endpoints that read/write a `jira-digest.json` file on disk inside a Google-Drive-synced folder, auto-creating it on first use — no OAuth, no Drive API, same pattern as the ARGUS dashboard (`~/.claude/scripts/argus/argus.py`). A new `js/digest.js` module polls Jira through the existing proxy for issues where the user is assignee/watcher, pulls new comments per issue, classifies each with a keyword heuristic, and renders them grouped by epic with per-item status controls. State round-trips through the proxy on every change instead of using OPFS (unlike the rest of Joby).

**Tech Stack:** Vanilla JS (no framework, no build step beyond the existing `build.js` bundler), Python 3 standard library (`http.server`) for the proxy. Joby has no automated test suite; this plan follows the project's existing convention of manual verification against a running proxy and real Jira issues (this was scoped explicitly in the design doc's Testing section) rather than introducing a new test framework.

---

## Task 1: Proxy — Drive-backed digest storage endpoints

**Files:**
- Modify: `jira-proxy.py:14-22` (constants), `jira-proxy.py:45-55` (do_GET/do_POST routing), `jira-proxy.py:91` (new handler methods, inserted after `_handle_set_cookie`)

- [ ] **Step 1: Add the digest folder constants**

In `jira-proxy.py`, after the existing constants (currently lines 20-22:
```python
PORT        = 3333
JIRA_HOST   = 'https://telushealth.atlassian.net'
COOKIE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'jira-cookie.txt')
```
), add:
```python
DIGEST_DIR  = os.environ.get('JOBY_DIGEST_DIR', r'G:\My Drive\Joby\jira-digest')
DIGEST_FILE = os.path.join(DIGEST_DIR, 'jira-digest.json')
```
This mirrors how `argus.py` defaults `PROJECT_HUB` to `G:\My Drive\Project Hub` with an env var override — same Drive-synced-folder pattern, no OAuth.

- [ ] **Step 2: Add the digest read/write handler methods**

In the `JiraProxy` class, immediately after the existing `_handle_set_cookie` method (right before the `# ── Proxy ──` comment), add:
```python
    def _digest_get(self):
        try:
            os.makedirs(DIGEST_DIR, exist_ok=True)
            if not os.path.exists(DIGEST_FILE):
                self._json(200, {})
                return
            with open(DIGEST_FILE, 'r', encoding='utf-8') as f:
                data = f.read()
            body = data.encode('utf-8')
            self.send_response(200)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self._json(500, {'error': str(e)})

    def _digest_post(self):
        length = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(length) if length else b'{}'
        try:
            json.loads(raw)  # validate before writing to disk
            os.makedirs(DIGEST_DIR, exist_ok=True)
            with open(DIGEST_FILE, 'w', encoding='utf-8') as f:
                f.write(raw.decode('utf-8'))
            self._json(200, {'ok': True})
        except json.JSONDecodeError as e:
            self._json(400, {'error': 'Invalid JSON: %s' % e})
        except Exception as e:
            self._json(500, {'error': str(e)})
```

- [ ] **Step 3: Wire the new endpoints into request routing**

Change the existing `do_GET`/`do_POST` (currently lines 45-55):
```python
    def do_GET(self):
        if self.path == '/_status':
            self._status()
        else:
            self._proxy()

    def do_POST(self):
        if self.path == '/_set-cookie':
            self._handle_set_cookie()
        else:
            self._proxy()
```
to:
```python
    def do_GET(self):
        if self.path == '/_status':
            self._status()
        elif self.path == '/digest/data':
            self._digest_get()
        else:
            self._proxy()

    def do_POST(self):
        if self.path == '/_set-cookie':
            self._handle_set_cookie()
        elif self.path == '/digest/data':
            self._digest_post()
        else:
            self._proxy()
```

- [ ] **Step 4: Manually verify the endpoints**

Start the proxy:
```bash
cd "C:/Users/T837039/myCode/Task Organizer" && python jira-proxy.py
```
In a second terminal, verify a fresh read returns `{}` and creates the folder:
```bash
curl -s http://localhost:3333/digest/data
```
Expected: `{}` printed, and `G:\My Drive\Joby\jira-digest` now exists on disk.

Verify a write round-trips:
```bash
curl -s -X POST http://localhost:3333/digest/data -H "Content-Type: application/json" -d '{"lastPolled":"2026-08-12T00:00:00Z","items":{"1":{"issueKey":"TEST-1"}}}'
curl -s http://localhost:3333/digest/data
```
Expected: the second command echoes back the same JSON, and `G:\My Drive\Joby\jira-digest\jira-digest.json` exists with that content.

- [ ] **Step 5: Commit**

```bash
git add jira-proxy.py
git commit -m "feat(digest): add Drive-backed digest storage endpoints to jira-proxy"
```

---

## Task 2: State and constants scaffolding

**Files:**
- Modify: `js/state.js:46` (append), `js/constants.js:17-19` (append near existing timing constants)

- [ ] **Step 1: Add digest state variables**

At the end of `js/state.js` (after line 46, the closing `];` of `TASK_COLORS`), add:
```js

// ── Jira Digest tab ───────────────────────────────────────────────────────────
let digestItems       = {};   // commentId -> digest item (see docs/superpowers/specs/2026-08-12-jira-digest-tab-design.md)
let digestLastPolled  = null; // ISO timestamp of the last successful poll
let digestIsLoading   = false;
let digestMyAccountId = null; // cached Jira accountId of the current user
```

- [ ] **Step 2: Add the poll interval constant**

In `js/constants.js`, after line 19 (`const TAGLINE_INTERVAL_MS = 5 * 60 * 1000;`), add:
```js
const DIGEST_POLL_MS      = 20 * 60 * 1000;
```

- [ ] **Step 3: Verify no syntax errors**

Open `Work Task Tracker.html` in a browser (or via Live Server) and check the DevTools console for errors on load. Expected: no errors — these are unused variable declarations at this point, so the app behaves exactly as before.

- [ ] **Step 4: Commit**

```bash
git add js/state.js js/constants.js
git commit -m "feat(digest): add digest state variables and poll interval constant"
```

---

## Task 3: HTML shell — tab button and tab content

**Files:**
- Modify: `Work Task Tracker.html:45` (tab button), `Work Task Tracker.html:223` (new tab content, inserted after the Jira tab's closing `</div>`), `Work Task Tracker.html:490` (script tag)

- [ ] **Step 1: Add the Digest tab button**

In `Work Task Tracker.html`, change line 45 from:
```html
    <button id="jira-tab-btn" class="tab-btn" onclick="switchTab('jira',this)">&#127919; Jira</button>
```
to:
```html
    <button id="jira-tab-btn" class="tab-btn" onclick="switchTab('jira',this)">&#127919; Jira</button>
    <button id="digest-tab-btn" class="tab-btn" onclick="switchTab('digest',this)">&#128276; Digest</button>
```

- [ ] **Step 2: Add the Digest tab content block**

Immediately after the Jira tab's closing `</div>` (currently line 223, right before the two blank lines and the `<!-- ─── SETTINGS MODAL -->` comment), insert:
```html
<!-- ─── DIGEST TAB ────────────────────────────────────────────────────────────── -->
<div class="main" id="tab-digest" style="display:none">
    <div id="digest-gas-mode" class="jira-no-config" style="display:none">
        <div class="icon">&#128276;</div>
        <p><strong>Jira Digest is only available in local mode.</strong></p>
        <p style="margin-top:8px;font-size:0.88rem;color:var(--text-2)">This hosted version can't reach your Jira proxy. Download the source and run it locally with the proxy for this tab to work.</p>
    </div>
    <div id="digest-no-config" class="jira-no-config" style="display:none">
        <div class="icon">&#9881;&#65039;</div>
        <p>Configure your Jira connection in Settings (Jira tab) first, then come back here.</p>
        <button class="btn btn-purple" onclick="openSettings()">Open Settings</button>
    </div>
    <div id="digest-content" style="display:none">
        <div class="jira-toolbar">
            <button class="jira-refresh-btn" id="digest-refresh-btn" onclick="fetchDigest()">&#128260; Refresh</button>
            <label class="jql-check" style="margin-left:8px"><input type="checkbox" id="digest-show-done" onchange="renderDigest()"> Show done</label>
            <span class="jira-count" id="digest-last-polled"></span>
        </div>
        <div class="task-list" id="digest-list"></div>
    </div>
</div>
```

- [ ] **Step 3: Add the script tag**

Change line 490 from:
```html
<script src="js/jira.js"></script>
```
to:
```html
<script src="js/jira.js"></script>
<script src="js/digest.js"></script>
```

- [ ] **Step 4: Verify the tab appears (inert)**

Open `Work Task Tracker.html` via Live Server. Expected: a new "🔔 Digest" tab button appears next to "🎯 Jira"; clicking it currently does nothing observable yet (no `switchTab` case for it, no `digest.js` content) — DevTools console should show no errors since `js/digest.js` doesn't exist yet as a real file. Create an empty placeholder first if needed:
```bash
touch "C:/Users/T837039/myCode/Task Organizer/js/digest.js"
```
so the `<script>` tag doesn't 404. Reload and confirm no console errors.

- [ ] **Step 5: Commit**

```bash
git add "Work Task Tracker.html" js/digest.js
git commit -m "feat(digest): add Digest tab shell (button, content markup, empty module)"
```

---

## Task 4: Tab switching

**Files:**
- Modify: `js/render.js:4-11`

- [ ] **Step 1: Extend switchTab to handle 'digest'**

Change `js/render.js` lines 4-11 from:
```js
function switchTab(tab, btn) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-tasks').style.display  = tab === 'tasks'  ? '' : 'none';
    document.getElementById('tab-jira').style.display   = tab === 'jira'   ? '' : 'none';
    if (tab === 'jira')  initJiraTab();
}
```
to:
```js
function switchTab(tab, btn) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-tasks').style.display  = tab === 'tasks'  ? '' : 'none';
    document.getElementById('tab-jira').style.display   = tab === 'jira'   ? '' : 'none';
    const digestTab = document.getElementById('tab-digest');
    if (digestTab) digestTab.style.display = tab === 'digest' ? '' : 'none';
    if (tab === 'jira')   initJiraTab();
    if (tab === 'digest') initDigestTab();
}
```
(The `digestTab` null-guard matters once the --home build strips the Digest button in Task 10 — `switchTab('digest', ...)` becomes unreachable there, but this keeps the function itself safe regardless.)

- [ ] **Step 2: Verify clicking the tab switches (still inert content)**

Reload the app, click "🔔 Digest". Expected: the Jira/Tasks tabs hide, an empty `#tab-digest` area shows (blank, since `initDigestTab` doesn't exist yet) — check DevTools console: expect a `ReferenceError: initDigestTab is not defined`. That confirms the wiring is correct and ready for Task 5.

- [ ] **Step 3: Commit**

```bash
git add js/render.js
git commit -m "feat(digest): wire Digest tab into switchTab"
```

---

## Task 5: Core fetch, classification, and merge logic

**Files:**
- Modify: `js/digest.js` (replaces the empty placeholder from Task 3)

- [ ] **Step 1: Write the module header, labels, and tab init**

Write to `js/digest.js`:
```js
// digest.js — Jira Digest tab: comment/mention triage grouped by epic, with status tracking.
// State persists via jira-proxy.py's /digest/data endpoints (a Drive-synced JSON file on
// disk), not OPFS — see docs/superpowers/specs/2026-08-12-jira-digest-tab-design.md.

const DIGEST_BUCKET_LABELS = { review: '&#128064; Review', fix_help: '&#128295; Fix/Help', fyi: '&#128172; FYI' };
const DIGEST_STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', waiting: 'Waiting', done: 'Done' };

function initDigestTab() {
    if (typeof GAS_MODE !== 'undefined' && GAS_MODE) {
        document.getElementById('digest-gas-mode').style.display  = 'block';
        document.getElementById('digest-no-config').style.display = 'none';
        document.getElementById('digest-content').style.display   = 'none';
        return;
    }
    const ok = !!settings.jiraUrl;
    document.getElementById('digest-no-config').style.display = ok ? 'none' : 'block';
    document.getElementById('digest-content').style.display   = ok ? 'block' : 'none';
    if (!ok) return;
    if (Object.keys(digestItems).length === 0) {
        loadDigestFromProxy().then(fetchDigest);
    } else {
        renderDigest();
    }
}
```

- [ ] **Step 2: Add proxy read/write and URL helpers**

Append to `js/digest.js`:
```js
async function loadDigestFromProxy() {
    try {
        const r = await fetch(PROXY_ORIGIN + '/digest/data');
        if (!r.ok) return;
        const data = await r.json();
        digestItems      = data.items      || {};
        digestLastPolled = data.lastPolled || null;
    } catch { /* proxy not reachable yet — fetchDigest's own error path will surface this */ }
}

async function saveDigestToProxy() {
    try {
        await fetch(PROXY_ORIGIN + '/digest/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lastPolled: digestLastPolled, items: digestItems })
        });
    } catch { /* best effort — next successful poll retries with the same lastPolled */ }
}

function digestProxyUrl(jiraAbsoluteUrl) {
    try {
        const u = new URL(jiraAbsoluteUrl);
        return PROXY_ORIGIN + u.pathname + u.search;
    } catch { return jiraAbsoluteUrl; }
}
```

- [ ] **Step 3: Add classification and mention-detection helpers**

Append to `js/digest.js`:
```js
function classifyBucket(bodyText, mentionsMe) {
    const lower = (bodyText || '').toLowerCase();
    const reviewRx = /\b(review|thoughts?|take a look|what do you think|please check)\b/;
    const fixRx    = /\b(can you fix|please fix|can you help|need help|look into|can you look)\b/;
    if (mentionsMe && reviewRx.test(lower)) return 'review';
    if (mentionsMe && fixRx.test(lower))    return 'fix_help';
    return 'fyi';
}

function commentMentionsMe(bodyText, accountId) {
    if (!accountId) return false;
    const escaped = accountId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp('\\[~accountid:' + escaped + '\\]', 'i');
    return rx.test(bodyText || '');
}

function formatJqlDateTime(d) {
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

async function fetchMyAccountId() {
    if (digestMyAccountId) return digestMyAccountId;
    const r = await fetch(PROXY_ORIGIN + '/rest/api/3/myself', { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('Could not identify current Jira user (HTTP ' + r.status + ')');
    const me = await r.json();
    digestMyAccountId = me.accountId;
    return digestMyAccountId;
}
```

- [ ] **Step 4: Add the poll + merge logic**

Append to `js/digest.js`:
```js
async function fetchDigest() {
    if (digestIsLoading) return;
    digestIsLoading = true;
    const btn = document.getElementById('digest-refresh-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Loading...'; }
    try {
        const accountId = await fetchMyAccountId();
        const since = digestLastPolled ? new Date(digestLastPolled) : null;
        const jql = '(assignee = currentUser() OR watcher = currentUser())'
            + (since ? ' AND updated >= "' + formatJqlDateTime(since) + '"' : '')
            + ' ORDER BY updated DESC';
        const searchResp = await fetch(PROXY_ORIGIN + '/rest/api/3/search/jql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ jql, fields: ['summary'], maxResults: 100 })
        });
        if (!searchResp.ok) {
            const e = await searchResp.json().catch(() => ({}));
            throw new Error((e.errorMessages || []).join(', ') || 'HTTP ' + searchResp.status);
        }
        const searchData = await searchResp.json();
        for (const issue of (searchData.issues || [])) {
            await mergeIssueComments(issue.key, accountId, since);
        }
        digestLastPolled = new Date().toISOString();
        await saveDigestToProxy();
        renderDigest();
    } catch (e) {
        const list = document.getElementById('digest-list');
        if (list) list.innerHTML = '<div class="empty-state"><div class="icon">&#10060;</div><p>Failed to load: ' + escHtml(e.message) + '</p></div>';
    } finally {
        digestIsLoading = false;
        if (btn) { btn.disabled = false; btn.innerHTML = '&#128260; Refresh'; }
    }
}

async function mergeIssueComments(issueKey, accountId, since) {
    const r = await fetch(PROXY_ORIGIN + '/rest/api/2/issue/' + issueKey + '?fields=attachment,comment,summary,project,parent');
    if (!r.ok) return;
    const issue = await r.json();
    const f = issue.fields || {};
    const epicName = (f.parent && f.parent.fields && f.parent.fields.summary) || (f.project && f.project.name) || 'Other';
    const epicKey  = (f.parent && f.parent.key) || (f.project && f.project.key) || '';
    const attachments = f.attachment || [];
    const comments = (f.comment && f.comment.comments) || [];
    for (const c of comments) {
        const updated = new Date(c.updated || c.created);
        if (since && updated <= since) continue;
        const mentionsMe = commentMentionsMe(c.body, accountId);
        const existing = digestItems[c.id];
        const commentTime = new Date(c.created).getTime();
        // Jira has no direct comment<->attachment link; approximate by upload-time proximity.
        const relatedAttachments = attachments
            .filter(a => Math.abs(new Date(a.created).getTime() - commentTime) <= 120000)
            .map(a => ({ filename: a.filename, isImage: (a.mimeType || '').startsWith('image/'), url: digestProxyUrl(a.content) }));
        digestItems[c.id] = {
            commentId: c.id,
            issueKey: issueKey,
            issueSummary: f.summary || '',
            epicKey: epicKey,
            epicName: epicName,
            author: (c.author && c.author.displayName) || 'Unknown',
            body: c.body || '',
            created: c.created,
            bucket: existing ? existing.bucket : classifyBucket(c.body, mentionsMe),
            bucketAuto: existing ? existing.bucketAuto : true,
            status: existing ? existing.status : 'todo',
            waitingOn: existing ? existing.waitingOn : null,
            attachments: relatedAttachments,
            mentionsMe: mentionsMe,
        };
    }
}
```

- [ ] **Step 5: Manually verify against real Jira data**

With `jira-proxy.py` running and a valid cookie set (Settings → Jira, per existing setup flow), open the Digest tab in the browser and check DevTools console. Expected: no errors thrown (rendering isn't implemented yet, so `renderDigest is not defined` will appear in the console — that's expected and confirms Task 5's logic ran). Add a temporary `console.log(digestItems)` at the end of `fetchDigest`'s try block, reload, click Refresh, and confirm the logged object contains real comment data with plausible `bucket`/`epicName`/`mentionsMe` values for a known issue. Remove the temporary `console.log` afterward.

- [ ] **Step 6: Commit**

```bash
git add js/digest.js
git commit -m "feat(digest): fetch, classify, and merge Jira comment activity"
```

---

## Task 6: Rendering — grouping, item cards, status controls, thread view

**Files:**
- Modify: `js/digest.js` (append)

- [ ] **Step 1: Add grouping and top-level render**

Append to `js/digest.js`:
```js
function groupDigestItems() {
    const showDone = document.getElementById('digest-show-done')?.checked;
    const items = Object.values(digestItems).filter(i => showDone || i.status !== 'done');
    const groups = {};
    for (const item of items) {
        const key = item.epicName || 'Other';
        if (!groups[key]) groups[key] = { epicName: key, items: [], latest: 0 };
        groups[key].items.push(item);
        const t = new Date(item.created).getTime();
        if (t > groups[key].latest) groups[key].latest = t;
    }
    return Object.values(groups).sort((a, b) => b.latest - a.latest);
}

function renderDigest() {
    const cont = document.getElementById('digest-list');
    if (!cont) return;
    const lastEl = document.getElementById('digest-last-polled');
    if (lastEl) lastEl.textContent = digestLastPolled ? 'Last checked: ' + new Date(digestLastPolled).toLocaleString() : '';
    const groups = groupDigestItems();
    if (!groups.length) {
        cont.innerHTML = '<div class="empty-state"><div class="icon">&#128276;</div><p>Nothing to triage — you\'re caught up.</p></div>';
        return;
    }
    cont.innerHTML = groups.map(renderDigestGroup).join('');
}

function renderDigestGroup(group) {
    const items = group.items.slice().sort((a, b) => new Date(b.created) - new Date(a.created));
    return '<div class="digest-group">'
        + '<div class="digest-group-header">' + escHtml(group.epicName) + '</div>'
        + items.map(renderDigestItem).join('')
        + '</div>';
}
```

- [ ] **Step 2: Add item card rendering and attachment rendering**

Append to `js/digest.js`:
```js
function renderDigestAttachments(attachments) {
    if (!attachments || !attachments.length) return '';
    return '<div class="digest-attachments">' + attachments.map(a =>
        a.isImage
            ? '<img class="digest-attachment-thumb" src="' + escAttr(a.url) + '" alt="' + escAttr(a.filename) + '" onclick="window.open(this.src,\'_blank\')">'
            : '<a class="digest-attachment-link" href="' + escAttr(a.url) + '" target="_blank" rel="noopener noreferrer">&#128206; ' + escHtml(a.filename) + '</a>'
    ).join('') + '</div>';
}

function renderDigestItem(item) {
    const bucketPills = Object.keys(DIGEST_BUCKET_LABELS).map(b =>
        '<button class="digest-bucket-pill' + (item.bucket === b ? ' active' : '') + '" onclick="setDigestBucket(\'' + item.commentId + '\',\'' + b + '\')">' + DIGEST_BUCKET_LABELS[b] + '</button>'
    ).join('');
    const statusOptions = Object.keys(DIGEST_STATUS_LABELS).map(s =>
        '<option value="' + s + '"' + (item.status === s ? ' selected' : '') + '>' + DIGEST_STATUS_LABELS[s] + '</option>'
    ).join('');
    const waitingInput = item.status === 'waiting'
        ? '<input type="text" class="digest-waiting-input" placeholder="Waiting on..." value="' + escAttr(item.waitingOn || '') + '" onchange="setDigestWaitingOn(\'' + item.commentId + '\', this.value)">'
        : '';
    return '<div class="digest-item" data-comment-id="' + item.commentId + '">'
        + '<div class="digest-item-head" onclick="toggleDigestThread(\'' + item.commentId + '\')">'
        + '<span class="jira-key">' + escHtml(item.issueKey) + '</span>'
        + '<span class="digest-summary">' + escHtml(item.issueSummary) + '</span>'
        + '</div>'
        + '<div class="digest-comment"><strong>' + escHtml(item.author) + ':</strong> ' + linkify(item.body) + '</div>'
        + renderDigestAttachments(item.attachments)
        + '<div class="digest-controls">'
        + '<div class="digest-buckets">' + bucketPills + '</div>'
        + '<select class="digest-status-select" onchange="setDigestStatus(\'' + item.commentId + '\', this.value)">' + statusOptions + '</select>'
        + waitingInput
        + '</div>'
        + '<div class="digest-thread" id="digest-thread-' + item.commentId + '" style="display:none"></div>'
        + '</div>';
}
```

- [ ] **Step 3: Add status/bucket update handlers and thread expansion**

Append to `js/digest.js`:
```js
function setDigestBucket(commentId, bucket) {
    const item = digestItems[commentId]; if (!item) return;
    item.bucket = bucket; item.bucketAuto = false;
    saveDigestToProxy(); renderDigest();
}
function setDigestStatus(commentId, status) {
    const item = digestItems[commentId]; if (!item) return;
    item.status = status;
    if (status !== 'waiting') item.waitingOn = null;
    saveDigestToProxy(); renderDigest();
}
function setDigestWaitingOn(commentId, name) {
    const item = digestItems[commentId]; if (!item) return;
    item.waitingOn = name;
    saveDigestToProxy();
}

async function toggleDigestThread(commentId) {
    const el = document.getElementById('digest-thread-' + commentId);
    if (!el) return;
    if (el.style.display !== 'none') { el.style.display = 'none'; return; }
    const item = digestItems[commentId];
    if (!item) return;
    el.style.display = 'block';
    el.innerHTML = '<div class="digest-thread-loading">Loading thread...</div>';
    try {
        const r = await fetch(PROXY_ORIGIN + '/rest/api/2/issue/' + item.issueKey + '?fields=comment');
        const issue = await r.json();
        const comments = ((issue.fields && issue.fields.comment && issue.fields.comment.comments) || [])
            .slice().sort((a, b) => new Date(a.created) - new Date(b.created));
        el.innerHTML = comments.map(c =>
            '<div class="digest-thread-comment"><strong>' + escHtml((c.author && c.author.displayName) || 'Unknown') + '</strong>'
            + ' &middot; <span class="digest-thread-date">' + formatDue((c.created || '').slice(0, 10)) + '</span>'
            + '<div>' + linkify(c.body || '') + '</div></div>'
        ).join('');
    } catch (e) {
        el.innerHTML = '<div class="digest-thread-loading">Failed to load thread: ' + escHtml(e.message) + '</div>';
    }
}
```

- [ ] **Step 4: Manually verify the full render loop**

Reload the app, open the Digest tab, click Refresh. Expected:
- Items appear grouped under epic/project headers, most recently active group first.
- Each item shows the issue key, summary, author, comment text, and bucket pills with one highlighted.
- Clicking a different bucket pill switches the highlight and persists (reload the page — same bucket shown).
- Changing the status dropdown to "Waiting" reveals the waiting-on text input; typing a name and reloading preserves it.
- Clicking an item's header expands a thread view showing all comments on that issue in chronological order.
- Checking "Show done" after marking an item Done brings it back into view; unchecking hides it again.

- [ ] **Step 5: Commit**

```bash
git add js/digest.js
git commit -m "feat(digest): render grouped digest items with status controls and thread view"
```

---

## Task 7: Auto-poll wiring

**Files:**
- Modify: `js/main.js:70` (after `initStorage();`)

- [ ] **Step 1: Add the poll interval**

In `js/main.js`, after line 70 (`initStorage();`), add:
```js
// Digest auto-poll: re-check Jira every 20 minutes while the app is open.
// Skipped in the GAS build (no proxy access) and the Home build (no Jira integration at all).
setInterval(() => {
    const gasMode  = typeof GAS_MODE   !== 'undefined' && GAS_MODE;
    const homeMode = typeof HOME_BUILD !== 'undefined' && HOME_BUILD;
    if (settings.jiraUrl && !gasMode && !homeMode) fetchDigest();
}, DIGEST_POLL_MS);
```

- [ ] **Step 2: Verify it doesn't fire immediately or crash on load**

Reload the app with DevTools open. Expected: no errors on load; the interval is scheduled but won't fire for 20 minutes. To verify it actually triggers without waiting 20 minutes, temporarily change `DIGEST_POLL_MS` in `js/constants.js` to `10 * 1000` (10 seconds), reload, confirm the Digest list refreshes on its own after ~10 seconds while sitting on a different tab, then revert the constant back to `20 * 60 * 1000`.

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "feat(digest): auto-poll Jira digest every 20 minutes"
```

---

## Task 8: Styling

**Files:**
- Modify: `css/styles.css` (append at end of file, after line 983)

- [ ] **Step 1: Add digest-specific styles**

Append to `css/styles.css`:
```css
/* ── Jira Digest tab ────────────────────────────────────────────────────────── */
.digest-group { margin-bottom: 20px; }
.digest-group-header {
    font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;
    color: var(--text-3); padding: 6px 2px; border-bottom: 1px solid var(--border); margin-bottom: 10px;
}
.digest-item {
    background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-card);
    padding: 12px 14px; margin-bottom: 10px;
}
.digest-item-head { display: flex; gap: 8px; align-items: baseline; cursor: pointer; }
.digest-summary { font-size: 0.85rem; color: var(--text-2); }
.digest-comment { font-size: 0.85rem; color: var(--text); margin-top: 6px; line-height: 1.5; }
.digest-attachments { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.digest-attachment-thumb {
    width: 96px; height: 72px; object-fit: cover; border-radius: var(--radius-btn);
    border: 1px solid var(--border); cursor: pointer;
}
.digest-attachment-link {
    font-size: 0.78rem; color: var(--purple); text-decoration: none; align-self: center;
}
.digest-attachment-link:hover { text-decoration: underline; }
.digest-controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 10px; }
.digest-buckets { display: flex; gap: 6px; }
.digest-bucket-pill {
    padding: 4px 10px; border: 1px solid var(--border); border-radius: var(--radius-pill);
    background: var(--card); color: var(--text-3); cursor: pointer; font-size: 0.76rem; font-weight: 500;
}
.digest-bucket-pill:hover { border-color: var(--purple); color: var(--purple); }
.digest-bucket-pill.active { background: var(--purple); border-color: var(--purple); color: #fff; }
.digest-status-select { font-size: 0.8rem; padding: 4px 8px; border-radius: var(--radius-btn); }
.digest-waiting-input { font-size: 0.8rem; padding: 4px 8px; border-radius: var(--radius-btn); flex: 1; min-width: 120px; }
.digest-thread {
    margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);
    display: flex; flex-direction: column; gap: 8px;
}
.digest-thread-comment { font-size: 0.8rem; color: var(--text-2); }
.digest-thread-date { color: var(--text-3); }
.digest-thread-loading { font-size: 0.8rem; color: var(--text-3); font-style: italic; }
```

- [ ] **Step 2: Verify visually**

Reload the app, open the Digest tab. Expected: item cards, bucket pills, and the thread panel are legibly styled and consistent with the rest of Joby's look (purple accent, card borders) in both light and dark mode (toggle dark mode via the header button and re-check).

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "feat(digest): style the Digest tab"
```

---

## Task 9: Build bundling and Home-build exclusion

**Files:**
- Modify: `build.js:21-37` (JS_ORDER), `build.js:58` (home-mode stripping)

- [ ] **Step 1: Register digest.js in the bundle order**

In `build.js`, change the `JS_ORDER` array (currently lines 21-37) from:
```js
const JS_ORDER = [
    'js/constants.js',
    'js/state.js',
    'js/utils.js',
    'js/theme.js',
    'js/colors.js',
    'js/storage.js',
    'js/tasks.js',
    'js/render.js',
    'js/drag.js',
    'js/jira.js',
    'js/inbox.js',
    'js/drive.js',
    'js/stats.js',
    'js/tamagoshi_svg.js',
    'js/main.js',
];
```
to:
```js
const JS_ORDER = [
    'js/constants.js',
    'js/state.js',
    'js/utils.js',
    'js/theme.js',
    'js/colors.js',
    'js/storage.js',
    'js/tasks.js',
    'js/render.js',
    'js/drag.js',
    'js/jira.js',
    'js/digest.js',
    'js/inbox.js',
    'js/drive.js',
    'js/stats.js',
    'js/tamagoshi_svg.js',
    'js/main.js',
];
```

- [ ] **Step 2: Strip the Digest tab button in the Home build**

In `build.js`, right after the existing line (currently line 58):
```js
        html = html.replace(/\s*<button id="jira-tab-btn"[^>]*>.*?<\/button>/g, '');
```
add:
```js
        html = html.replace(/\s*<button id="digest-tab-btn"[^>]*>.*?<\/button>/g, '');
```
(This matches the exact precedent already used for `jira-tab-btn` — the `tab-digest` content div itself is intentionally left unstripped, matching how `tab-jira`'s content div is also left in the Home build today: unreachable dead markup, not worth a new stripping rule.)

- [ ] **Step 3: Verify all three build targets**

```bash
cd "C:/Users/T837039/myCode/Task Organizer" && node build.js && node build.js --gas && node build.js --home
```
Expected: all three commands succeed with no errors. Then check:
```bash
grep -c "digest-tab-btn" "dist/Work Task Tracker.html" "dist/gas/Index.html" "dist/home/Joby Home.html"
```
Expected: the standard and GAS builds each report `1` (button present), the Home build reports `0` (button stripped).

- [ ] **Step 4: Commit**

```bash
git add build.js
git commit -m "feat(digest): bundle digest.js and exclude Digest tab from Home build"
```

---

## Task 10: Documentation

**Files:**
- Modify: `README.md` (new subsection after "### Jira Integration", file structure listing, changelog)

- [ ] **Step 1: Document the feature**

In `README.md`, after the "### Jira Integration" section (ends right before "### Persistence & Saving"), add:
```markdown
### Jira Digest

- New **🔔 Digest** tab, next to the Jira tab — turns Jira comment/mention/watch activity into a triaged inbox instead of scattered notifications
- Comments are grouped by Epic (falls back to Project when an issue has no epic), most recently active group first
- Each comment auto-classifies into **Review**, **Fix/Help**, or **FYI** based on whether you're mentioned and the phrasing used — click a bucket pill to override
- Per-item status: **To Do / In Progress / Waiting on \_\_\_ / Done** — Done items collapse out of view but are never deleted (check "Show done" to bring them back)
- Click an item to expand the full comment thread for that issue
- Image attachments render as inline thumbnails; other attachments show as a link that opens in Jira
- Auto-refreshes every 20 minutes while the app is open, plus a manual Refresh button
- Data is stored outside the browser: `jira-proxy.py` reads/writes `jira-digest.json` on disk inside a Google-Drive-synced folder (`G:\My Drive\Joby\jira-digest` by default, override with the `JOBY_DIGEST_DIR` environment variable) — same pattern as the ARGUS dashboard, no OAuth required. This means digest history survives a browser cache clear and is available from any machine with that Drive folder synced.
- Not available in the GAS (hosted) build or the Home/Personal build — same restriction as the Jira tab, since both need the local proxy.
```

- [ ] **Step 2: Add digest.js to the file structure listing**

In the "File Structure" code block, change:
```text
│   ├── jira.js              # Jira integration, JQL builder, proxy calls
```
to:
```text
│   ├── jira.js              # Jira integration, JQL builder, proxy calls
│   ├── digest.js            # Jira Digest tab: comment/mention triage, grouping, status tracking
```

- [ ] **Step 3: Add a changelog entry**

At the top of the "## Changelog" section, before "### v2.1 (2026-05-28)", add:
```markdown
### v2.2 (2026-08-12)

- **Jira Digest tab** — comment/mention/watch activity from Jira, grouped by epic, bucketed into Review/Fix-Help/FYI (auto-classified, overridable), with To Do/In Progress/Waiting/Done status tracking and full thread view per issue; image attachments shown inline. Data persists to a Google-Drive-synced folder via `jira-proxy.py`, not OPFS, so history survives across machines and cache clears.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document the Jira Digest tab"
```

---

## Task 11: End-to-end verification

**Files:** None (verification only)

- [ ] **Step 1: Fresh-machine simulation**

Rename or temporarily move `G:\My Drive\Joby` aside (if it already exists from earlier manual testing in Task 1) to confirm the auto-create path works from a clean state:
```bash
mv "G:/My Drive/Joby" "G:/My Drive/Joby_backup_test" 2>/dev/null || true
```
Restart `jira-proxy.py`, reload Joby, open the Digest tab, click Refresh. Expected: `G:\My Drive\Joby\jira-digest\jira-digest.json` is recreated automatically with fresh data, no errors.

- [ ] **Step 2: Full workflow check against real issues**

Using at least one real Jira issue you're assigned to or watching with recent comment activity:
- Confirm the comment appears in the Digest tab under the correct epic/project group.
- Confirm a comment that @-mentions you with review-type phrasing lands in **Review**; a plain watcher-activity comment lands in **FYI**.
- Override a bucket, reload the page, confirm the override persisted (not re-classified).
- Set a status to Waiting, type a name, reload, confirm it persisted.
- Mark an item Done, confirm it disappears from the default view; check "Show done" and confirm it reappears.
- If a comment in your test data has an image attachment, confirm it renders as a thumbnail and opens full-size on click; confirm a non-image attachment shows as a working link to Jira.

- [ ] **Step 3: Restore test backup if one was made**

```bash
rm -rf "G:/My Drive/Joby" 2>/dev/null || true
mv "G:/My Drive/Joby_backup_test" "G:/My Drive/Joby" 2>/dev/null || true
```

- [ ] **Step 4: Final commit if any fixes were needed during verification**

If Step 2 surfaced any bugs, fix them in the relevant file(s) from Tasks 1-8, then:
```bash
git add -A
git commit -m "fix(digest): address issues found during end-to-end verification"
```
(Skip this step entirely if no fixes were needed.)
