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
    } catch { /* best effort — next successful poll retries with the same lastPolled */ }
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
