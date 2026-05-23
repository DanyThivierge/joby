// tasks.js — Task CRUD, completion tracking, streak logic, confetti, edit modal, filter.

// ── Add task ──────────────────────────────────────────────────────────────────
function addTask() {
    const input=document.getElementById('task-input');
    const text=input.value.trim();
    if (!text) { input.style.borderColor='var(--red)'; setTimeout(()=>input.style.borderColor='',1000); return; }
    tasks.unshift({ id:Date.now(), text, notes:document.getElementById('task-notes').value.trim(), priority:document.getElementById('priority-select').value, category:document.getElementById('category-select').value, dueDate:document.getElementById('due-date').value, recurFreq:document.getElementById('recur-select').value||null, color:getSelectedColor('add-color-swatches'), indent:0, done:false, createdAt:new Date().toLocaleDateString('en-CA') });
    input.value=''; document.getElementById('task-notes').value=''; document.getElementById('due-date').value=''; document.getElementById('recur-select').value='';
    renderColorSwatches('add-color-swatches', '');
    if (isListening) { recognition.stop(); isListening=false; updateMicBtn(); }
    debouncedSave(); renderTasks(); updateStats(); toast('Task added!');
    closeGhostTask();
}

// ── Toggle / delete ───────────────────────────────────────────────────────────
function getChildren(task) {
    const idx = tasks.findIndex(t=>t.id===task.id);
    if (idx===-1) return [];
    const base = task.indent||0;
    const children=[];
    for (let i=idx+1; i<tasks.length; i++) {
        if ((tasks[i].indent||0)<=base) break;
        children.push(tasks[i]);
    }
    return children;
}

// ── Streak & completion log ───────────────────────────────────────────────────
function logCompletion() {
    const today = todayStr();
    completionLog[today] = (completionLog[today] || 0) + 1;
}
function updateStreak() {
    const today = todayStr();
    const yest  = yesterdayStr();
    if (streak.lastDate === today) return;
    if (streak.lastDate === yest) {
        streak.current += 1;
    } else {
        streak.current = 1;
    }
    streak.lastDate = today;
    if (streak.current > streak.longest) streak.longest = streak.current;
    renderStreakBadge(true);
    if ([3,7,14,30].includes(streak.current)) {
        setTimeout(() => flashTagline('🔥 ' + streak.current + '-day streak — you\'re on fire!'), 800);
    }
}
function renderStreakBadge(pulse = false) {
    const el = document.getElementById('streak-badge');
    if (!el) return;
    if (streak.current < 1) { el.classList.remove('visible'); return; }
    el.classList.add('visible');
    el.innerHTML = '&#128293; ' + streak.current;
    el.title     = streak.current + '-day streak! Longest: ' + streak.longest + ' days';
    if (pulse) {
        el.classList.remove('pulse');
        void el.offsetWidth;
        el.classList.add('pulse');
        setTimeout(() => el.classList.remove('pulse'), 600);
    }
}

// ── Confetti ──────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#4b0082','#8b5cf6','#66cc00','#f97316','#ec4899','#eab308','#3b82f6','#14b8a6'];
function fireConfetti(x, y) {
    for (let i = 0; i < CONFETTI_COUNT; i++) {
        const el  = document.createElement('div');
        el.className = 'confetti-particle';
        const angle = Math.random() * Math.PI * 2;
        const dist  = 60 + Math.random() * 80;
        el.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
        el.style.setProperty('--dy', Math.sin(angle) * dist - 40 + 'px');
        el.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
        el.style.left   = (x - 4) + 'px';
        el.style.top    = (y - 4) + 'px';
        el.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
        el.style.animationDuration = (0.6 + Math.random() * 0.4) + 's';
        document.body.appendChild(el);
        el.addEventListener('animationend', () => el.remove());
    }
}

function recomputeStreak() {
    const today = todayStr();
    const dateSet = new Set(Object.keys(completionLog).filter(ds => completionLog[ds] > 0));
    if (!dateSet.size) { streak.current = 0; streak.lastDate = ''; renderStreakBadge(); return; }

    let current = 0;
    let cursor  = new Date(today + 'T00:00:00');
    if (!dateSet.has(today)) cursor.setDate(cursor.getDate() - 1);
    while (dateSet.has(cursor.toLocaleDateString('en-CA'))) {
        current++;
        cursor.setDate(cursor.getDate() - 1);
    }

    const sorted = [...dateSet].sort();
    let run = 1, longest = 1;
    for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i-1] + 'T00:00:00');
        const curr = new Date(sorted[i]   + 'T00:00:00');
        if ((curr - prev) / 86400000 === 1) { run++; } else { longest = Math.max(longest, run); run = 1; }
    }
    longest = Math.max(longest, run, current);

    streak.current  = current;
    streak.lastDate = sorted[sorted.length - 1];
    streak.longest  = Math.max(streak.longest, longest);
    renderStreakBadge();
}

