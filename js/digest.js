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
    if (!digestHydrated) {
        fetchDigest();
    } else {
        renderDigest();
    }
}

async function loadDigestFromProxy() {
    try {
        const r = await fetch(PROXY_ORIGIN + '/digest/data');
        if (!r.ok) {
            console.warn('Failed to load digest state from proxy: HTTP ' + r.status);
            digestSaveOk = false;
            renderDigestSaveWarning();
            return;
        }
        const data = await r.json();
        digestItems      = data.items      || {};
        digestLastPolled = data.lastPolled || null;
        digestHydrated   = true;
        digestSaveOk = true;
        renderDigestSaveWarning();
    } catch (e) {
        console.warn('Failed to load digest state from proxy:', e);
        digestSaveOk = false;
        renderDigestSaveWarning();
    }
}

// Neither the proxy being down nor the Drive-synced folder being unreachable throws
// a distinct error here — both just fail this fetch the same way — so the warning
// this drives can't tell the user which one it is, only that saves aren't landing.
//
// Every status/bucket/flag change calls this independently and doesn't await it, so
// marking several items in quick succession fires several overlapping POSTs. Each
// POST's body already contains every prior change (digestItems is mutated in place
// before the fetch is dispatched), but the proxy does a plain overwrite — if an
// earlier-dispatched request's write happens to land AFTER a later one's (no
// ordering guarantee across concurrent requests to a threaded server), the earlier,
// less-complete snapshot clobbers the later, more-complete one on disk. This
// serializes saves — only one in flight at a time — so that can't happen: a second
// call while one is in flight doesn't fire its own request, it just marks
// digestSavePending so the in-flight save's completion triggers exactly one more
// save with whatever digestItems looks like *then* (not the stale snapshot from
// when the second call happened).
let digestSaveInFlight = null;
let digestSavePending  = false;
async function saveDigestToProxy() {
    if (digestSaveInFlight) { digestSavePending = true; return digestSaveInFlight; }
    digestSaveInFlight = doSaveDigestToProxy();
    await digestSaveInFlight;
    digestSaveInFlight = null;
    if (digestSavePending) {
        digestSavePending = false;
        await saveDigestToProxy();
    }
}
async function doSaveDigestToProxy() {
    try {
        const r = await fetch(PROXY_ORIGIN + '/digest/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lastPolled: digestLastPolled, items: digestItems })
        });
        digestSaveOk = r.ok;
        if (!r.ok) console.warn('Failed to save digest state to proxy: HTTP ' + r.status);
    } catch (e) {
        // A failed write here means this poll's changes (including any manual
        // bucket/status overrides) aren't on disk yet. This does NOT get retried with
        // the same time window — digestLastPolled has already advanced by the time
        // this runs — so this is the one place a user's triage state could silently go
        // missing if the proxy write keeps failing. renderDigestSaveWarning() below is
        // what makes it not silent.
        digestSaveOk = false;
        console.warn('Failed to save digest state to proxy:', e);
    }
    renderDigestSaveWarning();
}

function renderDigestSaveWarning() {
    const el = document.getElementById('digest-save-warning');
    if (el) el.style.display = digestSaveOk ? 'none' : 'block';
    if (typeof window.tamaSetDigestSaveOk === 'function') window.tamaSetDigestSaveOk(digestSaveOk);
}

function digestProxyUrl(jiraAbsoluteUrl) {
    try {
        const u = new URL(jiraAbsoluteUrl);
        return PROXY_ORIGIN + u.pathname + u.search;
    } catch { return jiraAbsoluteUrl; }
}

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

