# Agent Instructions — notebook-engine (rust-prototype)

> **Audience**: Any AI agent or developer resuming work on this project.
> **Tone**: Precise. Every step is actionable. No filler.
> **Mandate**: Read this entire file before touching any code.

---

## 1. Project Identity

**What it is**: A physical-notebook-style drawing canvas served by an Actix-web binary.
**Where it lives**: `~/gruff/workspace/rust-prototype/`
**Branch**: `rust-prototype-scaffolding`
**Entry point**: `cargo run` → `http://127.0.0.1:8080`

The crate is dual-target: a `[[bin]]` (`notebook-engine`) and a `[lib]` (`notebook_engine`).
The library exists *solely* to let `tests/` import internal types — this is Actix-web's canonical testable pattern.
**Do not collapse the dual target.** It is load-bearing for integration tests.

---

## 2. Orientation — Read These Files First

Before any implementation, read these files in order:

| File | Why |
|------|-----|
| `src/grid.rs` | All math lives here. Understand `quantize()` and `cell_origin()` before adding geometry. |
| `src/handlers.rs` | All HTTP handlers. Follow the exact return signature: `async fn … -> Result<HttpResponse>`. |
| `src/main.rs` | How state is wired. `web::Data::new(config.clone())` inside `move \|\|` is intentional. |
| `static/notebook.js` | Client-side mirror of `grid.rs` math. If you change Rust quantize logic, update JS too. |
| `../design-system/tokens.json` | Every color and spacing value in the UI must come from here. No ad-hoc hex values. |
| `../design-system/SKILL.md` | GRID design system hard rules. Read "Hard rules" section literally. |

---

## 3. Design System Rules (Non-Negotiable)

All visual output — HTML, Canvas drawing, CSS — must comply with the GRID design system.
Source of truth: `../design-system/tokens.json` and `../design-system/preview/colors_and_type.css`.

### Color Palette in Use

```
Background canvas:  #0A0A0F                    --graphite-950 / --bg-0
Block fill:         rgba(245, 158, 11, 0.14)   --primary-soft
Block border:       #F59E0B                    --amber-500 / --primary
Block border soft:  rgba(245, 158, 11, 0.35)   --primary-border / --border-amber
Drag preview:       rgba(245, 158, 11, 0.50)   dashed, mid-opacity amber
Grid dots:          rgba(10, 10, 15, 0.10)     --border-2
Ruled lines:        rgba(10, 10, 15, 0.06)     --border-1
Margin line:        rgba(245, 158, 11, 0.35)   --border-amber
HUD text:           rgba(90, 90, 110, 0.70)    --graphite-500 at 70%
```

### Typography (for any HTML additions)

- **Display / headings**: `'Space Grotesk'` — already referenced in `index.html` font stack
- **Body / labels**: `'Manrope'`
- **Code / coords / data**: `'JetBrains Mono'` — already in `index.html` `font-family`

### HUD / Overlay Components

```
Background:     rgba(10, 10, 15, 0.80)
Border:         1px solid rgba(10, 10, 15, 0.16)   --border-3
Border radius:  6px    --radius-sm
Padding:        8px 12px
```

These values are already in use in `.info` in `static/index.html`. Match them exactly for any new HUD panels.

---

## 4. Coding Conventions — Match What Exists

### Rust

- All public structs in `grid.rs` derive `Clone, Serialize, Deserialize, Debug`.
- Handlers return `actix_web::Result<HttpResponse>`, not bare `impl Responder`.
- State injection: always via `web::Data<T>` parameter — never global statics.
- Tracing: use `tracing::info!()`, `tracing::debug!()` with structured fields, not `println!`.

```rust
info!(block_count = blocks.lock().unwrap().len(), "block committed");
```

- `#[allow(dead_code)]` is a signal that a method is test-only. If you use it in a handler, remove the attribute.

### JavaScript (notebook.js)

