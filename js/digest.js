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
            return;
        }
        const data = await r.json();
        digestItems      = data.items      || {};
        digestLastPolled = data.lastPolled || null;
        digestHydrated   = true;
    } catch (e) {
        console.warn('Failed to load digest state from proxy:', e);
    }
}

async function saveDigestToProxy() {
    try {
        await fetch(PROXY_ORIGIN + '/digest/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lastPolled: digestLastPolled, items: digestItems })
        });
    } catch (e) {
        // Best effort: a failed write here means this poll's changes (including any
        // manual bucket/status overrides) aren't on disk yet. This does NOT get retried
        // with the same time window — digestLastPolled has already advanced by the time
        // this runs — so log it as the one place a user's triage state could silently
        // go missing if the proxy write keeps failing.
        console.warn('Failed to save digest state to proxy:', e);
    }
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

async function fetchDigest() {
    if (digestIsLoading) return;
    digestIsLoading = true;
    const btn = document.getElementById('digest-refresh-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Loading...'; }
    try {
        if (!digestHydrated) await loadDigestFromProxy();
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
        purgeOwnDigestComments(accountId);
        await resolveUnknownMentions(Object.values(digestItems).map(i => i.body));
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
        };
    }
}

function groupDigestItems() {
    const showDone = document.getElementById('digest-show-done')?.checked;
    const bucketFilter = document.getElementById('digest-filter-bucket')?.value || 'all';
    const items = Object.values(digestItems).filter(i =>
        (showDone || i.status !== 'done') && (bucketFilter === 'all' || i.bucket === bucketFilter)
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

function renderDigest() {
    const cont = document.getElementById('digest-list');
    if (!cont) return;
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
    return '<div class="digest-issue-cluster">'
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
        + '<div class="digest-comment"><strong>' + escHtml(item.author) + ':</strong> ' + linkify(resolveMentionsForDisplay(item.body)) + '</div>'
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
            commentEl.innerHTML = '<strong>' + escHtml(item.author) + ':</strong> ' + linkify(resolveMentionsForDisplay(item.body));
        }
    });
}

function renderDigestReasonTags(item) {
    const tags = [];
    if (item.mentionsMe) tags.push('<span class="digest-reason-tag">&#64; Mentioned</span>');
    if (item.isAssignee) tags.push('<span class="digest-reason-tag">&#128204; Assigned</span>');
    if (item.isWatching) tags.push('<span class="digest-reason-tag">&#128064; Watching</span>');
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
    return '<div class="digest-comment-row" data-comment-id="' + item.commentId + '">'
        + '<div class="digest-comment"><strong>' + escHtml(item.author) + ':</strong> ' + linkify(resolveMentionsForDisplay(item.body)) + '</div>'
        + renderDigestAttachments(item.attachments)
        + '<div class="digest-controls">'
        + '<div class="digest-buckets">' + bucketPills + '</div>'
        + '<select class="digest-status-select" onchange="setDigestStatus(\'' + item.commentId + '\', this.value)">' + statusOptions + '</select>'
        + waitingInput
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
    }
    saveDigestToProxy(); renderDigest();
}
function setDigestWaitingOn(commentId, name) {
    const item = digestItems[commentId]; if (!item) return;
    item.waitingOn = name;
    saveDigestToProxy();
}

// Marks Done everything currently visible under the active bucket filter / show-done
// state — e.g. filter to FYI, then clear the whole bucket in one click, without
// touching items hidden by the current filter.
function markAllVisibleDigestDone() {
    const ids = groupDigestItems().flatMap(g => g.items.map(i => i.commentId));
    if (!ids.length) return;
    for (const id of ids) {
        const item = digestItems[id];
        if (item) item.status = 'done';
    }
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
