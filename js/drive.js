// drive.js — Google Drive family sync: OAuth, read/write, merge, assignment filter.

// ── Drive state ───────────────────────────────────────────────────────────────
let driveUser             = null;   // { name, email }
let driveToken            = null;   // current access token string
let driveTokenExpiry      = 0;      // Unix ms
let lastKnownModifiedTime = null;   // ISO string from last Drive read/write
let currentAssignFilter   = 'all';  // 'all' | '' (unassigned) | '<name>'
let _driveSyncing         = false;

// ── Token persistence ─────────────────────────────────────────────────────────
function loadStoredToken() {
    const stored = window.db.get(DRIVE_TOKEN_LS_KEY);
    if (!stored) return;
    if (Date.now() < stored.expiresAt - 60000) {
        driveToken       = stored.token;
        driveTokenExpiry = stored.expiresAt;
    }
}
function persistToken(token, expiresIn) {
    driveTokenExpiry = Date.now() + expiresIn * 1000;
    driveToken       = token;
    window.db.set(DRIVE_TOKEN_LS_KEY, { token, expiresAt: driveTokenExpiry });
}
function clearToken() {
    driveToken = null; driveTokenExpiry = 0;
    localStorage.removeItem(DRIVE_TOKEN_LS_KEY);
}
function hasValidToken() {
    return !!driveToken && Date.now() < driveTokenExpiry - 60000;
}

// ── GIS loading ───────────────────────────────────────────────────────────────
let _gisLoaded = false;
function loadGIS() {
    return new Promise((resolve, reject) => {
        if (_gisLoaded) { resolve(); return; }
        if (document.getElementById('gis-script')) {
            // Script tag exists but load hasn't fired yet — wait for it
            document.getElementById('gis-script').addEventListener('load', () => { _gisLoaded = true; resolve(); });
            return;
        }
        const s = document.createElement('script');
        s.id  = 'gis-script';
        s.src = 'https://accounts.google.com/gsi/client';
        s.onload  = () => { _gisLoaded = true; resolve(); };
        s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
        document.head.appendChild(s);
    });
}

// ── OAuth token request ───────────────────────────────────────────────────────
function requestToken() {
    return new Promise(async (resolve, reject) => {
        if (!settings.driveClientId) { reject(new Error('No Client ID configured')); return; }
        try { await loadGIS(); } catch(e) { reject(e); return; }
        const client = google.accounts.oauth2.initTokenClient({
            client_id: settings.driveClientId,
            scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile',
            callback: (resp) => {
                if (resp.error) { reject(new Error(resp.error)); return; }
                persistToken(resp.access_token, resp.expires_in);
                resolve(resp.access_token);
            },
        });
        client.requestAccessToken({ prompt: '' });
    });
}

// ── Ensure token (use cached or prompt) ──────────────────────────────────────
async function ensureToken() {
    if (hasValidToken()) return driveToken;
    return requestToken();
}

