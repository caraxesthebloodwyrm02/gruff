const canvas = document.getElementById('nb');
const ctx = canvas.getContext('2d');

let gridConfig = null;
let blocks = [];
let dragState = null;

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
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
}

function quantize(x, y) {
    const col = Math.max(
        gridConfig.margin_cols,
        Math.floor(x / gridConfig.cell_px)
    );
    const row = Math.floor(y / gridConfig.cell_px);
    return [col, row];
}

function cellOrigin(col, row) {
    return [
        col * gridConfig.cell_px,
        row * gridConfig.cell_px,
    ];
}

function onPointerDown(e) {
    const [col, row] = quantize(e.offsetX, e.offsetY);
    dragState = { startCol: col, startRow: row, endCol: col, endRow: row };
    updateCellDisplay(col, row);
    draw();
}

function onPointerMove(e) {
    if (!dragState) return;
    const [col, row] = quantize(e.offsetX, e.offsetY);
    dragState.endCol = col;
    dragState.endRow = row;
    updateCellDisplay(col, row);
    draw();
}

async function onPointerUp() {
    if (!dragState) return;
    const startCol = dragState.startCol;
    const startRow = dragState.startRow;
    const endCol = dragState.endCol;
    const endRow = dragState.endRow;
    dragState = null;

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

function onPointerCancel() {
    dragState = null;
    draw();
}

function updateCellDisplay(col, row) {
    document.getElementById('cell-display').textContent = `${col},${row}`;
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
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    const cols = Math.ceil(canvas.width / cellPx) + 1;
    const rows = Math.ceil(canvas.height / cellPx) + 1;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 0.5;
    for (let row = 1; row < rows; row++) {
        const y = row * cellPx;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
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
    ctx.lineTo(marginPx, canvas.height);
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

function blockAt(col, row) {
    return blocks.findIndex((block) =>
        col >= block.min_col && col <= block.max_col &&
        row >= block.min_row && row <= block.max_row
    );
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