function toggleTask(id, evt) {
    const t=tasks.find(t=>t.id===id); if(!t) return;
    if (!t.done) {
        const open=getChildren(t).filter(c=>!c.done);
        if (open.length) {
            const n=open.length;
            toast(`Almost there! Wrap up the ${n} open subtask${n>1?'s':''} below this one first 💪`, 3500, 'var(--red)');
            return;
        }
    }
    t.done = !t.done;
    if (t.done) {
        t.doneAt = todayStr();
        logCompletion(); updateStreak();
        if (evt) fireConfetti(evt.clientX, evt.clientY);
        // Schedule recurring reset — advance both dates by the frequency period
        if (t.recurFreq) {
            const days       = freqDays(t.recurFreq);
            const label      = freqLabel(t.recurFreq);
            const oldCreated = t.createdAt;
            const oldDue     = t.dueDate;
            setTimeout(() => {
                const task = tasks.find(x => x.id === id);
                if (!task || !task.done) return; // user may have un-done it
                task.done      = false;
                task.doneAt    = null;
                task.createdAt = addDaysToDate(oldCreated, days);
                task.dueDate   = oldDue ? addDaysToDate(oldDue, days) : null;
                debouncedSave(); renderTasks(); updateStats();
                toast('↻ ' + label + ' task reset' + (task.dueDate ? ' — due ' + formatDue(task.dueDate) : ''), 3500, 'var(--purple)');
            }, 1600);
        }
    } else {
        const day = t.doneAt || todayStr();
        t.doneAt = null;
        if (completionLog[day] > 0) {
            completionLog[day]--;
            if (completionLog[day] === 0) delete completionLog[day];
        }
        recomputeStreak();
    }
    debouncedSave(); renderTasks(); updateStats();
}

// ── Soft delete with undo stack ───────────────────────────────────────────────
let _pendingDeletes = [];

function deleteTask(id) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return;

    const removed = tasks.splice(idx, 1)[0];
    renderTasks(); updateStats();

    const entry = { task: removed, idx };
    entry.timer = setTimeout(() => {
        _pendingDeletes = _pendingDeletes.filter(e => e !== entry);
        debouncedSave();
    }, DELETE_UNDO_MS);
    _pendingDeletes.push(entry);

    toastWithAction('Task deleted', 'Undo', undoDelete);
}

function undoDelete() {
    if (!_pendingDeletes.length) return;
    const entry = _pendingDeletes.pop();
    clearTimeout(entry.timer);
    tasks.splice(Math.min(entry.idx, tasks.length), 0, entry.task);
    debouncedSave(); renderTasks(); updateStats();
    const remaining = _pendingDeletes.length;
    toast('Task restored ✓' + (remaining ? ' — ' + remaining + ' more deletion' + (remaining > 1 ? 's' : '') + ' pending' : ''));
}

function clearDone() {
    const n=tasks.filter(t=>t.done).length;
    if(!n){toast('No completed tasks to clear.');return;}
    if(!confirm('Remove all '+n+' completed task(s)?'))return;
    tasks=tasks.filter(t=>!t.done); debouncedSave();renderTasks();updateStats();toast(n+' task(s) cleared.');
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function openEdit(id) {
    const t=tasks.find(t=>t.id===id); if(!t)return; editId=id;
    document.getElementById('edit-text').value=t.text;
    document.getElementById('edit-notes').value=t.notes||'';
    document.getElementById('edit-priority').value=t.priority;
    document.getElementById('edit-category').value=t.category;
    document.getElementById('edit-due').value=t.dueDate||'';
    document.getElementById('edit-recur').value=t.recurFreq||'';
    renderColorSwatches('edit-color-swatches', t.color||'');
    document.getElementById('edit-modal').style.display='block';
}
function closeEditModal() { document.getElementById('edit-modal').style.display='none'; }
function saveEdit() {
    const t=tasks.find(t=>t.id===editId); if(!t)return;
    const txt=document.getElementById('edit-text').value.trim();
    if(!txt){alert('Task text cannot be empty.');return;}
    t.text=txt; t.notes=document.getElementById('edit-notes').value.trim();
    t.priority=document.getElementById('edit-priority').value;
    t.category=document.getElementById('edit-category').value;
    t.dueDate=document.getElementById('edit-due').value;
    t.recurFreq=document.getElementById('edit-recur').value||null;
    t.color=getSelectedColor('edit-color-swatches');
    closeEditModal(); debouncedSave();renderTasks();updateStats();toast('Task updated!');
}

// ── Filter / sort ─────────────────────────────────────────────────────────────
function setFilter(f,btn) { currentFilter=f; document.querySelectorAll('.filter-pill').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderTasks(); }
