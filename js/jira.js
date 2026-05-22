// jira.js — Jira integration: settings modal, JQL builder, proxy fetch, issue rendering, promote-to-tasks.

// ── Settings ──────────────────────────────────────────────────────────────────
const JQL_STATUSES   = ['In Progress','To Do','In Review','Blocked','Closed'];
const JQL_PRIORITIES = ['Highest','High','Medium','Low'];
function jbSid(s) { return 'jb-s-' + s.replace(/\s+/g,'').toLowerCase(); }
function jbPid(p) { return 'jb-p-' + p.toLowerCase(); }

function openSettings() {
    document.getElementById('s-jira-url').value  = settings.jiraUrl || '';
    document.getElementById('s-jira-jql').value  = settings.jiraJql || '';
    document.getElementById('jb-assignee').checked  = settings.jiraAssigneeMe !== false;
    document.getElementById('jb-unresolved').checked = settings.jiraUnresolved !== false;
    const savedStatuses   = (settings.jiraStatuses   || '').split(',').map(s => s.trim());
    const savedPriorities = (settings.jiraPriorities || '').split(',').map(s => s.trim());
    JQL_STATUSES.forEach(s   => { const el = document.getElementById(jbSid(s));   if (el) el.checked = savedStatuses.includes(s); });
    JQL_PRIORITIES.forEach(p => { const el = document.getElementById(jbPid(p));   if (el) el.checked = savedPriorities.includes(p); });
    document.getElementById('jb-status-not').checked = settings.jiraStatusNot || false;
    document.getElementById('jb-updated').value  = settings.jiraUpdatedDays || '';
    document.getElementById('jb-projects').value = settings.jiraProjects    || '';
    updateJqlPreview();
    const cr = document.getElementById('conn-result'); cr.className = 'conn-result'; cr.textContent = '';
    document.getElementById('settings-modal').style.display = 'block';
}
function closeSettings() { document.getElementById('settings-modal').style.display = 'none'; }
function saveSettings() {
    settings.jiraUrl        = document.getElementById('s-jira-url').value.trim().replace(/\/$/, '');
    settings.jiraJql        = document.getElementById('s-jira-jql').value.trim();
    settings.jiraAssigneeMe = document.getElementById('jb-assignee').checked;
    settings.jiraUnresolved = document.getElementById('jb-unresolved').checked;
    settings.jiraStatuses   = JQL_STATUSES.filter(s   => { const el = document.getElementById(jbSid(s));   return el && el.checked; }).join(',');
    settings.jiraStatusNot  = document.getElementById('jb-status-not').checked;
    settings.jiraPriorities = JQL_PRIORITIES.filter(p => { const el = document.getElementById(jbPid(p));   return el && el.checked; }).join(',');
    settings.jiraUpdatedDays = document.getElementById('jb-updated').value;
    settings.jiraProjects    = document.getElementById('jb-projects').value.trim();
    closeSettings(); debouncedSave(); toast('Settings saved!');
}

// ── JQL build helpers ─────────────────────────────────────────────────────────
function buildJql() {
    if (settings.jiraJql) return settings.jiraJql;
    const parts = [];
    if (settings.jiraAssigneeMe) parts.push('assignee = currentUser()');
    if (settings.jiraUnresolved) parts.push('resolution = Unresolved');
    const statuses = (settings.jiraStatuses || '').split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length) {
        const op = settings.jiraStatusNot ? 'not in' : 'in';
        parts.push('status ' + op + ' ("' + statuses.join('","') + '")');
    }
    const priorities = (settings.jiraPriorities || '').split(',').map(s => s.trim()).filter(Boolean);
    if (priorities.length) parts.push('priority in ("' + priorities.join('","') + '")');
    if (settings.jiraUpdatedDays) parts.push('updated >= -' + settings.jiraUpdatedDays + 'd');
    const projs = (settings.jiraProjects || '').split(',').map(s => s.trim()).filter(Boolean);
    if (projs.length) parts.push('project in (' + projs.join(',') + ')');
    return (parts.join(' AND ') || 'assignee = currentUser()') + ' ORDER BY priority DESC';
}
function updateJqlPreview() {
    const customJql = (document.getElementById('s-jira-jql')?.value || '').trim();
    const builder   = document.getElementById('jql-builder');
    const el        = document.getElementById('jql-preview');
    if (builder) builder.classList.toggle('jql-builder--disabled', !!customJql);
    if (!el) return;
    if (customJql) { el.textContent = customJql; el.style.opacity = '0.55'; return; }
    el.style.opacity = '1';
    const parts = [];
    if (document.getElementById('jb-assignee')?.checked)  parts.push('assignee = currentUser()');
    if (document.getElementById('jb-unresolved')?.checked) parts.push('resolution = Unresolved');
    const statuses = JQL_STATUSES.filter(s => document.getElementById(jbSid(s))?.checked);
    if (statuses.length) {
        const notChecked = document.getElementById('jb-status-not')?.checked;
        parts.push('status ' + (notChecked ? 'not in' : 'in') + ' ("' + statuses.join('","') + '")');
    }
    const priorities = JQL_PRIORITIES.filter(p => document.getElementById(jbPid(p))?.checked);
    if (priorities.length) parts.push('priority in ("' + priorities.join('","') + '")');
    const days = document.getElementById('jb-updated')?.value;
    if (days) parts.push('updated >= -' + days + 'd');
    const projsRaw = (document.getElementById('jb-projects')?.value || '').trim();
    const projs = projsRaw.split(',').map(s => s.trim()).filter(Boolean);
    if (projs.length) parts.push('project in (' + projs.join(',') + ')');
    el.textContent = (parts.join(' AND ') || 'assignee = currentUser()') + ' ORDER BY priority DESC';
}
function clearCustomJql() {
    const el = document.getElementById('s-jira-jql');
    if (el) { el.value = ''; updateJqlPreview(); el.focus(); }
}