- No framework. Vanilla ES2020. `async/await` only.
- State lives in module-level `let` variables: `blocks`, `dragState`, `gridConfig`.
- Every state change ends with a `draw()` call — no partial redraws.
- The `quantize(x, y)` function in JS **must stay in sync** with `GridConfig::quantize` in Rust. If you change the margin clamping logic in one, change both.

### Adding a New Rust Module

1. Create `src/my_module.rs`
2. Add `pub mod my_module;` to `src/lib.rs`
3. Add `mod my_module;` to `src/main.rs` (if handlers need it)

---

## 5. Implementations — Step by Step

Each section below covers one improvement. They are **independent** — implement any in any order.
Every section includes: what to build, where to put it, online reference, verification command.

---

### 5.1 Block Persistence — `POST /api/blocks` + `GET /api/blocks`

**Problem**: Blocks live only in the JS `blocks` array. Refresh = lost work.
**Solution**: In-memory server-side storage with a Mutex-guarded Vec, two endpoints, JS POSTs on commit and GETs on init.

**Reference**: Actix-web shared-mutable-state pattern — https://actix.rs/docs/application/#shared-mutable-state

#### Step 1 — Add `Block` to `src/grid.rs`

```rust
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Block {
    pub id: u64,
    pub min_col: u32,
    pub max_col: u32,
    pub min_row: u32,
    pub max_row: u32,
}
```

#### Step 2 — Add shared state in `src/main.rs`

```rust
use std::sync::{Arc, Mutex};

let block_store: web::Data<Arc<Mutex<Vec<grid::Block>>>> =
    web::Data::new(Arc::new(Mutex::new(vec![])));
let block_counter: web::Data<Arc<Mutex<u64>>> =
    web::Data::new(Arc::new(Mutex::new(0u64)));

// Inside the HttpServer closure, add to App:
// .app_data(block_store.clone())
// .app_data(block_counter.clone())
// .route("/api/blocks", web::get().to(handlers::get_blocks))
// .route("/api/blocks", web::post().to(handlers::post_block))
// .route("/api/blocks/{id}", web::delete().to(handlers::delete_block))
```

#### Step 3 — Add handlers in `src/handlers.rs`

```rust
use std::sync::{Arc, Mutex};
use crate::grid::Block;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct BlockInput {
    pub min_col: u32,
    pub max_col: u32,
    pub min_row: u32,
    pub max_row: u32,
}

pub async fn get_blocks(
    store: web::Data<Arc<Mutex<Vec<Block>>>>,
) -> Result<HttpResponse> {
    let blocks = store.lock().unwrap();
    Ok(HttpResponse::Ok().json(blocks.clone()))
}

pub async fn post_block(
    config: web::Data<GridConfig>,
    store: web::Data<Arc<Mutex<Vec<Block>>>>,
    counter: web::Data<Arc<Mutex<u64>>>,
    body: web::Json<BlockInput>,
) -> Result<HttpResponse> {
    // Server-side re-validation: clamp to margin
    let min_col = body.min_col.max(config.margin_cols);
    let max_col = body.max_col.max(config.margin_cols);

    let mut id_lock = counter.lock().unwrap();
    *id_lock += 1;
    let id = *id_lock;
    drop(id_lock);

    let block = Block { id, min_col, max_col, min_row: body.min_row, max_row: body.max_row };
    store.lock().unwrap().push(block.clone());
    Ok(HttpResponse::Created().json(block))
}

pub async fn delete_block(
    store: web::Data<Arc<Mutex<Vec<Block>>>>,
    path: web::Path<u64>,
) -> Result<HttpResponse> {
    let id = path.into_inner();
    let mut blocks = store.lock().unwrap();
    let before = blocks.len();
    blocks.retain(|b| b.id != id);
    if blocks.len() < before {
        Ok(HttpResponse::NoContent().finish())
    } else {
        Ok(HttpResponse::NotFound().body("block not found"))
    }
}
```

#### Step 4 — Update `notebook.js`

Replace the `onPointerUp` block-push with a POST:

