// inbox.js — Brain Dump capture modal, inbox panel rendering, promote/delete inbox items.

function formatCapturedAt(val) {
    if (!val) return '';
    if (val.includes('T')) {
        const d = new Date(val);
        return d.toLocaleDateString('en-CA') + ' ' + d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
    }
    return val; // legacy date-only string
}

// ── Brain Dump Inbox ──────────────────────────────────────────────────────────
let inboxPanelOpen = true;
function openCapture() {
    document.getElementById('capture-modal').style.display = 'flex';
    document.getElementById('capture-textarea').value = '';
    setTimeout(() => document.getElementById('capture-textarea').focus(), 50);
}
function closeCapture() {
    document.getElementById('capture-modal').style.display = 'none';
}
function saveCapture() {
    const text = document.getElementById('capture-textarea').value.trim();
    if (!text) return;
    inboxItems.push({ id: Date.now(), text, capturedAt: new Date().toISOString() });
    debouncedSave(); closeCapture(); renderInbox();
}
function renderInbox() {
    const panel  = document.getElementById('inbox-panel');
    const list   = document.getElementById('inbox-list');
    const label  = document.getElementById('inbox-header-label');
    if (!panel || !list) return;
    if (!inboxItems.length) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';
    label.innerHTML = '&#128450; ' + t('inboxLabel') + ' (' + inboxItems.length + ')';
    if (!inboxPanelOpen) { list.style.display = 'none'; return; }
    list.style.display = 'block';
    list.innerHTML = inboxItems.map(item => `
        <div class="inbox-card">
            <div class="inbox-text">${escHtml(item.text)}</div>
            <div class="inbox-meta">${formatCapturedAt(item.capturedAt)}</div>
            <div class="inbox-actions">
                <button class="btn btn-small" style="flex:1" onclick="promoteInboxItem(${item.id})" aria-label="Add to tasks: ${escHtml(item.text)}">${t('inboxAddBtn')}</button>
                <button class="btn btn-small btn-danger" onclick="deleteInboxItem(${item.id})" aria-label="Delete inbox item: ${escHtml(item.text)}">&#128465;</button>
            </div>
        </div>
    `).join('');
}
function toggleInboxPanel() {
    inboxPanelOpen = !inboxPanelOpen;
    document.getElementById('inbox-list').style.display = inboxPanelOpen ? 'block' : 'none';
    document.getElementById('inbox-chevron').textContent = inboxPanelOpen ? '▲' : '▼';
}
function promoteInboxItem(id) {
    const item = inboxItems.find(i => i.id === id);
    if (!item) return;
    document.getElementById('task-input').value = item.text;
    document.getElementById('task-input').focus();
    deleteInboxItem(id);
    document.getElementById('tab-tasks').scrollIntoView({ behavior: 'smooth' });
    toast(t('inboxPromoted'));
}
function deleteInboxItem(id) {
    inboxItems = inboxItems.filter(i => i.id !== id);
    debouncedSave(); renderInbox();
}