// ── Drive API helpers ─────────────────────────────────────────────────────────
async function driveGet(url, params) {
    const token = await ensureToken();
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    const r  = await fetch(url + qs, { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) throw new Error('Drive GET failed: ' + r.status);
    return r.json();
}
async function driveGetMedia(fileId) {
    const token = await ensureToken();
    const r = await fetch(DRIVE_API_BASE + '/files/' + fileId + '?alt=media', {
        headers: { Authorization: 'Bearer ' + token }
    });
    if (!r.ok) throw new Error('Drive read failed: ' + r.status);
    return r.json();
}
async function drivePatch(fileId, body) {
    const token = await ensureToken();
    const r = await fetch(DRIVE_UPLOAD_BASE + '/files/' + fileId + '?uploadType=media', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('Drive write failed: ' + r.status);
    return r.json();
}
async function driveGetMeta(fileId) {
    return driveGet(DRIVE_API_BASE + '/files/' + fileId, { fields: 'modifiedTime' });
}

// ── Merge ─────────────────────────────────────────────────────────────────────
function mergeTasks(local, remote) {
    const map = new Map();
    for (const t of remote) map.set(t.id, t);
    for (const t of local) {
        const r = map.get(t.id);
        if (!r || (t.updatedAt || '') >= (r.updatedAt || '')) map.set(t.id, t);
    }
    // Preserve local ordering; append remote-only tasks at end
    const localIds = new Set(local.map(t => t.id));
    const result   = local.map(t => map.get(t.id));
    for (const [id, t] of map) {
        if (!localIds.has(id)) result.push(t);
    }
    return result;
}

// ── Drive read ────────────────────────────────────────────────────────────────
async function driveLoad() {
    if (!settings.driveFileId || !settings.driveClientId) return false;
    try {
        const [data, meta] = await Promise.all([
            driveGetMedia(settings.driveFileId),
            driveGetMeta(settings.driveFileId)
        ]);
        lastKnownModifiedTime = meta.modifiedTime;
        if (data.tasks) {
            tasks = mergeTasks(tasks, data.tasks);
            renderTasks(); updateStats();
        }
        setDriveSyncIndicator('synced');
        return true;
    } catch(e) {
        console.warn('Drive load failed:', e.message);
        setDriveSyncIndicator('error');
        return false;
    }
}

// ── Drive write (fetch-before-write) ─────────────────────────────────────────
async function driveSave() {
    if (!settings.driveFileId || !settings.driveClientId) return;
    if (_driveSyncing) return;
    if (!hasValidToken()) return;
    _driveSyncing = true;
    setDriveSyncIndicator('syncing');
    try {
        const meta = await driveGetMeta(settings.driveFileId);
        if (lastKnownModifiedTime !== null && meta.modifiedTime !== lastKnownModifiedTime) {
            // Remote changed since last sync — fetch and merge before writing
            const remote = await driveGetMedia(settings.driveFileId);
            if (remote.tasks) tasks = mergeTasks(tasks, remote.tasks);
        }
        const body   = { version: APP_VERSION, tasks, modifiedAt: new Date().toISOString() };
        const result = await drivePatch(settings.driveFileId, body);
        lastKnownModifiedTime = result.modifiedTime;
        renderTasks(); updateStats();
        setDriveSyncIndicator('synced');
    } catch(e) {
        console.warn('Drive save failed:', e.message);
        setDriveSyncIndicator('error');
    } finally {
        _driveSyncing = false;
    }
}

// ── Google profile ────────────────────────────────────────────────────────────
async function fetchDriveUser() {
    if (!hasValidToken()) return;
    try {
        const r = await driveGet('https://www.googleapis.com/oauth2/v2/userinfo');
        driveUser = { name: r.name || r.email, email: r.email };
        updateDriveUserChip();
    } catch(e) { /* non-fatal — profile is cosmetic */ }
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function initDrive() {
    if (!settings.driveClientId || !settings.driveFileId) {
        setDriveSyncIndicator('off');
        renderAssignFilterPills();
        return;
    }
    loadStoredToken();
    if (hasValidToken()) {
        await fetchDriveUser();
        await driveLoad();
    } else {
        setDriveSyncIndicator('off');
    }
    renderAssignFilterPills();
}

// ── Sign in / out ─────────────────────────────────────────────────────────────
async function driveSignIn() {
    try {
        await requestToken();
        await fetchDriveUser();
        await driveLoad();
        renderAssignFilterPills();
        toast(t('toastDriveSignedIn'));
    } catch(e) {
        toast(tFmt('toastDriveSignInFail', e.message), 3000, 'var(--red)');
    }
}
function driveSignOut() {
    clearToken();
    driveUser = null;
    updateDriveUserChip();
    setDriveSyncIndicator('off');
    toast(t('toastDriveSignedOut'));
}

// ── Assignment filter ─────────────────────────────────────────────────────────
function passesAssignFilter(task) {
    if (currentAssignFilter === 'all') return true;
    if (currentAssignFilter === '') return !task.assignedTo;
    return task.assignedTo === currentAssignFilter;
}
function setAssignFilter(val) {
    currentAssignFilter = val;
    document.querySelectorAll('.assign-pill').forEach(b => {
        b.classList.toggle('active', b.dataset.assign === val);
    });
    renderTasks();
}
function renderAssignFilterPills() {
    const wrap = document.getElementById('assign-filter-wrap');
    if (!wrap) return;
    const members = (settings.familyMembers || '').split('\n').map(s => s.trim()).filter(Boolean);
    if (!members.length || !settings.driveClientId) {
        wrap.innerHTML = '';
        return;
    }
    const pills = [
        { label: 'All',        val: 'all' },
        { label: 'Unassigned', val: ''    },
        ...members.map(m => ({ label: m, val: m }))
    ].map(p =>
        `<button class="filter-btn filter-pill assign-pill${currentAssignFilter === p.val ? ' active' : ''}" data-assign="${escAttr(p.val)}" onclick="setAssignFilter(${JSON.stringify(p.val)})">${escHtml(p.label)}</button>`
    ).join('');
    wrap.innerHTML = '<span class="filter-divider">|</span>' + pills;
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function setDriveSyncIndicator(state) {
    const wrap  = document.getElementById('drive-sync-indicator');
    const dot   = document.getElementById('drive-sync-dot');
    const label = document.getElementById('drive-sync-label');
    if (!dot) return;
    const map = {
        off:     ['',        ''],
        syncing: ['syncing', 'Syncing…'],
        synced:  ['synced',  'Synced'],
        error:   ['error',   'Sync error'],
    };
    const [cls, text] = map[state] || map.off;
    dot.className     = 'drive-sync-dot' + (cls ? ' ' + cls : '');
    if (label) label.textContent = text;
    if (wrap)  wrap.style.display = state === 'off' ? 'none' : '';
}
function updateDriveUserChip() {
    const chip = document.getElementById('drive-user-chip');
    if (!chip) return;
    chip.textContent  = driveUser ? driveUser.name : '';
    chip.style.display = driveUser ? '' : 'none';
}
