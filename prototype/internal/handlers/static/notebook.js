const canvas = document.getElementById('nb');
const ctx = canvas.getContext('2d');

let gridConfig = null;
let blocks = [];
let dragState = null;
let viewW = 0;
let viewH = 0;

async function init() {
    try {
        const gridResp = await fetch('/api/grid');
        if (!gridResp.ok) {
            throw new Error(`GET /api/grid failed: ${gridResp.status}`);
        }
        gridConfig = await gridResp.json();

        const blocksResp = await fetch('/api/blocks');
        if (!blocksResp.ok) {
            throw new Error(`GET /api/blocks failed: ${blocksResp.status}`);
        }
        blocks = await blocksResp.json();
        console.log('Grid config:', gridConfig);
        console.log('Initial blocks:', blocks.length);
    } catch (err) {
        console.error('Failed to initialize notebook state:', err);
        gridConfig = { cell_px: 24, margin_cols: 2 };
        blocks = [];
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('contextmenu', onContextMenu);

    window.addEventListener('keydown', async (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            if (blocks.length === 0) return;
            const last = blocks[blocks.length - 1];
            try {
                const deleted = await deleteBlock(last.id);
                if (deleted) {
                    blocks.pop();
                } else {
                    await reloadBlocks();
                }
            } catch (err) {
                console.error('Undo failed:', err);
                await reloadBlocks();
            }
            draw();
        }
    });

    draw();
}

function resizeCanvas() {
    // Match the canvas backing store to the display DPR so lines stay crisp
    // on HiDPI screens. Drawing code keeps using CSS pixels via setTransform.
    const dpr = window.devicePixelRatio || 1;
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    canvas.style.width = viewW + 'px';
    canvas.style.height = viewH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
}

function quantize(x, y) {
    // Clamp both axes to the valid uint32 domain the server accepts.
    // Pointer capture lets drags receive offsetX/offsetY values outside the
    // canvas (negative, or very large); unclamped those would serialize as
    // negative integers and trip a 422 from BlockCreate's *uint32 fields.
    const col = Math.max(
        gridConfig.margin_cols,
        Math.floor(x / gridConfig.cell_px)
    );
    const row = Math.max(0, Math.floor(y / gridConfig.cell_px));
    return [col, row];
}

function cellOrigin(col, row) {
    return [
        col * gridConfig.cell_px,
        row * gridConfig.cell_px,
    ];
}

function onPointerDown(e) {
    // Capture the pointer so drag continues to deliver events even when the
    // cursor leaves the canvas or the browser window; guarantees pointerup.
    if (typeof canvas.setPointerCapture === 'function') {
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* no-op */ }
    }
    const [col, row] = quantize(e.offsetX, e.offsetY);
    dragState = { pointerId: e.pointerId, startCol: col, startRow: row, endCol: col, endRow: row };
    updateCellDisplay(col, row);
    draw();
}

function onPointerMove(e) {
    if (dragState) {
        const [col, row] = quantize(e.offsetX, e.offsetY);
        dragState.endCol = col;
        dragState.endRow = row;
        updateCellDisplay(col, row);
        draw();
        return;
    }
    // Idle hover: surface the right-click-to-delete affordance.
    const [col, row] = quantize(e.offsetX, e.offsetY);
    updateCellDisplay(col, row);
    canvas.style.cursor = blockAt(col, row) !== -1 ? 'pointer' : 'crosshair';
}

async function onPointerUp(e) {
    if (!dragState) return;
    const startCol = dragState.startCol;
    const startRow = dragState.startRow;
    const endCol = dragState.endCol;
    const endRow = dragState.endRow;
    const pointerId = dragState.pointerId;
    dragState = null;
    if (e && pointerId !== undefined && typeof canvas.releasePointerCapture === 'function') {
        try { canvas.releasePointerCapture(pointerId); } catch (_) { /* no-op */ }
    }

    try {
        const created = await createBlock({
            start_col: startCol,
            start_row: startRow,
            end_col: endCol,
            end_row: endRow,
        });
        blocks.push(created);
    } catch (err) {
        console.error('Failed to create block:', err);
        await reloadBlocks();
    }

    draw();
}

