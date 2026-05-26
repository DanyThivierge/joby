// render.js — Task list rendering, tab switching, stats bar, CSV export, getFiltered/sort logic.

// ── Tabs ──────────────────────────────────────────────────────────────────────
function switchTab(tab, btn) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-tasks').style.display  = tab === 'tasks'  ? '' : 'none';
    document.getElementById('tab-jira').style.display   = tab === 'jira'   ? '' : 'none';
    if (tab === 'jira')  initJiraTab();
}

// Groups tasks into [parent, ...children] blocks so sort keeps subtasks with their parent.
function buildTaskBlocks(list) {
    if (!list.length) return [];
    const base = Math.min(...list.map(t=>t.indent||0));
    const blocks=[];let cur=null;
    for (const t of list) {
        if ((t.indent||0)<=base) { cur=[t]; blocks.push(cur); }
        else if (cur) cur.push(t);
        else { cur=[t]; blocks.push(cur); }
    }
    return blocks;
}

function getFiltered() {
    const search=(document.getElementById('search-input').value||'').toLowerCase();
    const sort=document.getElementById('sort-select').value;
    let list=tasks.filter(t=>{
        if(search&&!t.text.toLowerCase().includes(search)&&!(t.notes||'').toLowerCase().includes(search)&&!t.category.toLowerCase().includes(search))return false;
        switch(currentFilter){case'pending':return!t.done;case'done':return t.done;case'high':return t.priority==='high';case'overdue':return isOverdue(t);default:return true;}
    });
    if (sort!=='added') {
        const blocks=buildTaskBlocks([...list]);
        if(sort==='priority') blocks.sort((a,b)=>priorityRank(a[0].priority)-priorityRank(b[0].priority));
        else if(sort==='due')  blocks.sort((a,b)=>(a[0].dueDate||'z')<(b[0].dueDate||'z')?-1:1);
        else if(sort==='alpha') blocks.sort((a,b)=>a[0].text.localeCompare(b[0].text));
        list=blocks.flat();
    }
    return list;
}

