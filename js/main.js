// main.js — Keyboard shortcuts, initial render setup, app boot (initStorage).

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.getElementById('task-input').addEventListener('keydown', e=>{if(e.key==='Enter')addTask();});
document.getElementById('edit-text').addEventListener('keydown', e=>{if(e.key==='Enter')saveEdit();});
document.getElementById('edit-modal').addEventListener('keydown', e=>{if(e.key==='Escape')closeEditModal();});
document.getElementById('settings-modal').addEventListener('keydown', e=>{if(e.key==='Escape')closeSettings();});

// Space key — open capture if no input focused; Escape — close capture
document.addEventListener('keydown', e => {
    if (e.key === ' ' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
        e.preventDefault(); openCapture();
    }
    if (e.key === 'Escape') closeCapture();
});

// ── Boot ──────────────────────────────────────────────────────────────────────
renderColorSwatches('add-color-swatches', '');
initStorage();
