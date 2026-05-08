// utils.js — Shared helpers: HTML escaping, URL linkification, toast notifications, date strings.

function escHtml(t) { const d=document.createElement('div'); d.appendChild(document.createTextNode(t)); return d.innerHTML; }
function escAttr(u) { return u.replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function isOverdue(task) { return task.dueDate && !task.done && task.dueDate < new Date().toISOString().slice(0,10); }
function formatDue(s) { if (!s) return ''; const [y,m,d]=s.split('-'); return d+'/'+m+'/'+y; }
function priorityRank(p) { return p==='high'?0:p==='medium'?1:2; }
function linkify(text) {
    const urlRx = /(https?:\/\/[^\s<>"]+)/g;
    return escHtml(text).replace(urlRx, url => {
        try { new URL(url); } catch { return url; }
        const display = url.length > 60 ? url.slice(0, 57) + '...' : url;
        return '<a href="' + escAttr(url) + '" target="_blank" rel="noopener noreferrer" class="task-link" onclick="event.stopPropagation()">' + display + '</a>';
    });
}

function toast(msg, dur=2300, accent='') {
    const ex=document.querySelector('.toast'); if (ex) ex.remove();
    const el=document.createElement('div'); el.className='toast';
    el.textContent=msg;
    if (accent) el.style.borderLeftColor=accent;
    document.body.appendChild(el); setTimeout(()=>el.remove(), dur);
}

function toastWithAction(msg, actionLabel, actionFn, dur=DELETE_UNDO_MS) {
    const ex=document.querySelector('.toast'); if (ex) ex.remove();
    const el=document.createElement('div'); el.className='toast';
    const span=document.createElement('span'); span.textContent=msg;
    const btn=document.createElement('button'); btn.className='toast-action'; btn.textContent=actionLabel;
    btn.addEventListener('click', () => { el.remove(); actionFn(); });
    el.append(span, btn);
    document.body.appendChild(el); setTimeout(()=>el.remove(), dur);
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function todayStr() {
    return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
}
function yesterdayStr() {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA');
}