// Classification (classifyBucket/commentMentionsMe) needs Jira's raw [~accountid:...]
// markup, so item.body is stored unmodified. This resolves that markup to a display
// name for rendering only — it never touches the stored body.
const MENTION_RX = /\[~accountid:([a-zA-Z0-9:_-]+)\]/g;
function extractMentionedAccountIds(bodyText) {
    const ids = new Set();
    let m;
    MENTION_RX.lastIndex = 0;
    while ((m = MENTION_RX.exec(bodyText || ''))) ids.add(m[1]);
    return ids;
}
function resolveMentionsForDisplay(bodyText) {
    return (bodyText || '').replace(MENTION_RX, (full, id) => '@' + (digestUserNames[id] || 'someone'));
}
async function resolveUnknownMentions(bodyTexts) {
    const unknown = new Set();
    for (const body of bodyTexts) {
        for (const id of extractMentionedAccountIds(body)) {
            if (!digestUserNames[id]) unknown.add(id);
        }
    }
    if (!unknown.size) return;
    // /rest/api/3/user/bulk defaults to maxResults=10 per page regardless of how many
    // accountId params are sent — without an explicit maxResults, anything past the
    // first 10 unique unresolved people silently drops off (confirmed against the real
    // API). Chunk requests and set maxResults to match each chunk so nothing is lost.
    const ids = [...unknown];
    const CHUNK_SIZE = 50;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const params = chunk.map(id => 'accountId=' + encodeURIComponent(id)).join('&');
        try {
            const r = await fetch(PROXY_ORIGIN + '/rest/api/3/user/bulk?maxResults=' + chunk.length + '&' + params);
            if (!r.ok) continue;
            const data = await r.json();
            for (const u of (data.values || [])) digestUserNames[u.accountId] = u.displayName;
        } catch { /* best effort — this chunk's mentions fall back to "someone" */ }
    }
}

