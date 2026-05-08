// colors.js — Color swatch UI: render swatches, pick selection, read selected color.

// ── Color swatches ────────────────────────────────────────────────────────────
function renderColorSwatches(containerId, selectedKey) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = TASK_COLORS.map(c =>
        '<button type="button" class="color-swatch' + (c.key === selectedKey ? ' selected' : '') + (c.key === '' ? ' color-swatch--none' : '') + '"'
        + ' data-color-key="' + c.key + '"'
        + (c.hex ? ' style="background:' + c.hex + '"' : '')
        + ' title="' + c.label + '"'
        + ' onclick="pickColor(\'' + containerId + '\',\'' + c.key + '\')"></button>'
    ).join('');
}
function pickColor(containerId, key) {
    document.querySelectorAll('#' + containerId + ' .color-swatch').forEach(el => {
        el.classList.toggle('selected', el.dataset.colorKey === key);
    });
}
function getSelectedColor(containerId) {
    const sel = document.querySelector('#' + containerId + ' .color-swatch.selected');
    return sel ? (sel.dataset.colorKey || '') : '';
}
