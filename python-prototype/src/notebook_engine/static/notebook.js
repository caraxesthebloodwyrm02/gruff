import { GestureCanvas } from '/static/gesture_canvas.js';

const canvas = document.getElementById('nb');
const labelInput = document.getElementById('label-input');
const toneSelect = document.getElementById('tone-select');
const profileSelect = document.getElementById('profile-select');
const renderBtn = document.getElementById('render-btn');
const bridgeBtn = document.getElementById('bridge-btn');
const markdownBtn = document.getElementById('markdown-btn');
const clearBtn = document.getElementById('clear-btn');

const runtimeFeed = document.getElementById('runtime-feed');
const craftStatus = document.getElementById('craft-status');
const wsStatus = document.getElementById('ws-status');
const chipNotebook = document.getElementById('chip-notebook');
const chipRevision = document.getElementById('chip-revision');
const revisionList = document.getElementById('revision-list');
const metricBlocks = document.getElementById('metric-blocks');
const metricDensity = document.getElementById('metric-density');
const metricMargin = document.getElementById('metric-margin');
const metricGesture = document.getElementById('metric-gesture');

let manifest = null;
let liveSocket = null;
let reconnectTimer = null;
let reconnectDelayMs = 800;

/** Server-assigned monotonic ids on WS frames; ignore replays for de-duplication. */
const EVT_WINDOW = 256;
const recentEvts = [];
const recentEvtSet = new Set();

/** If the channel is open but we receive no fresh frames, surface a stale HUD state. */
const STALE_AFTER_MS = 45000;
let lastWsActivity = Date.now();
let staleCheckTimer = null;
let staleWatchStarted = false;

function isDuplicateEvt(evt) {
    if (evt == null || typeof evt !== 'number') {
        return false;
    }
    if (recentEvtSet.has(evt)) {
        return true;
    }
    recentEvtSet.add(evt);
    recentEvts.push(evt);
    while (recentEvts.length > EVT_WINDOW) {
        const drop = recentEvts.shift();
        recentEvtSet.delete(drop);
    }
    return false;
}

function touchWsActivity() {
    lastWsActivity = Date.now();
    wsStatus.classList.remove('ws-stale');
    if (wsStatus.textContent === 'stale') {
        wsStatus.textContent = 'live';
    }
}

function startStaleChecker() {
    if (staleCheckTimer) {
        clearInterval(staleCheckTimer);
    }
    staleCheckTimer = setInterval(() => {
        if (!liveSocket || liveSocket.readyState !== WebSocket.OPEN) {
            return;
        }
        if (Date.now() - lastWsActivity > STALE_AFTER_MS) {
            wsStatus.textContent = 'stale';
            wsStatus.classList.add('ws-stale');
        }
    }, 4000);
}

const TONES = {
    amber: { border: '#ffb703', fill: 'rgba(255, 183, 3, 0.16)', glow: 'rgba(255, 183, 3, 0.32)', text: '#ffe8a3' },
    mint: { border: '#2ec4b6', fill: 'rgba(46, 196, 182, 0.16)', glow: 'rgba(46, 196, 182, 0.28)', text: '#b8f4ee' },
    azure: { border: '#6cb8ff', fill: 'rgba(108, 184, 255, 0.15)', glow: 'rgba(108, 184, 255, 0.28)', text: '#d4ecff' },
    rose: { border: '#f28482', fill: 'rgba(242, 132, 130, 0.16)', glow: 'rgba(242, 132, 130, 0.26)', text: '#ffd4d3' },
    slate: { border: '#94a3b8', fill: 'rgba(148, 163, 184, 0.16)', glow: 'rgba(148, 163, 184, 0.24)', text: '#e2e8f0' },
};

function logFeed(message, payload = null) {
    const lines = [message];
    if (payload) {
        lines.push(JSON.stringify(payload, null, 2));
    }
    runtimeFeed.textContent = lines.join('\n');
}

