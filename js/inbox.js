// inbox.js — Brain Dump capture modal, inbox panel rendering, promote/delete inbox items.

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
    inboxItems.push({ id: Date.now(), text, capturedAt: todayStr() });
    debouncedSave(); closeCapture(); renderInbox();
}
function renderInbox() {
    const panel  = document.getElementById('inbox-panel');
    const list   = document.getElementById('inbox-list');
    const label  = document.getElementById('inbox-header-label');
    if (!panel || !list) return;
    if (!inboxItems.length) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';
    label.textContent = '📥 Inbox (' + inboxItems.length + ')';
    if (!inboxPanelOpen) { list.style.display = 'none'; return; }
    list.style.display = 'block';
    list.innerHTML = inboxItems.map(item => `
        <div class="inbox-card">
            <div class="inbox-text">${escHtml(item.text)}</div>
            <div class="inbox-meta">${item.capturedAt}</div>
            <div class="inbox-actions">
                <button class="btn btn-small" onclick="promoteInboxItem(${item.id})" aria-label="Add to tasks: ${escHtml(item.text)}">&#8594; Add to Tasks</button>
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
    toast('Inbox item ready to add — fill in the details above 📝');
}
function deleteInboxItem(id) {
    inboxItems = inboxItems.filter(i => i.id !== id);
    debouncedSave(); renderInbox();
}
