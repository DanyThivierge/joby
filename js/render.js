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
        if(currentCategoryFilter!=='all'&&t.category!==currentCategoryFilter)return false;
        if(typeof passesAssignFilter==='function'&&!passesAssignFilter(t))return false;
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

// Returns the visual indent for each task in the filtered list.
// A task's stored indent is only shown if its logical parent (from the master tasks array)
// is present in the filtered list AND appears before it — prevents orphaned subtasks from
// visually attaching to unrelated tasks when the parent is filtered out or reordered.
function computeDisplayIndents(filtered) {
    const filteredPos = new Map(filtered.map((t, i) => [t.id, i]));
    return filtered.map((task, fi) => {
        const indent = task.indent || 0;
        if (indent === 0) return 0;
        const masterIdx = tasks.findIndex(t => t.id === task.id);
        for (let i = masterIdx - 1; i >= 0; i--) {
            if ((tasks[i].indent || 0) < indent) {
                const parentPos = filteredPos.get(tasks[i].id);
                return (parentPos !== undefined && parentPos < fi) ? indent : 0;
            }
        }
        return 0;
    });
}

// ── Render tasks ──────────────────────────────────────────────────────────────
function renderTasks() {
    const list = document.getElementById('task-list');
    list.classList.toggle('compact-mode', compactView);
    const cb = document.getElementById('compact-btn');
    if (cb) cb.classList.toggle('active', compactView);
    const filtered = getFiltered();
    if (!filtered.length) {
        list.innerHTML = '<div class="empty-state"><div class="icon">&#128203;</div><p>' + (currentFilter==='all'&&!document.getElementById('search-input').value ? t('emptyNoTasks') : t('emptyNoMatch')) + '</p></div>';
        return;
    }
    const displayIndents = computeDisplayIndents(filtered);
    function taskCard(task, vi, dIndent) {
        const ov     = isOverdue(task);
        const indent = dIndent;
        const due    = task.dueDate ? (ov&&!task.done ? '<span class="badge over-badge">&#9888; '+t('badgeOverdue')+' '+formatDue(task.dueDate)+'</span>' : '<span class="badge due-badge" title="'+formatDue(task.dueDate)+'">&#128197; '+t('badgeDue')+' '+relativeDue(task.dueDate)+'</span>') : '';
        const notes  = task.notes ? '<div class="task-notes">'+linkify(task.notes)+'</div>' : '';
        const recur  = task.recurFreq ? '<span class="badge recur-badge">&#8635; '+freqLabel(task.recurFreq)+'</span>' : '';
        const assign = task.assignedTo ? '<span class="badge assign-badge">&#128100; '+escHtml(task.assignedTo)+'</span>' : '';
        const cDue   = task.dueDate ? (ov&&!task.done ? '<span class="compact-due ovr" title="'+t('badgeOverdue')+' '+formatDue(task.dueDate)+'">&#9888;</span>' : '<span class="compact-due" title="'+formatDue(task.dueDate)+'">&#128197; '+relativeDue(task.dueDate)+'</span>') : '';
        const cNote  = task.notes   ? '<span class="compact-note-icon" title="Has notes">&#128206;</span>' : '';
        const cRec   = task.recurFreq ? '<span class="compact-recur" title="'+freqLabel(task.recurFreq)+'">&#8635;</span>' : '';
        const compactInline = '<div class="compact-inline">'+cDue+cNote+cRec+'<span class="compact-prio p-'+task.priority+'"></span><span class="compact-cat">'+catLabel(task.category)+'</span></div>';
        const marker = indent > 0 ? '<span class="indent-marker" aria-hidden="true"></span>' : '';
        const mleft  = indent * INDENT_W;
        const ariaChecked = task.done ? 'true' : 'false';
        const ariaLabel   = (task.done ? 'Mark incomplete' : 'Mark complete') + ': ' + task.text;
        const isExpanded = expandedCompactIds.has(task.id);
        const isSelected = selectedIds.has(task.id);
        return '<div class="task-item'+(task.done?' done':'')+(ov&&!task.done?' overdue':'')+(task.color?' tc-'+task.color:'')+(isExpanded?' compact-expanded':'')+(selectionMode?' selectable':'')+(isSelected?' selected':'')+'"'
            +' draggable="true" data-id="'+task.id+'" data-vis="'+vi+'" data-indent="'+(task.indent||0)+'"'
            +' style="margin-left:'+mleft+'px">'
            +'<div class="sel-indicator" onclick="toggleSelection('+task.id+',event)" aria-hidden="true"></div>'
            +'<div class="task-check'+(task.done?' checked':'')+'"'
            +' role="checkbox" aria-checked="'+ariaChecked+'" tabindex="0"'
            +' aria-label="'+escAttr(ariaLabel)+'"'
            +' onclick="toggleTask('+task.id+',event)"'
            +' onkeydown="if(event.key===\' \'||event.key===\'Enter\'){event.preventDefault();toggleTask('+task.id+',event);}"></div>'
            +'<div class="task-content" onclick="toggleCompactExpand('+task.id+',event)"><div class="task-text">'+marker+escHtml(task.text)+'</div>'+compactInline+notes+'<div class="task-meta"><span class="badge p-'+task.priority+'">'+t('prio'+task.priority.charAt(0).toUpperCase()+task.priority.slice(1))+'</span><span class="badge cat-badge">'+catLabel(task.category)+'</span>'+recur+due+assign+'<span class="task-date" title="'+task.createdAt+'">'+relativeAdded(task.createdAt)+'</span></div></div>'
            +'<div class="task-actions">'
            +'<button class="action-btn" onclick="openEdit('+task.id+')" title="Edit" aria-label="Edit task: '+escAttr(task.text)+'">&#9998;</button>'
            +'<button class="action-btn" onclick="deleteTask('+task.id+')" title="Delete" aria-label="Delete task: '+escAttr(task.text)+'">&#128465;</button>'
            +'</div>'
            +'</div>';
    }
    list.innerHTML = filtered.map((t,i)=>taskCard(t,i,displayIndents[i])).join('');
    attachDrag();
    if (typeof updateBulkBar === 'function') updateBulkBar();
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
    if (selectionMode) { toggleSelection(id, event); return; }
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
    const html  = cats.map(c => `<option value="${c.value}">${c.emoji} ${catLabel(c.value)}</option>`).join('');
    ['category-select', 'edit-category'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    });
    populateCategoryFilter();
    populateAssignSelects();
}
function populateAssignSelects() {
    const members = (settings.familyMembers || '').split('\n').map(s => s.trim()).filter(Boolean);
    const html = '<option value="">' + t('unassigned') + '</option>' +
        members.map(m => `<option value="${escHtml(m)}">${escHtml(m)}</option>`).join('');
    ['assign-select', 'edit-assign'].forEach(id => {
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
    currentCategoryFilter = 'all';
    document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.filter === 'all');
    });
    const cf = document.getElementById('category-filter-select');
    if (cf) cf.value = 'all';
}
function onCategoryFilterChange() {
    currentCategoryFilter = document.getElementById('category-filter-select').value;
    renderTasks();
}
function populateCategoryFilter() {
    const el = document.getElementById('category-filter-select');
    if (!el) return;
    const cats = activeMode === 'personal' ? PERSONAL_CATEGORIES : WORK_CATEGORIES;
    el.innerHTML = '<option value="all">' + t('catAll') + '</option>' +
        cats.map(c => `<option value="${c.value}">${c.emoji} ${catLabel(c.value)}</option>`).join('');
    el.value = currentCategoryFilter !== 'all' && cats.some(c => c.value === currentCategoryFilter)
        ? currentCategoryFilter : 'all';
    currentCategoryFilter = el.value;
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
    const layout  = document.getElementById('tab-tasks');
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    if (isMobile) {
        layout.classList.toggle('sidebar-open');
    } else {
        layout.classList.toggle('sidebar-hidden');
    }
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportTasks() {
    const rows=['Task,Priority,Category,Due Date,Notes,Status,Added'];
    tasks.forEach(t=>{const esc=v=>'"'+String(v||'').replace(/"/g,'""')+'"';rows.push([esc(t.text),esc(t.priority),esc(t.category),esc(t.dueDate),esc(t.notes),esc(t.done?'Done':'Pending'),esc(t.createdAt)].join(','));});
    const blob=new Blob([rows.join('\n')],{type:'text/csv'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='tasks-'+new Date().toISOString().slice(0,10)+'.csv'; a.click();
    URL.revokeObjectURL(url); toast(t('toastCsvExported'));
}
