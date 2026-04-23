package grid_test

import (
	"math"
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

// TestQuantizeOutOfRange exercises the boundary inputs that a float→uint32
// cast would otherwise turn into implementation-defined garbage: negatives,
// NaN, ±Inf, and values larger than maxCoord. All must resolve to
// deterministic in-range cells without panicking.
func TestQuantizeOutOfRange(t *testing.T) {
	g := cfg()
	posInf := float32(math.Inf(1))
	negInf := float32(math.Inf(-1))
	nan := float32(math.NaN())

	cases := []struct {
		name    string
		x, y    float32
		wantCol uint32
		wantRow uint32
	}{
		{"negative x small", -1, 0, 2, 0},
		{"negative x large", -1_000_000, 0, 2, 0},
		{"negative y", 0, -1, 2, 0},
		{"both negative", -5, -5, 2, 0},
		{"NaN x", nan, 0, 2, 0},
		{"NaN y", 0, nan, 2, 0},
		{"NaN both", nan, nan, 2, 0},
		{"minus infinity", negInf, negInf, 2, 0},
		{"plus infinity", posInf, posInf, math.MaxInt32, math.MaxInt32},
		{"far overflow", 1e30, 1e30, math.MaxInt32, math.MaxInt32},
		{"zero stays clamped", 0, 0, 2, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			col, row := g.Quantize(tc.x, tc.y)
			if col != tc.wantCol || row != tc.wantRow {
				t.Errorf("Quantize(%v,%v) = (%d,%d), want (%d,%d)",
					tc.x, tc.y, col, row, tc.wantCol, tc.wantRow)
			}
		})
	}
}

// TestQuantizeZeroCellPx guards against a divide-by-zero when the grid is
// mis-configured with CellPx == 0. The result should be the minimum in-range
// cell rather than a panic or Inf/NaN leaking through the cast.
func TestQuantizeZeroCellPx(t *testing.T) {
	g := grid.GridConfig{CellPx: 0, MarginCols: 2}
	col, row := g.Quantize(100, 100)
	if col != 2 || row != 0 {
		t.Errorf("Quantize with CellPx=0 = (%d,%d), want (2,0)", col, row)
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