function onPointerCancel(e) {
    if (dragState && e && typeof canvas.releasePointerCapture === 'function') {
        try { canvas.releasePointerCapture(dragState.pointerId); } catch (_) { /* no-op */ }
    }
    dragState = null;
    draw();
}

// pointerleave is a no-op during an active drag (pointer capture keeps events
// flowing), but when no drag is in progress we clear the hover cursor/display
// so stale state never lingers after the mouse exits the canvas.
function onPointerLeave() {
    if (dragState) return;
    canvas.style.cursor = 'crosshair';
    updateCellDisplay('-', '-');
}

function updateCellDisplay(col, row) {
    const display = document.getElementById('cell-display');
    if (col === '-' || row === '-') {
        display.textContent = '-';
        return;
    }
    display.textContent = `${col},${row}`;
}

async function reloadBlocks() {
    const resp = await fetch('/api/blocks');
    if (!resp.ok) {
        throw new Error(`GET /api/blocks failed: ${resp.status}`);
    }
    blocks = await resp.json();
}

async function createBlock(payload) {
    const resp = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`POST /api/blocks failed: ${resp.status} ${errorText}`);
    }
    return await resp.json();
}

async function deleteBlock(blockId) {
    const resp = await fetch(`/api/blocks/${encodeURIComponent(blockId)}`, {
        method: 'DELETE',
    });
    if (resp.status === 404) return false;
    if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`DELETE /api/blocks/${blockId} failed: ${resp.status} ${errorText}`);
    }
    return true;
}

function draw() {
    ctx.fillStyle = '#0A0A0F';
    ctx.fillRect(0, 0, viewW, viewH);
    drawGrid();

    blocks.forEach((block) => drawBlock(block));

    if (dragState) {
        const minCol = Math.min(dragState.startCol, dragState.endCol);
        const maxCol = Math.max(dragState.startCol, dragState.endCol);
        const minRow = Math.min(dragState.startRow, dragState.endRow);
        const maxRow = Math.max(dragState.startRow, dragState.endRow);

        const [x1, y1] = cellOrigin(minCol, minRow);
        const [x2, y2] = cellOrigin(maxCol + 1, maxRow + 1);
        const w = x2 - x1;
        const h = y2 - y1;

        ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        roundRect(ctx, x1, y1, w, h, 3);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function drawGrid() {
    const cellPx = gridConfig.cell_px;
    const marginPx = gridConfig.margin_cols * cellPx;
    const cols = Math.ceil(viewW / cellPx) + 1;
    const rows = Math.ceil(viewH / cellPx) + 1;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 0.5;
    for (let row = 1; row < rows; row++) {
        const y = row * cellPx;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(viewW, y);
        ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
            const x = col * cellPx;
            const y = row * cellPx;
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marginPx, 0);
    ctx.lineTo(marginPx, viewH);
    ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function drawBlock(block) {
    const [x1, y1] = cellOrigin(block.min_col, block.min_row);
    const [x2, y2] = cellOrigin(block.max_col + 1, block.max_row + 1);
    const w = x2 - x1;
    const h = y2 - y1;
    const r = 3;

    ctx.save();
    ctx.shadowColor = 'rgba(245, 158, 11, 0.28)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
    roundRect(ctx, x1, y1, w, h, r);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x1, y1, w, h, r);
    ctx.stroke();
}

// blockAt returns the index of the top-most block containing (col, row), or
// -1 if none match. Iterates in reverse so overlapping blocks delete the one
// the user actually sees on top (matching draw order: later blocks paint last).
function blockAt(col, row) {
    for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i];
        if (col >= b.min_col && col <= b.max_col && row >= b.min_row && row <= b.max_row) {
            return i;
        }
    }
    return -1;
}

async function onContextMenu(e) {
    e.preventDefault();
    const [col, row] = quantize(e.offsetX, e.offsetY);
    const idx = blockAt(col, row);
    if (idx === -1) return;

    const target = blocks[idx];
    try {
        const deleted = await deleteBlock(target.id);
        if (deleted) {
            blocks.splice(idx, 1);
        } else {
            await reloadBlocks();
        }
        draw();
    } catch (err) {
        console.error('Failed to delete block:', err);
        await reloadBlocks();
        draw();
    }
}

init();