```javascript
async function onPointerUp(e) {
    if (!dragState) return;
    const minCol = Math.min(dragState.startCol, dragState.endCol);
    const maxCol = Math.max(dragState.startCol, dragState.endCol);
    const minRow = Math.min(dragState.startRow, dragState.endRow);
    const maxRow = Math.max(dragState.startRow, dragState.endRow);

    const resp = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ min_col: minCol, max_col: maxCol,
                               min_row: minRow, max_row: maxRow }),
    });
    const block = await resp.json();
    blocks.push(block);
    dragState = null;
    draw();
}
```

Add to `init()` after fetching `gridConfig`:

```javascript
const bResp = await fetch('/api/blocks');
blocks = await bResp.json();
```

**Verification**:

```bash
cargo run &
curl -s -X POST http://127.0.0.1:8080/api/blocks \
  -H 'Content-Type: application/json' \
  -d '{"min_col":2,"max_col":4,"min_row":1,"max_row":3}' | python3 -m json.tool

curl -s http://127.0.0.1:8080/api/blocks | python3 -m json.tool
# Reload browser — block should survive the page refresh
```

---

### 5.2 `--dev` Flag for Hot-Reload Static Files

**Problem**: Every change to `notebook.js` or `index.html` requires `cargo build`.
**Solution**: Behind a `--dev` CLI flag, serve `static/` from disk using `actix-files::Files`. In production mode (default), keep `include_str!` embedded.

**Reference**: actix-files crate docs — https://docs.rs/actix-files/latest/actix_files/
Key API: `actix_files::Files::new("/static", "./static").prefer_utf8(true)`

#### Step 1 — Add `--dev` to CLI in `src/main.rs`

```rust
#[arg(long, default_value_t = false)]
dev: bool,
```

#### Step 2 — Branch the App factory

```rust
let dev_mode = cli.dev;

HttpServer::new(move || {
    let mut app = App::new()
        .app_data(web::Data::new(config.clone()))
        .wrap(middleware::Logger::default())
        .wrap(actix_cors::Cors::permissive())
        .route("/", web::get().to(handlers::index))
        .route("/api/grid", web::get().to(handlers::api_grid));

    if dev_mode {
        app = app.service(
            actix_files::Files::new("/static", "./static").prefer_utf8(true)
        );
    } else {
        app = app.route("/static/{file}", web::get().to(handlers::static_file));
    }
    app
})
```

**Usage**:

```bash
cargo run -- --dev          # edit notebook.js → refresh browser → see changes, no rebuild
cargo run                   # production mode, embedded files
```

**Verification**:

```bash
cargo run -- --dev &
# Change a string in static/notebook.js without rebuilding
curl -s http://127.0.0.1:8080/static/notebook.js | grep "drag to draw"
# Response reflects your edit immediately
```

---

### 5.3 `cargo watch` + Makefile — Eliminate Kill/Restart Juggling

**Problem**: Manual kill-restart cycle causes `AddrInUse` collisions (as experienced during setup).
**Solution**: `cargo-watch` monitors source files and restarts automatically. A `Makefile` standardizes commands.

**Reference**: cargo-watch GitHub — https://github.com/watchexec/cargo-watch

#### Step 1 — Install once

```bash
cargo install cargo-watch
```

#### Step 2 — Create `rust-prototype/Makefile`

```makefile
.PHONY: dev stop run test test-unit test-integration

PORT ?= 8080

dev:
	@pkill -f notebook-engine 2>/dev/null || true
	@sleep 0.3
	cargo watch -x 'run -- --dev --port $(PORT)'

run:
	@pkill -f notebook-engine 2>/dev/null || true
	@sleep 0.3
	cargo run -- --port $(PORT)

stop:
	@pkill -f notebook-engine 2>/dev/null && echo "stopped" || echo "not running"

test:
	cargo test

test-unit:
	cargo test --lib

test-integration:
	cargo test --test grid_quantize
```

**Usage**:

```bash
make dev                    # watch + hot-static (combines 5.2 and 5.3)
make run                    # production foreground
make stop                   # clean kill, no AddrInUse
make test                   # full suite
PORT=9090 make dev          # custom port
```

---

### 5.4 Undo — `Ctrl+Z` Removes Last Block

**Problem**: Once drawn, blocks are permanent until refresh.
**Solution**: `Ctrl+Z` pops the last block from the array. If persistence (5.1) is implemented, also issues `DELETE /api/blocks/{id}`.

**No Rust changes required** if 5.1 is implemented.

Add to `notebook.js` inside `init()` (after event listeners):

```javascript
window.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (blocks.length === 0) return;
        const last = blocks.pop();

        if (last.id !== undefined) {
            await fetch(`/api/blocks/${last.id}`, { method: 'DELETE' });
        }
        draw();
    }
});
```

**Verification**:

```bash
# Open browser → draw 3 blocks → Ctrl+Z three times → all gone
# Reload page → blocks gone (if 5.1 active) or reset (if not)
```

---

### 5.5 Right-Click to Delete a Specific Block

**Problem**: No way to remove a specific block without undoing everything after it.
**Solution**: `contextmenu` event hit-tests blocks at the pointer position and deletes the match.

Add to `notebook.js`:

```javascript
function blockAt(col, row) {
    return blocks.findIndex(b =>
        col >= b.min_col && col <= b.max_col &&
        row >= b.min_row && row <= b.max_row
    );
}

canvas.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    const [col, row] = quantize(e.offsetX, e.offsetY);
    const idx = blockAt(col, row);
    if (idx === -1) return;
    const block = blocks.splice(idx, 1)[0];

    if (block.id !== undefined) {
        await fetch(`/api/blocks/${block.id}`, { method: 'DELETE' });
    }
    draw();
});
```

**Verification**:

```bash
# Open browser → draw blocks → right-click a block → it disappears
# Right-click empty space → no change
```

---

### 5.6 Remove Test Duplication

**Problem**: `src/grid.rs` unit tests and `tests/grid_quantize.rs` integration tests assert identical inputs and outputs — 8 of the 12 tests are exact duplicates. This was valid scaffolding proof but is now waste.

**Recommended action (Option A)**: Keep `tests/grid_quantize.rs` (tests the public lib API — stronger contract), delete the `#[cfg(test)]` block from `src/grid.rs`.

1. Open `src/grid.rs`
2. Delete lines 29–77 (the entire `#[cfg(test)] mod tests { ... }` block)
3. Keep `#[allow(dead_code)]` on `quantize` and `cell_origin` since they remain test-only

**Verification**:

```bash
cargo test 2>&1 | grep "test result"
# Expected:
# test result: ok. 0 passed (lib unit tests, now empty)
# test result: ok. 4 passed (integration tests, still present)
```

---

### 5.7 Live Grid Reconfiguration — `PUT /api/grid`

**Problem**: Changing `cell_px` or `margin_cols` requires killing and restarting the server.
**Solution**: Wrap `GridConfig` in `Arc<RwLock<>>`, expose `PUT /api/grid`, and have JS re-fetch on response.

**Reference**: `std::sync::RwLock` — https://doc.rust-lang.org/std/sync/struct.RwLock.html
Actix state example — https://github.com/actix/examples/tree/master/basics/state

#### Step 1 — Change state type in `src/main.rs`

```rust
use std::sync::{Arc, RwLock};

let config = Arc::new(RwLock::new(GridConfig {
    cell_px: cli.cell_px,
    margin_cols: cli.margin_cols,
}));

// In App builder:
// .app_data(web::Data::new(config.clone()))
// .route("/api/grid", web::put().to(handlers::put_grid))
```

#### Step 2 — Update handlers in `src/handlers.rs`