// ── Render tasks ──────────────────────────────────────────────────────────────
function renderTasks() {
    const list = document.getElementById('task-list');
    list.classList.toggle('compact-mode', compactView);
    const cb = document.getElementById('compact-btn');
    if (cb) cb.classList.toggle('active', compactView);
    const filtered = getFiltered();
    if (!filtered.length) {
        list.innerHTML = '<div class="empty-state"><div class="icon">&#128203;</div><p>' + (currentFilter==='all'&&!document.getElementById('search-input').value ? 'No tasks yet — add one above or speak it!' : 'No matching tasks.') + '</p></div>';
        return;
    }
    function taskCard(task, vi) {
        const ov     = isOverdue(task);
        const indent = task.indent || 0;
        const due    = task.dueDate ? (ov&&!task.done ? '<span class="badge over-badge">&#9888; Overdue '+formatDue(task.dueDate)+'</span>' : '<span class="badge due-badge">&#128197; Due '+formatDue(task.dueDate)+'</span>') : '';
        const notes  = task.notes ? '<div class="task-notes">'+linkify(task.notes)+'</div>' : '';
        const recur  = task.recurFreq ? '<span class="badge recur-badge">&#8635; '+freqLabel(task.recurFreq)+'</span>' : '';
        const cDue   = task.dueDate ? (ov&&!task.done ? '<span class="compact-due ovr">&#9888;</span>' : '<span class="compact-due">&#128197; '+formatDue(task.dueDate)+'</span>') : '';
        const cNote  = task.notes   ? '<span class="compact-note-icon" title="Has notes">&#128206;</span>' : '';
        const cRec   = task.recurFreq ? '<span class="compact-recur" title="'+freqLabel(task.recurFreq)+'">&#8635;</span>' : '';
        const compactInline = '<div class="compact-inline">'+cDue+cNote+cRec+'<span class="compact-prio p-'+task.priority+'"></span><span class="compact-cat">'+escHtml(task.category)+'</span></div>';
        const marker = indent > 0 ? '<span class="indent-marker" aria-hidden="true"></span>' : '';
        const mleft  = indent * INDENT_W;
        const ariaChecked = task.done ? 'true' : 'false';
        const ariaLabel   = (task.done ? 'Mark incomplete' : 'Mark complete') + ': ' + task.text;
        const isExpanded = expandedCompactIds.has(task.id);
        return '<div class="task-item'+(task.done?' done':'')+(ov&&!task.done?' overdue':'')+(task.color?' tc-'+task.color:'')+(isExpanded?' compact-expanded':'')+'"'
            +' draggable="true" data-id="'+task.id+'" data-vis="'+vi+'" data-indent="'+indent+'"'
            +' style="margin-left:'+mleft+'px">'
            +'<div class="task-check'+(task.done?' checked':'')+'"'
            +' role="checkbox" aria-checked="'+ariaChecked+'" tabindex="0"'
            +' aria-label="'+escAttr(ariaLabel)+'"'
            +' onclick="toggleTask('+task.id+',event)"'
            +' onkeydown="if(event.key===\' \'||event.key===\'Enter\'){event.preventDefault();toggleTask('+task.id+',event);}"></div>'
            +'<div class="task-content" onclick="toggleCompactExpand('+task.id+',event)"><div class="task-text">'+marker+escHtml(task.text)+'</div>'+compactInline+notes+'<div class="task-meta"><span class="badge p-'+task.priority+'">'+task.priority+'</span><span class="badge cat-badge">'+escHtml(task.category)+'</span>'+recur+due+'<span class="task-date">Added '+task.createdAt+'</span></div></div>'
            +'<div class="task-actions">'
            +'<button class="action-btn" onclick="openEdit('+task.id+')" title="Edit" aria-label="Edit task: '+escAttr(task.text)+'">&#9998;</button>'
            +'<button class="action-btn" onclick="deleteTask('+task.id+')" title="Delete" aria-label="Delete task: '+escAttr(task.text)+'">&#128465;</button>'
            +'</div>'
            +'</div>';
    }
    list.innerHTML = filtered.map((t,i)=>taskCard(t,i)).join('');
    attachDrag();
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function updateStats() {
    const total=tasks.length,done=tasks.filter(t=>t.done).length;
    const overdue=tasks.filter(t=>isOverdue(t)).length;
    document.getElementById('stat-total').textContent=total;
    document.getElementById('stat-pending').textContent=total-done;
    document.getElementById('stat-done').textContent=done;
    document.getElementById('stat-high').textContent=tasks.filter(t=>t.priority==='high'&&!t.done).length;
    document.getElementById('stat-overdue').textContent=overdue;
    document.getElementById('progress-bar').style.width=(total>0?Math.round(done/total*100):0)+'%';
    document.getElementById('stat-overdue').closest('.stat-card')?.classList.toggle('danger', overdue > 0);
    if (typeof renderSidebarStats === 'function') renderSidebarStats();
    if (typeof renderHeatmap     === 'function') renderHeatmap();
}

// ── Compact view toggle ───────────────────────────────────────────────────────
function toggleCompact() {
    compactView = !compactView;
    expandedCompactIds.clear();
    settings.compactView = compactView;
    debouncedSave();
    renderTasks();
}
function toggleCompactExpand(id, event) {
    if (!compactView) return;
    if (event && event.target.closest('a, button')) return;
    if (expandedCompactIds.has(id)) expandedCompactIds.delete(id);
    else expandedCompactIds.add(id);
    const card = document.querySelector(`.task-item[data-id="${id}"]`);
    if (card) card.classList.toggle('compact-expanded', expandedCompactIds.has(id));
}

// ── Mode UI helpers ───────────────────────────────────────────────────────────
function populateCategorySelects() {
    const cats = activeMode === 'personal' ? PERSONAL_CATEGORIES : WORK_CATEGORIES;
    const html  = cats.map(c => `<option value="${c.value}">${c.emoji} ${c.label}</option>`).join('');
    ['category-select', 'edit-category'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    });
}
function restoreSortSelect() {
    const el = document.getElementById('sort-select');
    if (el) el.value = settings.sortPreference || 'added';
}
function onSortChange() {
    settings.sortPreference = document.getElementById('sort-select').value;
    debouncedSave();
    renderTasks();
}
function resetFilterBar() {
    currentFilter = 'all';
    document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.filter === 'all');
    });
}
function updateModeUI() {
    document.getElementById('mode-work-btn')?.classList.toggle('active', activeMode === 'work');
    document.getElementById('mode-personal-btn')?.classList.toggle('active', activeMode === 'personal');
    const jiraBtn = document.getElementById('jira-tab-btn');
    if (jiraBtn) jiraBtn.style.display = activeMode === 'personal' ? 'none' : '';
    if (activeMode === 'personal' && activeTab === 'jira') {
        const tasksBtn = document.querySelector('.tab-btn');
        if (tasksBtn) switchTab('tasks', tasksBtn);
    }
}

// ── Sidebar toggle ────────────────────────────────────────────────────────────
function toggleSidebar() {
    document.getElementById('tab-tasks').classList.toggle('sidebar-hidden');
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportTasks() {
    const rows=['Task,Priority,Category,Due Date,Notes,Status,Added'];
    tasks.forEach(t=>{const esc=v=>'"'+String(v||'').replace(/"/g,'""')+'"';rows.push([esc(t.text),esc(t.priority),esc(t.category),esc(t.dueDate),esc(t.notes),esc(t.done?'Done':'Pending'),esc(t.createdAt)].join(','));});
    const blob=new Blob([rows.join('\n')],{type:'text/csv'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='tasks-'+new Date().toISOString().slice(0,10)+'.csv'; a.click();
    URL.revokeObjectURL(url); toast('Tasks exported to CSV!');
}
