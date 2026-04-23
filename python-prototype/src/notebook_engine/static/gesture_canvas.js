export class GestureCanvas {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.options = {
            cellPx: options.cellPx || 24,
            marginCols: options.marginCols || 2,
            onHover: options.onHover || (() => {}),
            onGestureStart: options.onGestureStart || (() => {}),
            onGestureMove: options.onGestureMove || (() => {}),
            onGestureEnd: options.onGestureEnd || (() => {}),
            draw: options.draw || (() => {}),
        };

        this.dragState = null;
        this.viewport = { width: 0, height: 0 };
        this.pointerId = null;

        this.resize = this.resize.bind(this);
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
        this.onPointerCancel = this.onPointerCancel.bind(this);
    }

    mount() {
        this.resize();
        window.addEventListener('resize', this.resize);
        this.canvas.addEventListener('pointerdown', this.onPointerDown);
        this.canvas.addEventListener('pointermove', this.onPointerMove);
        this.canvas.addEventListener('pointerup', this.onPointerUp);
        this.canvas.addEventListener('pointercancel', this.onPointerCancel);
    }

    setGrid(config) {
        this.options.cellPx = config.cell_px;
        this.options.marginCols = config.margin_cols;
        this.draw();
    }

    quantize(x, y) {
        const col = Math.max(this.options.marginCols, Math.floor(x / this.options.cellPx));
        const row = Math.max(0, Math.floor(y / this.options.cellPx));
        return { col, row };
    }

    normalizeBlock(start, end) {
        return {
            min_col: Math.min(start.col, end.col),
            max_col: Math.max(start.col, end.col),
            min_row: Math.min(start.row, end.row),
            max_row: Math.max(start.row, end.row),
        };
    }

    cellOrigin(col, row) {
        return [col * this.options.cellPx, row * this.options.cellPx];
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.viewport.width = window.innerWidth;
        this.viewport.height = window.innerHeight;
        this.canvas.width = Math.floor(this.viewport.width * dpr);
        this.canvas.height = Math.floor(this.viewport.height * dpr);
        this.canvas.style.width = `${this.viewport.width}px`;
        this.canvas.style.height = `${this.viewport.height}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.draw();
    }

    draw() {
        this.options.draw({
            ctx: this.ctx,
            dragState: this.dragState,
            cellOrigin: (col, row) => this.cellOrigin(col, row),
            viewport: this.viewport,
            cellPx: this.options.cellPx,
            marginCols: this.options.marginCols,
        });
    }

    onPointerDown(event) {
        if (event.button !== 0) {
            return;
        }
        this.pointerId = event.pointerId;
        try {
            this.canvas.setPointerCapture(this.pointerId);
        } catch {
        }
        const cell = this.quantize(event.offsetX, event.offsetY);
        this.dragState = { start: cell, current: cell };
        this.options.onGestureStart(cell);
        this.draw();
    }

    onPointerMove(event) {
        const cell = this.quantize(event.offsetX, event.offsetY);
        this.options.onHover(cell);
        if (!this.dragState) {
            return;
        }
        this.dragState.current = cell;
        this.options.onGestureMove(this.dragState.start, this.dragState.current);
        this.draw();
    }

    onPointerUp() {
        if (!this.dragState) {
            return;
        }
        const block = this.normalizeBlock(this.dragState.start, this.dragState.current);
        this.options.onGestureEnd(block);
        this.dragState = null;
        this.draw();
    }

    onPointerCancel() {
        this.dragState = null;
        this.draw();
    }
}
