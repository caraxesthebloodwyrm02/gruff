package grid

// GridConfig holds the two parameters that define the notebook grid.
type GridConfig struct {
	CellPx     uint32 `json:"cell_px"`
	MarginCols uint32 `json:"margin_cols"`
}

// Quantize snaps a pixel coordinate to the nearest grid cell (col, row).
// The returned col is never less than MarginCols.
func (g GridConfig) Quantize(x, y float32) (uint32, uint32) {
	col := uint32(x / float32(g.CellPx))
	row := uint32(y / float32(g.CellPx))
	if col < g.MarginCols {
		col = g.MarginCols
	}
	return col, row
}

// CellOrigin returns the pixel coordinate of a cell's top-left corner.
func (g GridConfig) CellOrigin(col, row uint32) (float32, float32) {
	return float32(col) * float32(g.CellPx), float32(row) * float32(g.CellPx)
}
