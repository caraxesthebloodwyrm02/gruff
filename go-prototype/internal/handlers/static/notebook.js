const canvas = document.getElementById('nb');
const ctx = canvas.getContext('2d');

let gridConfig = null;
let blocks = [];
let dragState = null;

async function init() {
    // Fetch grid config from backend
    try {
        const resp = await fetch('/api/grid');
        gridConfig = await resp.json();
        console.log('Grid config:', gridConfig);
    } catch (e) {
        console.error('Failed to fetch grid config:', e);
        gridConfig = { cell_px: 24, margin_cols: 2 };
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);

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

function onPointerUp(e) {
    if (!dragState) return;
    // Commit block
    const minCol = Math.min(dragState.startCol, dragState.endCol);
    const maxCol = Math.max(dragState.startCol, dragState.endCol);
    const minRow = Math.min(dragState.startRow, dragState.endRow);
    const maxRow = Math.max(dragState.startRow, dragState.endRow);

    blocks.push({
        minCol,
        maxCol,
        minRow,
        maxRow,
    });

    dragState = null;
    draw();
}

function onPointerCancel(e) {
    dragState = null;
    draw();
}

function updateCellDisplay(col, row) {
    document.getElementById('cell-display').textContent = `${col},${row}`;
}

function draw() {
    // Clear
    ctx.fillStyle = '#0A0A0F';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    drawGrid();

    // Draw committed blocks
    blocks.forEach(block => drawBlock(block));

    // Draw drag preview
    if (dragState) {
        const minCol = Math.min(dragState.startCol, dragState.endCol);
        const maxCol = Math.max(dragState.startCol, dragState.endCol);
        const minRow = Math.min(dragState.startRow, dragState.endRow);
        const maxRow = Math.max(dragState.startRow, dragState.endRow);

        const [x1, y1] = cellOrigin(minCol, minRow);
        const [x2, y2] = cellOrigin(maxCol + 1, maxRow + 1);
        const w = x2 - x1;
        const h = y2 - y1;

        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x1, y1, w, h);
        ctx.setLineDash([]);
    }
}

function drawGrid() {
    const cellPx = gridConfig.cell_px;
    const marginPx = gridConfig.margin_cols * cellPx;
    const cols = Math.ceil(canvas.width / cellPx) + 1;
    const rows = Math.ceil(canvas.height / cellPx) + 1;

    // Dots at intersections
    ctx.fillStyle = 'rgba(10, 10, 15, 0.10)';
    for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
            const x = col * cellPx;
            const y = row * cellPx;
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Ruled horizontal lines
    ctx.strokeStyle = 'rgba(10, 10, 15, 0.06)';
    ctx.lineWidth = 0.5;
    for (let row = 1; row < rows; row++) {
        const y = row * cellPx;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Margin line
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marginPx, 0);
    ctx.lineTo(marginPx, canvas.height);
    ctx.stroke();
}

function drawBlock(block) {
    const [x1, y1] = cellOrigin(block.minCol, block.minRow);
    const [x2, y2] = cellOrigin(block.maxCol + 1, block.maxRow + 1);
    const w = x2 - x1;
    const h = y2 - y1;

    // Fill
    ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
    ctx.fillRect(x1, y1, w, h);

    // Border
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.strokeRect(x1, y1, w, h);
}

init();
