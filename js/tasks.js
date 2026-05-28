// tasks.js — Task CRUD, completion tracking, streak logic, confetti, edit modal, filter.

// ── Add task ──────────────────────────────────────────────────────────────────
function addTask() {
    const input=document.getElementById('task-input');
    const text=input.value.trim();
    if (!text) { input.style.borderColor='var(--red)'; setTimeout(()=>input.style.borderColor='',1000); return; }
    tasks.unshift({ id:Date.now(), text, notes:document.getElementById('task-notes').value.trim(), priority:document.getElementById('priority-select').value, category:document.getElementById('category-select').value, dueDate:document.getElementById('due-date').value, recurFreq:document.getElementById('recur-select').value||null, color:getSelectedColor('add-color-swatches'), indent:0, done:false, createdAt:new Date().toLocaleDateString('en-CA'), createdBy:(typeof driveUser !== 'undefined' && driveUser ? driveUser.name : ''), assignedTo:document.getElementById('assign-select')?.value||'', updatedAt:new Date().toISOString() });
    input.value=''; document.getElementById('task-notes').value=''; document.getElementById('due-date').value=''; document.getElementById('recur-select').value='';
    renderColorSwatches('add-color-swatches', '');
    if (isListening) { recognition.stop(); isListening=false; updateMicBtn(); }
    debouncedSave(); renderTasks(); updateStats(); toast(t('toastTaskAdded'));
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
    const today   = todayStr();
    if (streak.lastDate === today) return;
    const prevDay = activeMode === 'work' ? prevWorkday(today) : yesterdayStr();
    if (streak.lastDate === prevDay || streak.lastDate === yesterdayStr()) {
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

function _skipWeekends(d) { while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1); }
function recomputeStreak() {
    const today   = todayStr();
    const workMode = activeMode === 'work';
    const dateSet = new Set(Object.keys(completionLog).filter(ds => completionLog[ds] > 0));
    if (!dateSet.size) { streak.current = 0; streak.lastDate = ''; renderStreakBadge(); return; }

    let current = 0;
    let cursor  = new Date(today + 'T00:00:00');
    if (!dateSet.has(today)) {
        cursor.setDate(cursor.getDate() - 1);
        if (workMode) _skipWeekends(cursor);
    }
    while (dateSet.has(cursor.toLocaleDateString('en-CA'))) {
        current++;
        cursor.setDate(cursor.getDate() - 1);
        if (workMode) _skipWeekends(cursor);
    }

    const sorted = [...dateSet].sort();
    let run = 1, longest = 1;
    for (let i = 1; i < sorted.length; i++) {
        const consec = workMode
            ? isNextWorkday(sorted[i-1], sorted[i])
            : (new Date(sorted[i]+'T00:00:00') - new Date(sorted[i-1]+'T00:00:00')) / 86400000 === 1;
        if (consec) { run++; } else { longest = Math.max(longest, run); run = 1; }
    }
    longest = Math.max(longest, run, current);

    streak.current  = current;
    streak.lastDate = sorted[sorted.length - 1];
    streak.longest  = Math.max(streak.longest, longest);
    renderStreakBadge();
}

function toggleTask(id, evt) {
    if (selectionMode) { toggleSelection(id, evt); return; }
    const t=tasks.find(t=>t.id===id); if(!t) return;
    t.updatedAt=new Date().toISOString();
    if (!t.done) {
        const open=getChildren(t).filter(c=>!c.done);
        if (open.length) {
            const n=open.length;
            toast(tFmt('toastSubtaskBlock', n), 3500, 'var(--red)');
            return;
        }
    }
    t.done = !t.done;
    if (t.done) {
        t.doneAt = todayStr();
        logCompletion(); updateStreak();
        if (evt) fireConfetti(evt.clientX, evt.clientY);
        // Recurring tasks stay done until next page load — inform the user when it will reset
        if (t.recurFreq) {
            const nextDue = t.dueDate ? nextRecurDate(t.recurFreq, t.dueDate) : null;
            const label   = freqLabel(t.recurFreq);
            setTimeout(() => {
                const msg = nextDue
                    ? tFmt('toastTaskResetDue', formatDue(nextDue))
                    : tFmt('toastTaskReset', label);
                toast('↻ ' + msg, 3500, 'var(--purple)');
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

    toastWithAction(t('toastTaskDeleted'), t('toastUndo'), undoDelete);
}

function undoDelete() {
    if (!_pendingDeletes.length) return;
    const entry = _pendingDeletes.pop();
    clearTimeout(entry.timer);
    tasks.splice(Math.min(entry.idx, tasks.length), 0, entry.task);
    debouncedSave(); renderTasks(); updateStats();
    const remaining = _pendingDeletes.length;
    toast(t('toastTaskRestored') + (remaining ? ' ' + tFmt('toastDeletionsPending', remaining) : ''));
}

function clearDone() {
    const n=tasks.filter(t=>t.done).length;
    if(!n){toast(t('toastNoCleared'));return;}
    if(!confirm(tFmt('confirmClearDone', n)))return;
    tasks=tasks.filter(t=>!t.done); debouncedSave();renderTasks();updateStats();toast(tFmt('toastTasksCleared', n));
}

// ── Recurring reset on load ───────────────────────────────────────────────────
// Recurring tasks stay done until the next app load on a new day, then advance
// their dates and flip back to pending so they appear in Done for the rest of the
// completion day.
function resetDueRecurringTasks() {
    const today = todayStr();
    let changed = false;
    tasks.forEach(t => {
        if (!t.done || !t.recurFreq) return;
        if (t.doneAt && t.doneAt < today) {
            t.done      = false;
            t.doneAt    = null;
            t.createdAt = nextRecurDate(t.recurFreq, t.createdAt);
            if (t.dueDate) t.dueDate = nextRecurDate(t.recurFreq, t.dueDate);
            changed = true;
        }
    });
    return changed;
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
    t.assignedTo=document.getElementById('edit-assign')?.value||t.assignedTo||'';
    t.updatedAt=new Date().toISOString();
    closeEditModal(); debouncedSave();renderTasks();updateStats();toast(t('toastTaskUpdated'));
}

// ── Bulk selection ────────────────────────────────────────────────────────────
function toggleSelectionMode() {
    selectionMode = !selectionMode;
    if (!selectionMode) selectedIds.clear();
    document.getElementById('task-list')?.classList.toggle('selection-mode', selectionMode);
    const btn = document.getElementById('select-mode-btn');
    if (btn) btn.classList.toggle('active', selectionMode);
    updateBulkBar();
    renderTasks();
}
function exitSelectionMode() {
    if (!selectionMode) return;
    selectionMode = false;
    selectedIds.clear();
    document.getElementById('task-list')?.classList.remove('selection-mode');
    const btn = document.getElementById('select-mode-btn');
    if (btn) btn.classList.remove('active');
    updateBulkBar();
    renderTasks();
}
function toggleSelection(id, evt) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    const card = document.querySelector(`.task-item[data-id="${id}"]`);
    if (card) card.classList.toggle('selected', selectedIds.has(id));
    updateBulkBar();
}
function updateBulkBar() {
    const bar = document.getElementById('bulk-action-bar');
    if (!bar) return;
    const n = selectedIds.size;
    bar.style.display = selectionMode ? '' : 'none';
    const countEl = bar.querySelector('.bulk-count');
    if (countEl) countEl.textContent = tFmt('bulkSelected', n);
    const completeBtn = bar.querySelector('#bulk-complete-btn');
    const deleteBtn   = bar.querySelector('#bulk-delete-btn');
    if (completeBtn) completeBtn.disabled = n === 0;
    if (deleteBtn)   deleteBtn.disabled   = n === 0;
}
function bulkComplete() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    let count = 0;
    ids.forEach(id => {
        const task = tasks.find(t => t.id === id);
        if (task && !task.done) {
            task.done      = true;
            task.doneAt    = todayStr();
            task.updatedAt = new Date().toISOString();
            logCompletion();
            count++;
        }
    });
    if (count) updateStreak();
    exitSelectionMode();
    debouncedSave(); renderTasks(); updateStats();
    toast(tFmt('toastBulkCompleted', count));
}
function bulkDelete() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (!confirm(tFmt('confirmBulkDelete', ids.length))) return;
    tasks = tasks.filter(t => !selectedIds.has(t.id));
    exitSelectionMode();
    debouncedSave(); renderTasks(); updateStats();
    toast(tFmt('toastBulkDeleted', ids.length));
}

// ── Filter / sort ─────────────────────────────────────────────────────────────
function setFilter(f,btn) { currentFilter=f; document.querySelectorAll('.filter-pill').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderTasks(); }