function setManifest(nextManifest) {
    manifest = nextManifest;
    chipNotebook.textContent = manifest.notebook_id;
    chipRevision.textContent = manifest.current_revision_id || '-';
    metricBlocks.textContent = String(manifest.blocks.length);

    const metrics = manifest.integration?.compass?.last_metrics;
    metricDensity.textContent = metrics ? `${Math.round(metrics.density * 100)}%` : '0%';
    metricMargin.textContent = metrics ? `${Math.round(metrics.margin_adherence * 100)}%` : '0%';
    metricGesture.textContent = metrics ? `${Math.round(metrics.gesture_velocity_proxy * 100)}%` : '0%';
    renderRevisions(manifest.revisions || []);
    renderer.setGrid(manifest.grid);
    renderer.draw();
}

function renderRevisions(revisions) {
    revisionList.innerHTML = '';
    const recent = revisions.slice(-6).reverse();
    for (const revision of recent) {
        const item = document.createElement('li');
        item.innerHTML = `<strong>${revision.summary}</strong><span>${revision.revision_id} • ${revision.actor}</span>`;
        revisionList.appendChild(item);
    }
}

function blockAt(col, row) {
    if (!manifest) {
        return null;
    }
    for (let index = manifest.blocks.length - 1; index >= 0; index -= 1) {
        const block = manifest.blocks[index];
        if (col >= block.min_col && col <= block.max_col && row >= block.min_row && row <= block.max_row) {
            return block;
        }
    }
    return null;
}

async function request(url, options = {}) {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
        throw new Error(typeof body === 'string' ? body : JSON.stringify(body));
    }
    return body;
}

async function loadInitialState() {
    const [health, nextManifest] = await Promise.all([request('/api/health'), request('/api/manifest')]);
    craftStatus.textContent = health.craftReady ? 'ready' : `blocked: ${health.craftDetail}`;
    setManifest(nextManifest);
    logFeed('Loaded manifest', { revision: nextManifest.current_revision_id, blocks: nextManifest.blocks.length });
}

function connectLiveChannel() {
    if (liveSocket && liveSocket.readyState <= WebSocket.OPEN) {
        return;
    }
    if (!staleWatchStarted) {
        staleWatchStarted = true;
        startStaleChecker();
    }
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    liveSocket = new WebSocket(`${protocol}://${window.location.host}/ws`);

    liveSocket.addEventListener('open', () => {
        wsStatus.textContent = 'live';
        wsStatus.classList.remove('ws-stale');
        reconnectDelayMs = 800;
        touchWsActivity();
    });

    liveSocket.addEventListener('message', (event) => {
        const payload = JSON.parse(event.data);
        if (isDuplicateEvt(payload.evt)) {
            return;
        }
        touchWsActivity();
        if (payload.manifest) {
            setManifest(payload.manifest);
        }
        logFeed(`WS ${payload.type}`, payload.type === 'hello' ? { revision: payload.manifest?.current_revision_id } : payload);
    });

    liveSocket.addEventListener('close', () => {
        wsStatus.textContent = 'reconnecting';
        wsStatus.classList.remove('ws-stale');
        if (!reconnectTimer) {
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                connectLiveChannel();
            }, reconnectDelayMs);
            reconnectDelayMs = Math.min(reconnectDelayMs * 2, 8000);
        }
    });

    liveSocket.addEventListener('error', () => {
        wsStatus.textContent = 'error';
        wsStatus.classList.remove('ws-stale');
    });
}

function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function drawBlock(ctx, block, cellOrigin) {
    const tone = TONES[block.tone] || TONES.amber;
    const [x1, y1] = cellOrigin(block.min_col, block.min_row);
    const [x2, y2] = cellOrigin(block.max_col + 1, block.max_row + 1);
    const width = x2 - x1;
    const height = y2 - y1;

    ctx.save();
    ctx.shadowColor = tone.glow;
    ctx.shadowBlur = 18;
    ctx.fillStyle = tone.fill;
    roundRect(ctx, x1, y1, width, height, 5);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = tone.border;
    ctx.lineWidth = 1.6;
    roundRect(ctx, x1, y1, width, height, 5);
    ctx.stroke();

    if (block.label) {
        ctx.fillStyle = tone.text;
        ctx.font = '600 13px Manrope, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(block.label, x1 + 8, y1 + 7, Math.max(0, width - 16));
    }
}