function formatJqlDateTime(d) {
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// Display format for "when was this posted" next to a comment's author — local time,
// dd/mm/yyyy to match formatDue()'s date convention elsewhere in the app, extended
// with HH:MM since a bare date isn't enough to tell same-day comments apart.
function formatDigestTimestamp(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// Runs `worker` over `items` with at most `limit` in flight at once — a middle
// ground between fully sequential (slow: one Jira round trip after another,
// ~45s+ for a full month's worth of issues) and fully parallel (risky: firing every
// request in one instant burst is exactly the pattern most likely to trip Jira
// Cloud's rate limiting). `limit` workers each pull from a shared queue until it's
// empty, so at most `limit` requests are ever in flight at the same time.
async function runWithConcurrency(items, limit, worker) {
    const queue = items.slice();
    async function runNext() {
        while (queue.length) {
            const item = queue.shift();
            await worker(item);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext));
}

async function fetchMyAccountId() {
    if (digestMyAccountId) return digestMyAccountId;
    const r = await fetch(PROXY_ORIGIN + '/rest/api/3/myself', { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('Could not identify current Jira user (HTTP ' + r.status + ')');
    const me = await r.json();
    digestMyAccountId = me.accountId;
    digestMyDisplayName = me.displayName || null;
    return digestMyAccountId;
}

// Comments you wrote yourself never need triage from you — you already know what you
// said. Drops any item (new or already-persisted from before this existed) whose
// author is you. authorAccountId covers items merged going forward; the displayName
// fallback catches items persisted before that field existed.
function purgeOwnDigestComments(accountId) {
    for (const [id, item] of Object.entries(digestItems)) {
        const isOwn = item.authorAccountId ? item.authorAccountId === accountId : item.author === digestMyDisplayName;
        if (isOwn) delete digestItems[id];
    }
}

// The regular poll below is intentionally incremental (updated >= since), so an issue
// you're still assignee/watcher on but that simply hasn't changed lately won't appear
// in it — that's normal, not a sign you've lost the relationship. This separate,
// non-incremental query is the only reliable way to know the *current* full set of
// issues you're assignee/watcher on, so stale items (no mention, and the issue no
// longer matches at all — e.g. you stopped watching it) can be cleaned up. Only prunes
// non-mention items; a mention is a standing fact independent of your current watch
// state.
async function pruneStaleDigestItems() {
    try {
        const r = await fetch(PROXY_ORIGIN + '/rest/api/3/search/jql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ jql: '(assignee = currentUser() OR watcher = currentUser())', fields: ['summary'], maxResults: 100 })
        });
        if (!r.ok) return;
        const data = await r.json();
        const currentIssueKeys = new Set((data.issues || []).map(i => i.key));
        for (const [id, item] of Object.entries(digestItems)) {
            if (!item.mentionsMe && !currentIssueKeys.has(item.issueKey)) delete digestItems[id];
        }
    } catch { /* best effort — a failed validation query just means no cleanup this poll */ }
}

// Reads the lookback dropdown (defaults to 30 days if the element isn't there for
// some reason). 'forever' means no lower bound at all. Every fetchDigest() call uses
// this directly, rather than the last-checked timestamp — a separate incremental
// "since last poll" mode plus a manual "resync further back" button turned out to be a
// distinction without a difference to explain, so there's just the one control now.
function digestLookbackSince() {
    const v = document.getElementById('digest-lookback')?.value || '30';
    if (v === 'forever') return null;
    return new Date(Date.now() - Number(v) * 86400000);
}

async function fetchDigest() {
    if (digestIsLoading) return;
    digestIsLoading = true;
    const btn = document.getElementById('digest-refresh-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Loading...'; }
    try {
        if (!digestHydrated) {
            await loadDigestFromProxy();
            // The live poll below hits Jira once per matching issue, sequentially — it can
            // take a while. Show last session's saved state right away instead of leaving
            // the tab badge blank until the whole poll finishes.
            renderDigest();
        }
        const accountId = await fetchMyAccountId();
        const since = digestLookbackSince();
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
        // 6 in flight at a time — see runWithConcurrency's comment for why not more.
        await runWithConcurrency(searchData.issues || [], 6, issue => mergeIssueComments(issue.key, accountId, since));
        purgeOwnDigestComments(accountId);
        await pruneStaleDigestItems();
        await resolveUnknownMentions(Object.values(digestItems).map(i => i.body));
        digestLastPolled = new Date().toISOString(); // display only now ("Last checked: ...") — since's lookback comes from the dropdown, not this
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
    const r = await fetch(PROXY_ORIGIN + '/rest/api/2/issue/' + issueKey + '?fields=attachment,comment,summary,project,parent,assignee,watches');
    if (!r.ok) return;
    const issue = await r.json();
    const f = issue.fields || {};
    const epicName = (f.parent && f.parent.fields && f.parent.fields.summary) || (f.project && f.project.name) || 'Other';
    const epicKey  = (f.parent && f.parent.key) || (f.project && f.project.key) || '';
    const isAssignee = !!(f.assignee && f.assignee.accountId === accountId);
    const isWatching = !!(f.watches && f.watches.isWatching);
    const attachments = f.attachment || [];
    const comments = (f.comment && f.comment.comments) || [];
    // Backfill on every poll for every already-stored item on this issue, not just new
    // comments below — otherwise an item persisted before isAssignee/isWatching existed
    // (or one whose issue hasn't had a new comment since) never gets these set, and its
    // reason tags stay blank even though the issue still matches the assignee/watcher
    // search that surfaced it in the first place.
    for (const item of Object.values(digestItems)) {
        if (item.issueKey === issueKey) {
            item.isAssignee = isAssignee;
            item.isWatching = isWatching;
        }
    }
    for (const c of comments) {
        if (c.author && c.author.accountId) digestUserNames[c.author.accountId] = c.author.displayName || digestUserNames[c.author.accountId];
        if (c.author && c.author.accountId === accountId) continue; // your own comment — nothing for you to triage
        const updated = new Date(c.updated || c.created);
        if (since && updated <= since) continue;
        const mentionsMe = commentMentionsMe(c.body, accountId);
        const existing = digestItems[c.id];
        const commentTime = new Date(c.created).getTime();
        // Jira has no reply-linking, so "did I comment on this issue after this mention"
        // is the best available signal that you already addressed it. Only auto-closes
        // an item still sitting untouched at 'todo' — never overrides a status you set
        // yourself (e.g. "Waiting on Bob"). A later comment from someone else after your
        // reply is itself a new item, which surfaces as a fresh follow-up on its own.
        const answeredByMe = mentionsMe && comments.some(other =>
            other.author && other.author.accountId === accountId && new Date(other.created).getTime() > commentTime
        );
        const status = answeredByMe && (!existing || existing.status === 'todo') ? 'done' : (existing ? existing.status : 'todo');
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
            authorAccountId: (c.author && c.author.accountId) || null,
            body: c.body || '',
            created: c.created,
            bucket: existing ? existing.bucket : classifyBucket(c.body, mentionsMe),
            bucketAuto: existing ? existing.bucketAuto : true,
            status: status,
            waitingOn: existing ? existing.waitingOn : null,
            attachments: relatedAttachments,
            mentionsMe: mentionsMe,
            isAssignee: isAssignee, // reflects current issue state, refreshed every poll (not a user override)
            isWatching: isWatching,
            flagged: existing ? existing.flagged : false,
        };
    }
}

function groupDigestItems() {
    const showDone = document.getElementById('digest-show-done')?.checked;
    const bucketFilter = document.getElementById('digest-filter-bucket')?.value || 'all';
    const items = Object.values(digestItems).filter(i =>
        (showDone || i.status !== 'done') &&
        (bucketFilter === 'all' || i.bucket === bucketFilter) &&
        (digestStatusFilter === 'all' || i.status === digestStatusFilter) &&
        (!digestFlaggedOnly || i.flagged)
    );
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

function renderDigestStats() {
    const el = document.getElementById('digest-stats');
    if (!el) return;
    const open = Object.values(digestItems).filter(i => i.status !== 'done');
    const counts = { review: 0, fix_help: 0, fyi: 0 };
    const statusCounts = { todo: 0, in_progress: 0, waiting: 0 };
    let flagged = 0;
    for (const i of open) {
        counts[i.bucket] = (counts[i.bucket] || 0) + 1;
        if (statusCounts[i.status] !== undefined) statusCounts[i.status]++;
        if (i.flagged) flagged++;
    }
    const statusPill = (status, label) =>
        '<div class="digest-stat-pill' + (digestStatusFilter === status ? ' active' : '') + '" onclick="setDigestStatusFilter(\'' + status + '\')">'
        + statusCounts[status] + ' ' + label + '</div>';
    el.innerHTML =
        '<div class="digest-stat-pill" onclick="setDigestBucketFilter(\'all\')">' + open.length + ' Open</div>'
        + '<div class="digest-stat-pill" onclick="setDigestBucketFilter(\'review\')">' + (counts.review || 0) + ' &#128064; Review</div>'
        + '<div class="digest-stat-pill" onclick="setDigestBucketFilter(\'fix_help\')">' + (counts.fix_help || 0) + ' &#128295; Fix/Help</div>'
        + '<div class="digest-stat-pill" onclick="setDigestBucketFilter(\'fyi\')">' + (counts.fyi || 0) + ' &#128172; FYI</div>'
        + '<div class="digest-stats-divider"></div>'
        + statusPill('todo', 'To Do')
        + statusPill('in_progress', 'In Progress')
        + statusPill('waiting', 'Waiting')
        + '<div class="digest-stats-divider"></div>'
        + '<div class="digest-stat-pill digest-stat-flag' + (digestFlaggedOnly ? ' active' : '') + '" onclick="toggleDigestFlaggedFilter()">' + flagged + ' &#11088; Flagged</div>';
}

function setDigestBucketFilter(bucket) {
    const sel = document.getElementById('digest-filter-bucket');
    if (sel) sel.value = bucket;
    renderDigest();
}

function setDigestStatusFilter(status) {
    digestStatusFilter = (digestStatusFilter === status) ? 'all' : status;
    renderDigest();
}

function toggleDigestFlaggedFilter() {
    digestFlaggedOnly = !digestFlaggedOnly;
    renderDigest();
}

function toggleDigestFlag(commentId) {
    const item = digestItems[commentId]; if (!item) return;
    item.flagged = !item.flagged;
    saveDigestToProxy(); renderDigest();
}

// Only To Do / In Progress feed the tab badge — an item marked "Waiting on someone"
// is parked on another person, not something pulling on your attention right now.
function digestBadgeCounts() {
    const counts = { assigned: 0, mentioned: 0, watching: 0 };
    for (const item of Object.values(digestItems)) {
        if (item.status !== 'todo' && item.status !== 'in_progress') continue;
        if (item.isAssignee) counts.assigned++;
        if (item.mentionsMe) counts.mentioned++;
        if (item.isWatching) counts.watching++;
    }
    return counts;
}

function renderDigestTabBadge() {
    const btn = document.getElementById('digest-tab-btn');
    if (!btn) return;
    if (!btn.dataset.label) btn.dataset.label = btn.textContent.trim();
    const c = digestBadgeCounts();
    const parts = [];
    if (c.assigned)  parts.push('<span class="digest-reason-badge assigned">&#128204; '  + c.assigned  + '</span>');
    if (c.mentioned) parts.push('<span class="digest-reason-badge mentioned">&#64; ' + c.mentioned + '</span>');
    if (c.watching)  parts.push('<span class="digest-reason-badge watching">&#128064; ' + c.watching  + '</span>');
    btn.innerHTML = btn.dataset.label + (parts.length ? '<span class="digest-tab-badges">' + parts.join('') + '</span>' : '');
    if (typeof window.tamaSetDigestPending === 'function') {
        window.tamaSetDigestPending(c.assigned + c.mentioned + c.watching);
    }
}

function renderDigest() {
    const cont = document.getElementById('digest-list');
    if (!cont) return;
    renderDigestStats();
    renderDigestTabBadge();
    renderDigestSaveWarning();
    updateDigestBulkBar();
    const lastEl = document.getElementById('digest-last-polled');
    if (lastEl) lastEl.textContent = digestLastPolled ? 'Last checked: ' + new Date(digestLastPolled).toLocaleString() : '';
    const groups = groupDigestItems();
    if (!groups.length) {
        cont.innerHTML = '<div class="empty-state"><div class="icon">&#128276;</div><p>Nothing to triage — you\'re caught up.</p></div>';
        digestOpenThreadIds.clear();
        return;
    }
    cont.innerHTML = groups.map(renderDigestGroup).join('');
    // A full rebuild collapses every thread <div> back to closed; re-open ones the
    // user had expanded (e.g. across an auto-poll or after triaging another item).
    for (const commentId of [...digestOpenThreadIds]) {
        digestOpenThreadIds.delete(commentId); // toggleDigestThread re-adds it on open
        if (digestItems[commentId]) toggleDigestThread(commentId);
    }
}

function renderDigestGroup(group) {
    const clusters = clusterItemsByIssue(group.items);
    return '<div class="digest-group">'
        + '<div class="digest-group-header">' + escHtml(group.epicName) + '</div>'
        + clusters.map(renderDigestIssueCluster).join('')
        + '</div>';
}

// Multiple new comments on the same issue used to render as separate cards with the
// same issue header repeated. Cluster them under one shared header instead — each
// comment keeps its own bucket/status/waitingOn controls (still keyed by commentId).
function clusterItemsByIssue(items) {
    const byIssue = {};
    for (const item of items) {
        if (!byIssue[item.issueKey]) byIssue[item.issueKey] = { issueKey: item.issueKey, comments: [], latest: 0 };
        const cluster = byIssue[item.issueKey];
        cluster.comments.push(item);
        const t = new Date(item.created).getTime();
        if (t > cluster.latest) cluster.latest = t;
    }
    return Object.values(byIssue).sort((a, b) => b.latest - a.latest);
}

function renderDigestIssueCluster(cluster) {
    const comments = cluster.comments.slice().sort((a, b) => new Date(a.created) - new Date(b.created));
    const head = comments[comments.length - 1]; // most recently merged comment has the freshest summary/epic
    const reasons = {
        mentionsMe: comments.some(c => c.mentionsMe),
        isAssignee: comments.some(c => c.isAssignee),
        isWatching: comments.some(c => c.isWatching),
    };
    const jiraUrl = settings.jiraUrl + '/browse/' + encodeURIComponent(cluster.issueKey) + '?focusedCommentId=' + encodeURIComponent(head.commentId);
    // Only the most recent comment reflects where the conversation currently stands, so
    // only it gets bucket/status controls. Earlier new-since-last-check comments in the
    // same cluster are shown as plain, collapsed context — expand to read them, but
    // there's nothing to individually triage there (closing the primary comment closes
    // the whole cluster together, see setDigestStatus).
    const context = comments.slice(0, -1);
    const contextHtml = context.length
        ? '<div class="digest-context-toggle" onclick="toggleDigestContext(\'' + head.commentId + '\')">'
          + '&#9656; ' + context.length + ' earlier comment' + (context.length > 1 ? 's' : '') + '</div>'
          + '<div class="digest-context-comments" id="digest-context-' + head.commentId + '" style="display:none">'
          + context.map(renderDigestContextComment).join('')
          + '</div>'
        : '';
    return '<div class="digest-issue-cluster' + (head.flagged ? ' digest-issue-cluster--flagged' : '') + '">'
        + '<div class="digest-item-head" onclick="toggleDigestThread(\'' + head.commentId + '\')">'
        + '<span class="jira-key">' + escHtml(cluster.issueKey) + '</span>'
        + '<span class="digest-summary">' + escHtml(head.issueSummary) + '</span>'
        + '<a class="digest-open-jira" href="' + escAttr(jiraUrl) + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" title="Open in Jira to reply">&#8599; Open in Jira</a>'
        + renderDigestReasonTags(reasons)
        + '</div>'
        + contextHtml
        + renderDigestComment(head)
        + '<div class="digest-thread" id="digest-thread-' + head.commentId + '" style="display:none"></div>'
        + '</div>';
}

function renderDigestContextComment(item) {
    return '<div class="digest-comment-row digest-context-comment" data-comment-id="' + item.commentId + '">'
        + '<div class="digest-comment"><strong>' + escHtml(item.author) + '</strong> <span class="digest-comment-time">' + formatDigestTimestamp(item.created) + '</span>: ' + linkify(resolveMentionsForDisplay(item.body)) + '</div>'
        + renderDigestAttachments(item.attachments)
        + '</div>';
}

function toggleDigestContext(headCommentId) {
    const el = document.getElementById('digest-context-' + headCommentId);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function renderDigestAttachments(attachments) {
    if (!attachments || !attachments.length) return '';
    return '<div class="digest-attachments">' + attachments.map(a =>
        a.isImage
            ? '<img class="digest-attachment-thumb" src="' + escAttr(a.url) + '" alt="' + escAttr(a.filename) + '" onclick="window.open(this.src,\'_blank\')">'
            : '<a class="digest-attachment-link" href="' + escAttr(a.url) + '" target="_blank" rel="noopener noreferrer">&#128206; ' + escHtml(a.filename) + '</a>'
    ).join('') + '</div>';
}

// Mention names resolve at render time from digestUserNames, but that cache can grow
// after cards are already on screen (e.g. opening a thread learns a name the top-level
// items didn't have yet). Patch just the comment-preview text in place rather than a
// full renderDigest() — that would also collapse/re-fetch any other open thread panels.
function refreshDigestCommentPreviews() {
    document.querySelectorAll('.digest-comment-row').forEach(el => {
        const item = digestItems[el.dataset.commentId];
        const commentEl = el.querySelector('.digest-comment');
        if (item && commentEl) {
            commentEl.innerHTML = '<strong>' + escHtml(item.author) + '</strong> <span class="digest-comment-time">' + formatDigestTimestamp(item.created) + '</span>: ' + linkify(resolveMentionsForDisplay(item.body));
        }
    });
}

function renderDigestReasonTags(item) {
    const tags = [];
    if (item.mentionsMe) tags.push('<span class="digest-reason-tag mentioned">&#64; Mentioned</span>');
    if (item.isAssignee) tags.push('<span class="digest-reason-tag assigned">&#128204; Assigned</span>');
    if (item.isWatching) tags.push('<span class="digest-reason-tag watching">&#128064; Watching</span>');
    return tags.length ? '<div class="digest-reasons">' + tags.join('') + '</div>' : '';
}

function renderDigestComment(item) {
    const bucketPills = Object.keys(DIGEST_BUCKET_LABELS).map(b =>
        '<button class="digest-bucket-pill' + (item.bucket === b ? ' active' : '') + '" onclick="setDigestBucket(\'' + item.commentId + '\',\'' + b + '\')">' + DIGEST_BUCKET_LABELS[b] + '</button>'
    ).join('');
    const statusOptions = Object.keys(DIGEST_STATUS_LABELS).map(s =>
        '<option value="' + s + '"' + (item.status === s ? ' selected' : '') + '>' + DIGEST_STATUS_LABELS[s] + '</option>'
    ).join('');
    const waitingInput = item.status === 'waiting'
        ? '<input type="text" class="digest-waiting-input" placeholder="Waiting on..." value="' + escAttr(item.waitingOn || '') + '" onchange="setDigestWaitingOn(\'' + item.commentId + '\', this.value)">'
        : '';
    const flagBtn = '<button class="digest-flag-btn' + (item.flagged ? ' active' : '') + '" onclick="toggleDigestFlag(\'' + item.commentId + '\')" title="Flag for later">'
        + (item.flagged ? '&#11088;' : '&#9734;') + '</button>';
    const selectCheckbox = '<input type="checkbox" class="digest-select-checkbox" onclick="event.stopPropagation();toggleDigestSelected(\'' + item.commentId + '\', this.checked)"'
        + (digestSelectedIds.has(item.commentId) ? ' checked' : '') + '>';
    return '<div class="digest-comment-row" data-comment-id="' + item.commentId + '">'
        + selectCheckbox
        + '<div class="digest-comment"><strong>' + escHtml(item.author) + '</strong> <span class="digest-comment-time">' + formatDigestTimestamp(item.created) + '</span>: ' + linkify(resolveMentionsForDisplay(item.body)) + '</div>'
        + renderDigestAttachments(item.attachments)
        + '<div class="digest-controls">'
        + '<div class="digest-buckets">' + bucketPills + '</div>'
        + '<select class="digest-status-select" onchange="setDigestStatus(\'' + item.commentId + '\', this.value)">' + statusOptions + '</select>'
        + waitingInput
        + flagBtn
        + '</div>'
        + '</div>';
}

function setDigestBucket(commentId, bucket) {
    const item = digestItems[commentId]; if (!item) return;
    item.bucket = bucket; item.bucketAuto = false;
    saveDigestToProxy(); renderDigest();
}
function setDigestStatus(commentId, status) {
    const item = digestItems[commentId]; if (!item) return;
    const wasDone = item.status === 'done';
    item.status = status;
    if (status !== 'waiting') item.waitingOn = null;
    if (status === 'done') {
        // Only the most recent comment in a cluster has visible controls (see
        // renderDigestIssueCluster) — closing it needs to close the earlier, now-hidden
        // context comments on the same issue too, or they'd be stuck with no way to
        // dismiss them individually.
        for (const other of Object.values(digestItems)) {
            if (other.issueKey === item.issueKey && other.commentId !== commentId) other.status = 'done';
        }
    } else if (wasDone) {
        // Symmetric to the above: reopening a cluster that was closed together should
        // reopen the whole cluster, since the siblings have no controls of their own to
        // reopen individually.
        for (const other of Object.values(digestItems)) {
            if (other.issueKey === item.issueKey && other.commentId !== commentId && other.status === 'done') other.status = 'todo';
        }
    }
    saveDigestToProxy(); renderDigest();
}
function setDigestWaitingOn(commentId, name) {
    const item = digestItems[commentId]; if (!item) return;
    item.waitingOn = name;
    saveDigestToProxy();
}

// A single "mark everything shown as Done" button was too easy to fire by accident
// with no way to undo — replaced with a checkbox on every card so only the items you
// actually pick get closed. The bulk bar itself appears only once something's checked.
function toggleDigestSelected(commentId, checked) {
    if (checked) digestSelectedIds.add(commentId); else digestSelectedIds.delete(commentId);
    updateDigestBulkBar();
}
function updateDigestBulkBar() {
    const bar = document.getElementById('digest-bulk-action-bar');
    if (!bar) return;
    bar.style.display = digestSelectedIds.size > 0 ? 'flex' : 'none';
    const countEl = document.getElementById('digest-bulk-count');
    if (countEl) countEl.textContent = digestSelectedIds.size + ' selected';
}
function clearDigestSelection() {
    digestSelectedIds.clear();
    renderDigest();
}
// Selects every currently-visible primary comment (i.e. every checkbox actually on
// screen right now, respecting the active bucket/show-done/flagged filters).
function selectAllVisibleDigest() {
    for (const el of document.querySelectorAll('.digest-select-checkbox')) {
        digestSelectedIds.add(el.closest('.digest-comment-row').dataset.commentId);
    }
    renderDigest();
}
// Checkboxes only exist on each cluster's primary (most recent) comment, so bulk actions
// need the same cascade the single-item dropdown already does — otherwise a cluster's
// earlier, checkbox-less context comments would be left with no way to close/reopen
// them individually once their primary comment's status changes here.
function markSelectedDigestDone() {
    if (!digestSelectedIds.size) return;
    for (const id of digestSelectedIds) {
        const item = digestItems[id]; if (!item) continue;
        item.status = 'done';
        for (const other of Object.values(digestItems)) {
            if (other.issueKey === item.issueKey && other.commentId !== id) other.status = 'done';
        }
    }
    digestSelectedIds.clear();
    saveDigestToProxy();
    renderDigest();
}
function markSelectedDigestTodo() {
    if (!digestSelectedIds.size) return;
    for (const id of digestSelectedIds) {
        const item = digestItems[id]; if (!item) continue;
        item.status = 'todo';
        item.waitingOn = null;
        for (const other of Object.values(digestItems)) {
            if (other.issueKey === item.issueKey && other.commentId !== id && other.status === 'done') other.status = 'todo';
        }
    }
    digestSelectedIds.clear();
    saveDigestToProxy();
    renderDigest();
}

async function toggleDigestThread(commentId) {
    const el = document.getElementById('digest-thread-' + commentId);
    if (!el) return;
    if (el.style.display !== 'none') {
        el.style.display = 'none';
        digestOpenThreadIds.delete(commentId);
        return;
    }
    const item = digestItems[commentId];
    if (!item) return;
    el.style.display = 'block';
    digestOpenThreadIds.add(commentId);
    el.innerHTML = '<div class="digest-thread-loading">Loading thread...</div>';
    try {
        const r = await fetch(PROXY_ORIGIN + '/rest/api/2/issue/' + item.issueKey + '?fields=comment');
        if (!r.ok) {
            const e = await r.json().catch(() => ({}));
            throw new Error((e.errorMessages || []).join(', ') || 'HTTP ' + r.status);
        }
        const issue = await r.json();
        const comments = ((issue.fields && issue.fields.comment && issue.fields.comment.comments) || [])
            .slice().sort((a, b) => new Date(a.created) - new Date(b.created));
        for (const c of comments) {
            if (c.author && c.author.accountId) digestUserNames[c.author.accountId] = c.author.displayName || digestUserNames[c.author.accountId];
        }
        await resolveUnknownMentions(comments.map(c => c.body || ''));
        refreshDigestCommentPreviews();
        el.innerHTML = comments.map(c =>
            '<div class="digest-thread-comment"><strong>' + escHtml((c.author && c.author.displayName) || 'Unknown') + '</strong>'
            + ' &middot; <span class="digest-thread-date">' + formatDue((c.created || '').slice(0, 10)) + '</span>'
            + '<div>' + linkify(resolveMentionsForDisplay(c.body || '')) + '</div></div>'
        ).join('');
    } catch (e) {
        el.innerHTML = '<div class="digest-thread-loading">Failed to load thread: ' + escHtml(e.message) + '</div>';
    }
}
