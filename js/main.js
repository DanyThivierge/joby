// main.js — Keyboard shortcuts, initial render setup, app boot (initStorage).

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.getElementById('task-input').addEventListener('keydown', e=>{if(e.key==='Enter')addTask();});
document.getElementById('edit-text').addEventListener('keydown', e=>{if(e.key==='Enter')saveEdit();});
document.getElementById('edit-modal').addEventListener('keydown', e=>{if(e.key==='Escape')closeEditModal();});
document.getElementById('settings-modal').addEventListener('keydown', e=>{if(e.key==='Escape')closeSettings();});

// Space → brain dump capture; n → ghost task row; Escape → close both
document.addEventListener('keydown', e => {
    const notInInput = !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);
    if (e.key === ' ' && notInInput) { e.preventDefault(); openCapture(); }
    if (e.key === 'n' && notInInput) { e.preventDefault(); openGhostTask(); }
    if (e.key === 'Escape') { closeCapture(); closeGhostTask(); if (typeof exitSelectionMode === 'function' && selectionMode) exitSelectionMode(); }
});

// ── Task keyboard navigation ───────────────────────────────────────────────────
// Tab / Shift+Tab on a focused task-check  → indent / dedent
// Alt+Up / Alt+Down on any element in a task card → reorder
document.addEventListener('keydown', e => {
    const active = document.activeElement;
    const card   = active?.closest('.task-item');
    if (!card) return;

    const id   = parseInt(card.dataset.id);
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const refocus = () => setTimeout(
        () => document.querySelector(`.task-item[data-id="${id}"] .task-check`)?.focus(), 0
    );

    if (e.key === 'Tab' && active.classList.contains('task-check')) {
        e.preventDefault();
        task.indent = e.shiftKey
            ? Math.max(0, (task.indent || 0) - 1)
            : Math.min(MAX_INDENT, (task.indent || 0) + 1);
        debouncedSave(); renderTasks(); updateStats(); refocus();
        return;
    }

    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const filtered = getFiltered();
        const visIdx   = filtered.findIndex(t => t.id === id);
        if (visIdx === -1) return;
        const targetVis = e.key === 'ArrowUp' ? visIdx - 1 : visIdx + 1;
        if (targetVis < 0 || targetVis >= filtered.length) return;
        const aIdx = tasks.findIndex(t => t.id === id);
        const bIdx = tasks.findIndex(t => t.id === filtered[targetVis].id);
        if (aIdx === -1 || bIdx === -1) return;
        [tasks[aIdx], tasks[bIdx]] = [tasks[bIdx], tasks[aIdx]];
        debouncedSave(); renderTasks(); updateStats(); refocus();
    }
});

// ── Ghost task row ────────────────────────────────────────────────────────────
function openGhostTask() {
    const row = document.getElementById('ghost-task-row');
    if (row.classList.contains('expanded')) return;
    row.classList.add('expanded');
    setTimeout(() => document.getElementById('task-input').focus(), 30);
}
function closeGhostTask() {
    document.getElementById('ghost-task-row').classList.remove('expanded');
}

// ── Boot ──────────────────────────────────────────────────────────────────────
if (window.innerWidth < 700) document.getElementById('tab-tasks').classList.add('sidebar-hidden');
renderColorSwatches('add-color-swatches', '');
initStorage();
