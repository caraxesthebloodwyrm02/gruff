# Design Decisions

## Grid Geometry
- `Quantize`: floor-divide x/y by cell_px, then clamp col to margin_cols minimum
- `CellOrigin`: multiply col/row by cell_px to get pixel top-left

## HTTP Handlers
- Use Go's `embed` directive for static assets (compiled into binary)
- Single-page app served from `/`, grid config from `/api/grid`, JS from `/static/notebook.js`

## Constraints
- No external file I/O at runtime (all assets embedded)
- Minimal dependencies (gin only)

## Future Iterations
- WebSocket real-time sync
- Persistent block storage (SQLite)
- Undo/redo
- Text input inside blocks
- Touch pressure/stylus support
