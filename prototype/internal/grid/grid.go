package grid

import "math"

// GridConfig holds the two parameters that define the notebook grid.
type GridConfig struct {
	CellPx     uint32 `json:"cell_px"`
	MarginCols uint32 `json:"margin_cols"`
}

// maxCoord is the upper bound used when clamping out-of-range coordinates.
// Go spec says converting a floating-point value that does not fit in the
// destination type produces an implementation-dependent result, so any
// NaN / ±Inf / very-large float must be snapped to a concrete value before
// the uint32 cast. math.MaxInt32 is well above any realistic grid size and
// leaves headroom for arithmetic on the result.
const maxCoord uint32 = math.MaxInt32

// Quantize snaps a pixel coordinate to the nearest grid cell (col, row).
//
// The returned col is never less than MarginCols. Inputs that cannot be
// represented as a valid uint32 cell index — NaN, ±Inf, negatives, or values
// larger than maxCoord — are clamped to a safe in-range cell so callers
// never observe the implementation-defined wraparound that float→uint casts
// otherwise produce. When CellPx is zero the grid is undefined and both
// coordinates collapse to (MarginCols, 0).
func (g GridConfig) Quantize(x, y float32) (uint32, uint32) {
	col := quantizeAxis(x, g.CellPx, g.MarginCols)
	row := quantizeAxis(y, g.CellPx, 0)
	return col, row
}

func quantizeAxis(v float32, cellPx, minCell uint32) uint32 {
	if cellPx == 0 {
		return minCell
	}
	f := float64(v)
	if math.IsNaN(f) || f <= 0 {
		return minCell
	}
	raw := f / float64(cellPx)
	if raw >= float64(maxCoord) {
		return maxCoord
	}
	cell := uint32(raw)
	if cell < minCell {
		cell = minCell
	}
	return cell
}

// CellOrigin returns the pixel coordinate of a cell's top-left corner.
func (g GridConfig) CellOrigin(col, row uint32) (float32, float32) {
	return float32(col) * float32(g.CellPx), float32(row) * float32(g.CellPx)
}
