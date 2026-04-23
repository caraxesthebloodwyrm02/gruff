const canvas = document.getElementById('nb');
const ctx = canvas.getContext('2d');
const cellDisplay = document.getElementById('cell-display');
const clearBtn = document.getElementById('clear-btn');
const liveDot = document.getElementById('live-dot');
const liveText = document.getElementById('live-text');
const labelInput = document.getElementById('label-input');
const toneSelect = document.getElementById('tone-select');

let gridConfig = null;
let blocks = [];
let dragState = null;
let liveSocket = null;
let reconnectTimer = null;
let reconnectDelayMs = 800;

const MAX_RECONNECT_DELAY_MS = 8000;
const TONES = {
    amber: {
        border: '#F59E0B',
        fill: 'rgba(245, 158, 11, 0.14)',
        glow: 'rgba(245, 158, 11, 0.28)',
        text: '#FDE68A',
    },
    mint: {
        border: '#34D399',
        fill: 'rgba(52, 211, 153, 0.14)',
        glow: 'rgba(52, 211, 153, 0.26)',
        text: '#A7F3D0',
    },
    azure: {
        border: '#60A5FA',
        fill: 'rgba(96, 165, 250, 0.14)',
        glow: 'rgba(96, 165, 250, 0.24)',
        text: '#BFDBFE',
    },
    rose: {
        border: '#F472B6',
        fill: 'rgba(244, 114, 182, 0.14)',
        glow: 'rgba(244, 114, 182, 0.24)',
        text: '#FBCFE8',
    },
    slate: {
        border: '#94A3B8',
        fill: 'rgba(148, 163, 184, 0.14)',
        glow: 'rgba(148, 163, 184, 0.24)',
        text: '#E2E8F0',
    },
};

async function init() {
    await loadInitialState();
    connectLiveChannel();

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('contextmenu', onContextMenu);
    clearBtn.addEventListener('click', onClearBoard);

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

async function loadInitialState() {
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
    } catch (err) {
        console.error('Failed to initialize notebook state:', err);
        gridConfig = { cell_px: 24, margin_cols: 2 };
        blocks = [];
    }
}

function connectLiveChannel() {
    if (liveSocket && liveSocket.readyState <= WebSocket.OPEN) {
        return;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    liveSocket = new WebSocket(`${protocol}://${window.location.host}/ws`);

    liveSocket.addEventListener('open', () => {
        setLiveStatus('online');
        reconnectDelayMs = 800;
    });

    liveSocket.addEventListener('message', (event) => {
        let payload = null;
        try {
            payload = JSON.parse(event.data);
        } catch (err) {
            console.warn('Ignoring non-JSON websocket message');
            return;
        }
        if (!payload || !Array.isArray(payload.blocks)) {
            return;
        }
        blocks = payload.blocks;
        if (payload.type === 'hello' && payload.grid) {
            gridConfig = payload.grid;
        }
        draw();
    });

    liveSocket.addEventListener('close', () => {
        setLiveStatus('reconnecting');
        scheduleReconnect();
    });

    liveSocket.addEventListener('error', () => {
        setLiveStatus('offline');
        liveSocket.close();
    });
}

function scheduleReconnect() {
    if (reconnectTimer) {
        return;
    }
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectLiveChannel();
    }, reconnectDelayMs);
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
}

function setLiveStatus(state) {
    liveDot.classList.toggle('online', state === 'online');
    if (state === 'online') {
        liveText.textContent = 'live';
        return;
    }
    if (state === 'reconnecting') {
        liveText.textContent = 'reconnecting';
        return;
    }
    liveText.textContent = 'offline';
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
    if (e.button !== 0) {
        return;
    }

    const [col, row] = quantize(e.offsetX, e.offsetY);
    dragState = { startCol: col, startRow: row, endCol: col, endRow: row };
    updateCellDisplay(col, row);
    draw();
}

function onPointerMove(e) {
    const [col, row] = quantize(e.offsetX, e.offsetY);
    updateCellDisplay(col, row);
    if (!dragState) return;
    dragState.endCol = col;
    dragState.endRow = row;
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
            label: labelInput.value,
            tone: toneSelect.value,
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
    cellDisplay.textContent = `${col},${row}`;
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

async function clearBlocks() {
    const resp = await fetch('/api/blocks/clear', {
        method: 'POST',
    });
    if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`POST /api/blocks/clear failed: ${resp.status} ${errorText}`);
    }
}

async function onClearBoard() {
    clearBtn.disabled = true;
    try {
        await clearBlocks();
        blocks = [];
        draw();
    } catch (err) {
        console.error('Failed to clear blocks:', err);
        await reloadBlocks();
        draw();
    } finally {
        clearBtn.disabled = false;
    }
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

    const tone = TONES[block.tone] || TONES.amber;

    ctx.save();
    ctx.shadowColor = tone.glow;
    ctx.shadowBlur = 16;
    ctx.fillStyle = tone.fill;
    roundRect(ctx, x1, y1, w, h, r);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = tone.border;
    ctx.lineWidth = 1.5;
    roundRect(ctx, x1, y1, w, h, r);
    ctx.stroke();

    const label = (block.label || '').trim();
    if (!label) {
        return;
    }

    ctx.save();
    roundRect(ctx, x1, y1, w, h, r);
    ctx.clip();
    ctx.fillStyle = tone.text;
    ctx.font = '600 13px Manrope, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x1 + 8, y1 + 6, Math.max(0, w - 16));
    ctx.restore();
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