// ── Jira proxy connection test ────────────────────────────────────────────────
async function testConnection() {
    const cr = document.getElementById('conn-result');
    cr.textContent = 'Testing proxy...'; cr.style.display = 'block'; cr.className = 'conn-result';
    try {
        const r = await fetch(PROXY_ORIGIN + '/rest/api/3/myself', { headers: { 'Accept': 'application/json' } });
        if (r.ok) {
            const d = await r.json();
            cr.textContent = '✓ Connected as ' + (d.displayName || d.emailAddress);
            cr.className = 'conn-result ok';
        } else if (r.status === 503) {
            cr.textContent = '✗ Proxy is running but no cookie set — paste your cookie above and click Update Cookie.';
            cr.className = 'conn-result err';
        } else {
            cr.textContent = '✗ HTTP ' + r.status + ' — cookie may have expired. Paste a fresh one above.';
            cr.className = 'conn-result err';
        }
    } catch {
        cr.textContent = '✗ Proxy not running — open a terminal and run: python jira-proxy.py';
        cr.className = 'conn-result err';
    }
}

async function updateCookie() {
    const cookie = document.getElementById('s-cookie').value.trim();
    const cr     = document.getElementById('cookie-result');
    if (!cookie) {
        cr.textContent = 'Paste your cookie first — expand the instructions above for help.';
        cr.className = 'conn-result err'; return;
    }
    cr.textContent = 'Saving...'; cr.style.display = 'block'; cr.className = 'conn-result';
    try {
        const r = await fetch(PROXY_ORIGIN + '/_set-cookie', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookie })
        });
        if (r.ok) {
            cr.textContent = '✓ Cookie saved — click Test Proxy to verify.';
            cr.className = 'conn-result ok';
            document.getElementById('s-cookie').value = '';
        } else {
            cr.textContent = '✗ Failed to save — is the proxy running? (python jira-proxy.py)';
            cr.className = 'conn-result err';
        }
    } catch {
        cr.textContent = '✗ Proxy not running — open a terminal and run: python jira-proxy.py';
        cr.className = 'conn-result err';
    }
}

