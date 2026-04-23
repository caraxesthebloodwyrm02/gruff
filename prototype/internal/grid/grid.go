package grid

import "math"

// GridConfig holds the parameters that define the notebook grid.
type GridConfig struct {
	CellPx     uint32 `json:"cell_px"`
	MarginCols uint32 `json:"margin_cols"`
	Cols       uint32 `json:"cols"`
	Rows       uint32 `json:"rows"`
}

// Quantize maps a canvas-space point to a grid cell.
// Returns ok=false for NaN/Inf or otherwise unrepresentable input.
// In-plane coordinates outside [0, width) x [0, height) are clamped
// to the nearest valid cell and return ok=true.
// The exact boundary (x == width, y == height) is clamped to the last cell.
//
// Implementation note: clamping is done in float32 space *before* the
// float32→uint32 conversion. Per Go spec §Conversions, converting a
// floating-point value that does not fit in the integer type is
// implementation-defined (on x86, cvttss2si returns 0x80000000 on
// overflow, which reinterprets as a large uint32). Never rely on
// uint32(bigFloat) saturating to MaxUint32.
//
// Config invariant: MarginCols must be < Cols. If MarginCols >= Cols the
// margin floor is applied after the Cols-1 upper clamp, producing a col
// value that exceeds the grid width. Callers are responsible for
// constructing a valid GridConfig.
func (g GridConfig) Quantize(x, y float32) (col, row uint32, ok bool) {
	if isNaNOrInf(x) || isNaNOrInf(y) {
		return 0, 0, false
	}

	cellF := float32(g.CellPx)

	// Column: clamp in float-space before converting (see spec note above).
	cx := x / cellF
	if cx < 0 {
		cx = 0
	}
	maxCol := float32(g.Cols - 1)
	if g.Cols > 0 && cx > maxCol {
		cx = maxCol
	}
	col = uint32(cx)
	if col < g.MarginCols {
		col = g.MarginCols
	}

	// Row: clamp in float-space, then convert.
	ry := y / cellF
	if ry < 0 {
		ry = 0
	}
	maxRow := float32(g.Rows - 1)
	if g.Rows > 0 && ry > maxRow {
		ry = maxRow
	}
	row = uint32(ry)

	return col, row, true
}

func isNaNOrInf(f float32) bool {
	return math.IsNaN(float64(f)) || math.IsInf(float64(f), 0)
}

// CellOrigin returns the pixel coordinate of a cell's top-left corner.
func (g GridConfig) CellOrigin(col, row uint32) (float32, float32) {
	return float32(col) * float32(g.CellPx), float32(row) * float32(g.CellPx)
}
