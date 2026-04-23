package grid_test

import (
	"testing"

	"notebook-engine/internal/grid"
)

func cfg() grid.GridConfig {
	return grid.GridConfig{CellPx: 24, MarginCols: 2}
}

func TestQuantizeWholeCells(t *testing.T) {
	g := cfg()
	cases := [][4]float32{
		{0, 0, 2, 0},
		{24, 24, 2, 1},
		{48, 48, 2, 2},
	}
	for _, c := range cases {
		col, row := g.Quantize(c[0], c[1])
		wantCol, wantRow := uint32(c[2]), uint32(c[3])
		if col != wantCol || row != wantRow {
			t.Errorf("Quantize(%.1f,%.1f) = (%d,%d), want (%d,%d)", c[0], c[1], col, row, wantCol, wantRow)
		}
	}
}

func TestQuantizeFractional(t *testing.T) {
	g := cfg()
	col, row := g.Quantize(12.5, 12.5)
	if col != 2 || row != 0 {
		t.Errorf("Quantize(12.5,12.5) = (%d,%d), want (2,0)", col, row)
	}
	col, row = g.Quantize(36.5, 36.5)
	if col != 2 || row != 1 {
		t.Errorf("Quantize(36.5,36.5) = (%d,%d), want (2,1)", col, row)
	}
}

func TestQuantizeRespectsMargin(t *testing.T) {
	g := cfg()
	col, _ := g.Quantize(0, 0)
	if col != 2 {
		t.Errorf("x=0 should clamp to margin 2, got %d", col)
	}
	col, _ = g.Quantize(12, 0)
	if col != 2 {
		t.Errorf("x=12 (inside margin cell) should clamp to 2, got %d", col)
	}
	col, _ = g.Quantize(72, 0)
	if col != 3 {
		t.Errorf("x=72 should return col 3, got %d", col)
	}
}

func TestCellOrigin(t *testing.T) {
	g := cfg()
	ox, oy := g.CellOrigin(2, 0)
	if ox != 48.0 || oy != 0.0 {
		t.Errorf("CellOrigin(2,0) = (%.1f,%.1f), want (48.0,0.0)", ox, oy)
	}
	ox, oy = g.CellOrigin(3, 1)
	if ox != 72.0 || oy != 24.0 {
		t.Errorf("CellOrigin(3,1) = (%.1f,%.1f), want (72.0,24.0)", ox, oy)
	}
}
