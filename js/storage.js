// storage.js — OPFS persistence, localStorage fallback, JSON export/import, save indicator.

function payload() {
    return { version: APP_VERSION, tasks, settings: { jiraUrl: settings.jiraUrl, jiraJql: settings.jiraJql, jiraAssigneeMe: settings.jiraAssigneeMe, jiraUnresolved: settings.jiraUnresolved, jiraStatuses: settings.jiraStatuses, jiraStatusNot: settings.jiraStatusNot, jiraPriorities: settings.jiraPriorities, jiraUpdatedDays: settings.jiraUpdatedDays, jiraProjects: settings.jiraProjects, themePreset: settings.themePreset, themeCustom: settings.themeCustom, compactView: settings.compactView }, promotedJiraIds, inboxItems, completionLog, streak };
}
async function opfsHandle() {
    const root = await navigator.storage.getDirectory();
    return root.getFileHandle(OPFS_FILENAME, { create: true });
}
async function saveToOPFS() {
    try {
        const fh = await opfsHandle();
        const w  = await fh.createWritable();
        await w.write(JSON.stringify(payload(), null, 2));
        await w.close();
        return true;
    } catch { return false; }
}
async function loadFromOPFS() {
    try {
        const fh   = await opfsHandle();
        const file = await fh.getFile();
        const text = await file.text();
        if (!text.trim()) return false;
        applyData(JSON.parse(text));
        return true;
    } catch { return false; }
}

function normalizeSettings(s) {
    return {
        jiraUrl:        (s && s.jiraUrl)        || JIRA_DEFAULT_URL,
        jiraJql:        (s && s.jiraJql)        || '',
        jiraAssigneeMe: s && s.jiraAssigneeMe  !== undefined ? s.jiraAssigneeMe  : true,
        jiraUnresolved: s && s.jiraUnresolved  !== undefined ? s.jiraUnresolved  : true,
        jiraStatuses:   s && s.jiraStatuses    !== undefined ? s.jiraStatuses    : 'In Progress,To Do',
        jiraStatusNot:  s && s.jiraStatusNot   !== undefined ? s.jiraStatusNot   : false,
        jiraPriorities: (s && s.jiraPriorities) || '',
        jiraUpdatedDays:(s && s.jiraUpdatedDays)|| '',
        jiraProjects:   (s && s.jiraProjects)   || '',
        themePreset:    (s && s.themePreset)    || 'default',
        themeCustom:    (s && s.themeCustom)    || {},
        compactView:    (s && s.compactView)    || false
    };
}
function applyData(data) {
    tasks           = data.tasks           || [];
    settings        = normalizeSettings(data.settings);
    promotedJiraIds = data.promotedJiraIds || [];
    inboxItems      = data.inboxItems      || [];
    completionLog   = data.completionLog   || {};
    streak          = data.streak          || { current: 0, lastDate: '', longest: 0 };
}

// ── Storage init ──────────────────────────────────────────────────────────────
async function initStorage() {
    initTheme();
    const loaded = await loadFromOPFS();
    if (!loaded) {
        const ls = window.db.get(LS_KEY);
        if (ls) { applyData(ls); await saveToOPFS(); }
    }
    restoreTheme();
    compactView = settings.compactView || false;
    renderTasks(); updateStats(); renderStreakBadge(); renderInbox();
    setSaveIndicator('saved');
}

// ── Save ──────────────────────────────────────────────────────────────────────
function debouncedSave() {
    setSaveIndicator('dirty');
    clearTimeout(saveDebTimer);
    saveDebTimer = setTimeout(() => autoSave(), SAVE_DEBOUNCE_MS);
}
let _opfsWriting = false;
async function autoSave() {
    if (_opfsWriting) { setTimeout(autoSave, 100); return; }
    _opfsWriting = true;
    try {
        const opfsOk = await saveToOPFS();
        const lsOk   = writeToLS();
        setSaveIndicator((opfsOk || lsOk) ? 'saved' : 'failed');
    } finally {
        _opfsWriting = false;
    }
}
function writeToLS() {
    try { window.db.set(LS_KEY, payload()); return true; } catch { return false; }
}

function setSaveIndicator(state) {
    const dot   = document.getElementById('save-dot');
    const label = document.getElementById('save-label');
    if (!dot) return;
    dot.className  = 'save-dot' + (state === 'dirty' ? ' dirty' : state === 'failed' ? ' failed' : '');
    label.textContent = state === 'dirty' ? 'Saving...' : state === 'failed' ? 'Save failed' : 'Saved';
}

// ── Export / Import JSON ──────────────────────────────────────────────────────
async function exportJSON() {
    if ('showSaveFilePicker' in window) {
        try {
            const fh = await window.showSaveFilePicker({
                suggestedName: 'work-tasks-backup-' + new Date().toISOString().slice(0,10) + '.json',
                types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
            });
            const w = await fh.createWritable();
            await w.write(JSON.stringify(payload(), null, 2));
            await w.close();
            toast('Backup exported!');
        } catch(e) { if (e.name !== 'AbortError') toast('Export failed: ' + e.message); }
    } else {
        const blob = new Blob([JSON.stringify(payload(), null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = 'work-tasks-backup-' + new Date().toISOString().slice(0,10) + '.json';
        a.click(); URL.revokeObjectURL(url);
        toast('Backup downloaded!');
    }
}
async function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';
    try {
        const data = JSON.parse(await file.text());
        if (!data.tasks) { toast('Invalid backup file — no tasks found.'); return; }
        if (!confirm('Import ' + (data.tasks.length) + ' tasks from "' + file.name + '"? This will replace your current tasks.')) return;
        applyData(data);
        await autoSave();
        renderTasks(); updateStats();
        toast(data.tasks.length + ' tasks imported!');
    } catch(e) { toast('Import failed: ' + e.message); }
}

window.addEventListener('beforeunload', () => writeToLS());