// ── Jira ──────────────────────────────────────────────────────────────────────
function initJiraTab() {
    if (typeof GAS_MODE !== 'undefined' && GAS_MODE) {
        document.getElementById('jira-gas-mode').style.display  = 'block';
        document.getElementById('jira-no-config').style.display = 'none';
        document.getElementById('jira-content').style.display   = 'none';
        return;
    }
    const ok = !!settings.jiraUrl;
    document.getElementById('jira-no-config').style.display = ok ? 'none' : 'block';
    document.getElementById('jira-content').style.display   = ok ? 'block' : 'none';
    if (ok && jiraIssues.length === 0) fetchJiraIssues(false);
}
async function fetchJiraIssues(loadMore) {
    if (jiraIsLoading) return;
    jiraIsLoading = true;
    const btn = document.getElementById('jira-refresh-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Loading...';
    const jql = buildJql();
    const body = { jql, fields:['summary','status','priority','duedate','issuetype','project'], maxResults:50 };
    if (loadMore && jiraNextPageToken) body.nextPageToken = jiraNextPageToken;
    try {
        const r = await fetch(PROXY_ORIGIN + '/rest/api/3/search/jql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error((e.errorMessages||[]).join(', ')||'HTTP '+r.status); }
        const data = await r.json();
        jiraIssues        = loadMore ? [...jiraIssues,...data.issues] : data.issues;
        jiraNextPageToken = data.isLast ? null : data.nextPageToken;
        populateProjectFilter(); renderJiraIssues();
    } catch(e) {
        document.getElementById('jira-list').innerHTML='<div class="empty-state"><div class="icon">&#10060;</div><p>Failed to load: '+escHtml(e.message)+'</p></div>';
    } finally { jiraIsLoading=false; btn.disabled=false; btn.innerHTML='&#128260; Refresh'; }
}
function populateProjectFilter() {
    const projs = [...new Set(jiraIssues.map(i=>i.fields?.project?.key).filter(Boolean))].sort();
    const sel = document.getElementById('jira-filter-project');
    const cur = sel.value;
    sel.innerHTML = '<option value="all">All Projects</option>' + projs.map(p=>'<option value="'+p+'">'+p+'</option>').join('');
    if (projs.includes(cur)) sel.value = cur;
}
function mapPrio(n) { const s=(n||'').toLowerCase(); return s==='highest'||s==='high'?'high':s==='medium'?'medium':'low'; }
function sClass(n)  { const s=(n||'').toLowerCase(); return s.includes('progress')?'s-progress':s==='to do'||s==='open'||s==='backlog'?'s-todo':s==='done'||s==='closed'||s==='resolved'?'s-done':'s-other'; }
function iIcon(n)   { const s=(n||'').toLowerCase(); return s==='bug'?'&#128027;':s==='story'?'&#128214;':s==='epic'?'&#9889;':s==='subtask'?'&#8627;':'&#9989;'; }
function renderJiraIssues() {
    const sf=document.getElementById('jira-filter-status').value;
    const pf=document.getElementById('jira-filter-priority').value;
    const prj=document.getElementById('jira-filter-project').value;
    const list=jiraIssues.filter(issue=>{
        const f=issue.fields||{};
        const sn=(f.status?.name||'').toLowerCase();
        if (sf==='inprogress'&&!sn.includes('progress')) return false;
        if (sf==='todo'&&!(sn==='to do'||sn==='open'||sn==='backlog')) return false;
        if (pf!=='all'&&mapPrio(f.priority?.name)!==pf) return false;
        if (prj!=='all'&&(f.project?.key||'')!==prj) return false;
        return true;
    });
    document.getElementById('jira-count').textContent=list.length+' issue'+(list.length!==1?'s':'');
    const cont=document.getElementById('jira-list');
    if (!list.length) { cont.innerHTML='<div class="empty-state"><div class="icon">&#127919;</div><p>No issues match the current filters.</p></div>'; document.getElementById('jira-load-more').style.display='none'; return; }
    cont.innerHTML=list.map(issue=>{
        const f=issue.fields||{};
        const key=issue.key||'#'+issue.id;
        const prio=mapPrio(f.priority?.name);
        const isP=promotedJiraIds.includes(issue.id);
        const dueStr=f.duedate?' &middot; Due '+formatDue(f.duedate):'';
        return '<div class="jira-issue'+(isP?' promoted':'') +'">'
            +'<div class="jira-icon">'+iIcon(f.issuetype?.name)+'</div>'
            +'<div class="jira-content">'
            +'<div class="jira-key">'+escHtml(key)+dueStr+'</div>'
            +'<div class="jira-summary">'+escHtml(f.summary||'(No summary)')+'</div>'
            +'<div class="jira-meta">'
            +'<span class="s-badge '+sClass(f.status?.name)+'">'+escHtml(f.status?.name||'Unknown')+'</span>'
            +'<span class="badge p-'+prio+'">'+escHtml(f.priority?.name||'Medium')+'</span>'
            +(f.project?.key?'<span class="proj-badge">'+escHtml(f.project.key)+'</span>':'')
            +'</div></div>'
            +'<div class="jira-actions">'+(isP?'<span class="promoted-tag">&#10003; Added</span>':'<button class="promote-btn" onclick="promoteIssue(\''+issue.id+'\')">+ Add to Tasks</button>')+'</div>'
            +'</div>';
    }).join('');
    document.getElementById('jira-load-more').style.display=jiraNextPageToken?'block':'none';
}
function promoteIssue(id) {
    const issue=jiraIssues.find(i=>i.id===id); if (!issue) return;
    const f=issue.fields||{};
    const key=issue.key||'#'+issue.id;
    tasks.unshift({ id:Date.now(), text:'['+key+'] '+(f.summary||''), notes:settings.jiraUrl+'/browse/'+key, priority:mapPrio(f.priority?.name), category:'JIRA', dueDate:f.duedate||'', done:false, createdAt:new Date().toLocaleDateString('en-CA') });
    promotedJiraIds.push(id);
    debouncedSave(); renderTasks(); updateStats(); renderJiraIssues();
    toast('['+key+'] added to My Tasks!');
}
