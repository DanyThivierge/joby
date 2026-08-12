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
