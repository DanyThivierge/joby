// drag.js — Drag-and-drop reordering and indent-level detection for task cards.

// ── Drag & drop ───────────────────────────────────────────────────────────────
function attachDrag() {
    document.querySelectorAll('.task-item[draggable]').forEach(el=>{
        el.addEventListener('dragstart',e=>{
            dragSrcIdx=parseInt(el.dataset.vis);
            dragTargetIndent=parseInt(el.dataset.indent||0);
            el.classList.add('dragging');
            e.dataTransfer.effectAllowed='move';
        });
        el.addEventListener('dragend',()=>{
            el.classList.remove('dragging');
            document.querySelectorAll('.task-item').forEach(i=>{i.classList.remove('drag-over');i.removeAttribute('data-drag-indent');i.removeAttribute('data-drag-indent-label');});
        });
        el.addEventListener('dragover',e=>{
            e.preventDefault();e.dataTransfer.dropEffect='move';
            document.querySelectorAll('.task-item').forEach(i=>{i.classList.remove('drag-over');i.removeAttribute('data-drag-indent');i.removeAttribute('data-drag-indent-label');});
            el.classList.add('drag-over');
            const listRect=document.getElementById('task-list').getBoundingClientRect();
            const raw=Math.floor((e.clientX-listRect.left)/DRAG_ZONE_W);
            dragTargetIndent=Math.min(MAX_INDENT,Math.max(0,raw));
            if(dragTargetIndent>0){
                el.setAttribute('data-drag-indent',dragTargetIndent);
                const arrows=['','↳ level 1','↳↳ level 2','↳↳↳ level 3'];
                el.setAttribute('data-drag-indent-label',arrows[dragTargetIndent]);
            }
        });
        el.addEventListener('drop',e=>{
            e.preventDefault();
            const di=parseInt(el.dataset.vis);if(dragSrcIdx===null||dragSrcIdx===di)return;
            const fil=getFiltered();
            const srcTask=fil[dragSrcIdx];
            const si=tasks.findIndex(t=>t.id===srcTask.id);
            const di2=tasks.findIndex(t=>t.id===fil[di].id);
            let insertAt = di2;
            if (dragTargetIndent > 0 && si > di2) insertAt = di2 + 1;
            const[m]=tasks.splice(si,1);tasks.splice(insertAt,0,m);
            m.indent=dragTargetIndent;
            dragSrcIdx=null;debouncedSave();renderTasks();updateStats();
        });
    });
}