```rust
pub async fn api_grid(
    config: web::Data<Arc<RwLock<GridConfig>>>,
) -> Result<HttpResponse> {
    let cfg = config.read().unwrap();
    Ok(HttpResponse::Ok().json(cfg.clone()))
}

pub async fn put_grid(
    config: web::Data<Arc<RwLock<GridConfig>>>,
    body: web::Json<GridConfig>,
) -> Result<HttpResponse> {
    let mut cfg = config.write().unwrap();
    cfg.cell_px = body.cell_px.max(8).min(128);        // 8px–128px
    cfg.margin_cols = body.margin_cols.max(0).min(10); // 0–10 cols
    Ok(HttpResponse::Ok().json(cfg.clone()))
}
```

#### Step 3 — Add JS helper to `notebook.js`

```javascript
async function applyGridConfig(cellPx, marginCols) {
    const resp = await fetch('/api/grid', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cell_px: cellPx, margin_cols: marginCols }),
    });
    gridConfig = await resp.json();
    draw();
}
```

**Verification**:

```bash
curl -s -X PUT http://127.0.0.1:8080/api/grid \
  -H 'Content-Type: application/json' \
  -d '{"cell_px":32,"margin_cols":3}' | python3 -m json.tool
# Returns updated config; browser redraws with new grid on next draw()
```

---

## 6. Implementation Sequence (Recommended Order)

If implementing multiple features in one session, follow this order to minimize conflicts:

```
1. 5.6  Test deduplication     — zero risk, no functional change
2. 5.3  Makefile + cargo watch — no source change, immediate workflow win
3. 5.2  --dev flag             — single CLI arg + actix-files branch
4. 5.1  Block persistence      — largest Rust change; do before 5.4 / 5.5
5. 5.4  Undo (Ctrl+Z)          — depends on block.id from 5.1
6. 5.5  Right-click delete     — depends on block.id from 5.1
7. 5.7  PUT /api/grid          — isolated; state type change, do last
```

---

## 7. Process Guards

### Before Every Commit

```bash
cargo fmt                          # format all files
cargo clippy -- -D warnings        # zero warnings policy
cargo test                         # full test suite green
cargo build --release              # release build must succeed
```

### Port Management (Avoid AddrInUse)

The server does **not** self-manage port lifecycle. Always kill before restarting:

```bash
pkill -f notebook-engine 2>/dev/null || true
```

Or `make stop` once the Makefile (5.3) exists.

### Running Multiple Instances

Always use explicit different ports:

```bash
cargo run -- --port 8080 &           # instance A (default config)
cargo run -- --port 9090 --cell-px 32 &  # instance B
curl http://127.0.0.1:8080/api/grid  # A
curl http://127.0.0.1:9090/api/grid  # B
```

---

## 8. What NOT to Change

- **Dual `[[bin]]` / `[lib]` in `Cargo.toml`** — required for integration test imports. Do not remove.
- **`include_str!()` in production mode** — this is correct for single-binary deployment. Do not replace with filesystem reads without the `--dev` guard.
- **`Cors::permissive()`** — fine for this prototype. If moving toward production, replace with an explicit `Cors::default().allowed_origin(...)`.
- **Token values** — do not invent new hex colors. Every visual value must trace back to `../design-system/tokens.json`.
- **Mirror parity of `quantize()`** — if Rust math changes, JS must change to match. Both must produce identical results for the same inputs.

---

## 9. Quick Reference

| Goal | Command |
|------|---------|
| Start server | `cargo run` |
| Start with custom grid | `cargo run -- --cell-px 32 --margin-cols 3` |
| Start dev (hot-reload, after 5.2) | `cargo run -- --dev` |
| Watch + dev (after 5.3) | `make dev` |
| Stop server | `make stop` or `pkill -f notebook-engine` |
| All tests | `cargo test` |
| Integration tests only | `cargo test --test grid_quantize` |
| Unit tests only | `cargo test --lib` |
| Debug logging | `RUST_LOG=debug cargo run` |
| Target module logging | `RUST_LOG=notebook_engine=debug,actix_web=info cargo run` |
| Check grid API | `curl http://127.0.0.1:8080/api/grid` |
| Release build | `cargo build --release` |
| Binary help | `cargo run -- --help` |