const renderer = new GestureCanvas(canvas, {
    onHover(cell) {
        const hovered = blockAt(cell.col, cell.row);
        canvas.style.cursor = hovered ? 'pointer' : 'crosshair';
    },
    async onGestureEnd(block) {
        const created = await request('/api/blocks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...block,
                label: labelInput.value,
                tone: toneSelect.value,
            }),
        });
        logFeed('Created block', created);
    },
    draw({ ctx, dragState, cellOrigin, viewport, cellPx, marginCols }) {
        ctx.fillStyle = '#081019';
        ctx.fillRect(0, 0, viewport.width, viewport.height);

        const cols = Math.ceil(viewport.width / cellPx) + 1;
        const rows = Math.ceil(viewport.height / cellPx) + 1;

        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 0.6;
        for (let row = 1; row < rows; row += 1) {
            const y = row * cellPx;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(viewport.width, y);
            ctx.stroke();
        }

        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        for (let col = 0; col < cols; col += 1) {
            for (let row = 0; row < rows; row += 1) {
                ctx.beginPath();
                ctx.arc(col * cellPx, row * cellPx, 1.3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.strokeStyle = 'rgba(255,183,3,0.32)';
        ctx.beginPath();
        ctx.moveTo(marginCols * cellPx, 0);
        ctx.lineTo(marginCols * cellPx, viewport.height);
        ctx.stroke();

        if (manifest) {
            manifest.blocks.forEach((block) => drawBlock(ctx, block, cellOrigin));
        }

        if (dragState) {
            const preview = {
                min_col: Math.min(dragState.start.col, dragState.current.col),
                max_col: Math.max(dragState.start.col, dragState.current.col),
                min_row: Math.min(dragState.start.row, dragState.current.row),
                max_row: Math.max(dragState.start.row, dragState.current.row),
                tone: toneSelect.value,
                label: labelInput.value,
            };
            const [x1, y1] = cellOrigin(preview.min_col, preview.min_row);
            const [x2, y2] = cellOrigin(preview.max_col + 1, preview.max_row + 1);
            ctx.strokeStyle = 'rgba(255,183,3,0.75)';
            ctx.lineWidth = 1.8;
            ctx.setLineDash([6, 5]);
            roundRect(ctx, x1, y1, x2 - x1, y2 - y1, 5);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    },
});

async function onRenderCompass() {
    renderBtn.disabled = true;
    try {
        const payload = await request(`/api/compass/render?profile=${encodeURIComponent(profileSelect.value)}`, { method: 'POST' });
        logFeed('Compass rendered', payload);
    } finally {
        renderBtn.disabled = false;
    }
}

async function onEmitBridge() {
    bridgeBtn.disabled = true;
    try {
        const payload = await request('/api/bridge/payload', { method: 'POST' });
        logFeed('Bridge payload emitted', payload);
    } finally {
        bridgeBtn.disabled = false;
    }
}

async function onMarkdownExport() {
    const markdown = await request('/api/exports/markdown');
    logFeed('Markdown export', { preview: markdown.split('\n').slice(0, 8).join('\n') });
}

async function onClearBoard() {
    clearBtn.disabled = true;
    try {
        await request('/api/blocks/clear', { method: 'POST' });
        logFeed('Cleared board');
    } finally {
        clearBtn.disabled = false;
    }
}

canvas.addEventListener('contextmenu', async (event) => {
    event.preventDefault();
    const cell = renderer.quantize(event.offsetX, event.offsetY);
    const target = blockAt(cell.col, cell.row);
    if (!target) {
        return;
    }
    await request(`/api/blocks/${encodeURIComponent(target.id)}`, { method: 'DELETE' });
    logFeed('Deleted block', { blockId: target.id });
});

window.addEventListener('keydown', async (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && manifest?.blocks.length) {
        event.preventDefault();
        const latest = manifest.blocks[manifest.blocks.length - 1];
        await request(`/api/blocks/${encodeURIComponent(latest.id)}`, { method: 'DELETE' });
    }
});

renderBtn.addEventListener('click', onRenderCompass);
bridgeBtn.addEventListener('click', onEmitBridge);
markdownBtn.addEventListener('click', onMarkdownExport);
clearBtn.addEventListener('click', onClearBoard);

await loadInitialState();
renderer.mount();
connectLiveChannel();
