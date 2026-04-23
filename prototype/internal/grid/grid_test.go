package grid_test

import (
	"math"
	"testing"

	"notebook-engine/internal/grid"
)

// 40 cols × 30 rows, 24 px/cell → canvas 960×720 px.
func cfg() grid.GridConfig {
	return grid.GridConfig{CellPx: 24, MarginCols: 2, Cols: 40, Rows: 30}
}

// --- existing behaviour (updated for 3-return signature) ---

func TestQuantizeWholeCells(t *testing.T) {
	g := cfg()
	cases := [][4]float32{
		{0, 0, 2, 0},
		{24, 24, 2, 1},
		{48, 48, 2, 2},
	}
	for _, c := range cases {
		col, row, ok := g.Quantize(c[0], c[1])
		wantCol, wantRow := uint32(c[2]), uint32(c[3])
		if !ok {
			t.Errorf("Quantize(%.1f,%.1f): ok=false, want true", c[0], c[1])
		}
		if col != wantCol || row != wantRow {
			t.Errorf("Quantize(%.1f,%.1f) = (%d,%d), want (%d,%d)", c[0], c[1], col, row, wantCol, wantRow)
		}
	}
}

func TestQuantizeFractional(t *testing.T) {
	g := cfg()
	col, row, ok := g.Quantize(12.5, 12.5)
	if !ok || col != 2 || row != 0 {
		t.Errorf("Quantize(12.5,12.5) = (%d,%d,ok=%v), want (2,0,true)", col, row, ok)
	}
	col, row, ok = g.Quantize(36.5, 36.5)
	if !ok || col != 2 || row != 1 {
		t.Errorf("Quantize(36.5,36.5) = (%d,%d,ok=%v), want (2,1,true)", col, row, ok)
	}
}

func TestQuantizeRespectsMargin(t *testing.T) {
	g := cfg()
	col, _, ok := g.Quantize(0, 0)
	if !ok || col != 2 {
		t.Errorf("x=0 should clamp to margin 2, got %d ok=%v", col, ok)
	}
	col, _, ok = g.Quantize(12, 0)
	if !ok || col != 2 {
		t.Errorf("x=12 (inside margin cell) should clamp to 2, got %d ok=%v", col, ok)
	}
	col, _, ok = g.Quantize(72, 0)
	if !ok || col != 3 {
		t.Errorf("x=72 should return col 3, got %d ok=%v", col, ok)
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

// --- NaN / Inf: fail-closed, ok=false ---

func TestQuantizeNaN(t *testing.T) {
	g := cfg()
	nan := float32(math.NaN())
	for _, tc := range []struct {
		x, y float32
	}{
		{nan, 48},
		{48, nan},
		{nan, nan},
	} {
		_, _, ok := g.Quantize(tc.x, tc.y)
		if ok {
			t.Errorf("Quantize(%v,%v): ok=true, want false", tc.x, tc.y)
		}
	}
}

func TestQuantizeInf(t *testing.T) {
	g := cfg()
	posInf := float32(math.Inf(1))
	negInf := float32(math.Inf(-1))
	for _, tc := range []struct {
		x, y float32
	}{
		{posInf, 48},
		{negInf, 48},
		{48, posInf},
		{48, negInf},
		{posInf, posInf},
		{negInf, negInf},
	} {
		_, _, ok := g.Quantize(tc.x, tc.y)
		if ok {
			t.Errorf("Quantize(%v,%v): ok=true, want false", tc.x, tc.y)
		}
	}
}

// --- negative-zero: same cell as +0, ok=true ---

func TestQuantizeNegativeZero(t *testing.T) {
	g := cfg()
	negZero := float32(math.Copysign(0, -1))

	colPos, rowPos, okPos := g.Quantize(0, 0)
	colNeg, rowNeg, okNeg := g.Quantize(negZero, negZero)
	if !okPos || !okNeg {
		t.Fatalf("-0 or +0 returned ok=false")
	}
	if colPos != colNeg || rowPos != rowNeg {
		t.Errorf("-0 cell (%d,%d) != +0 cell (%d,%d)", colNeg, rowNeg, colPos, rowPos)
	}
}

// --- boundary: just inside, exact edge, far past ---

func TestQuantizeBoundaryJustInside(t *testing.T) {
	g := cfg()
	// width = 40*24 = 960; just inside → last column (39).
	x := float32(960) - 0.001
	col, _, ok := g.Quantize(x, 0)
	if !ok || col != 39 {
		t.Errorf("x=width-ε: col=%d ok=%v, want 39 true", col, ok)
	}
	// height = 30*24 = 720; just inside → last row (29).
	y := float32(720) - 0.001
	_, row, ok := g.Quantize(48, y)
	if !ok || row != 29 {
		t.Errorf("y=height-ε: row=%d ok=%v, want 29 true", row, ok)
	}
}

func TestQuantizeBoundaryExactEdge(t *testing.T) {
	g := cfg()
	// x == width (960): clamped to last column (39), ok=true.
	col, _, ok := g.Quantize(960, 0)
	if !ok || col != 39 {
		t.Errorf("x=width: col=%d ok=%v, want 39 true", col, ok)
	}
	// y == height (720): clamped to last row (29), ok=true.
	_, row, ok := g.Quantize(48, 720)
	if !ok || row != 29 {
		t.Errorf("y=height: row=%d ok=%v, want 29 true", row, ok)
	}
}

func TestQuantizeMaxFloat32(t *testing.T) {
	g := cfg()
	big := float32(math.MaxFloat32)
	col, row, ok := g.Quantize(big, big)
	if !ok {
		t.Fatal("MaxFloat32 is a real number — ok should be true")
	}
	if col != g.Cols-1 {
		t.Errorf("MaxFloat32 col=%d, want %d", col, g.Cols-1)
	}
	if row != g.Rows-1 {
		t.Errorf("MaxFloat32 row=%d, want %d", row, g.Rows-1)
	}
}

// --- negative coordinates: clamp to nearest valid cell ---

func TestQuantizeNegativeCoords(t *testing.T) {
	g := cfg()
	col, row, ok := g.Quantize(-100, -50)
	if !ok {
		t.Fatal("negative coords should clamp, ok=true")
	}
	if col != g.MarginCols {
		t.Errorf("negative x: col=%d, want margin %d", col, g.MarginCols)
	}
	if row != 0 {
		t.Errorf("negative y: row=%d, want 0", row)
	}
}

// --- subnormals near zero: ok=true, cell 0 (then margin clamp for col) ---

func TestQuantizeSubnormal(t *testing.T) {
	g := cfg()
	// Smallest positive subnormal float32 ≈ 1.4e-45.
	sub := math.Float32frombits(1)
	col, row, ok := g.Quantize(sub, sub)
	if !ok {
		t.Fatal("subnormal should be ok=true")
	}
	// sub / 24 ≈ 0 → col 0 → margin-clamped to 2.
	if col != g.MarginCols {
		t.Errorf("subnormal col=%d, want margin %d", col, g.MarginCols)
	}
	if row != 0 {
		t.Errorf("subnormal row=%d, want 0", row)
	}
}

// --- table-driven comprehensive round-trip ---

func TestQuantizeTable(t *testing.T) {
	g := cfg()
	width := float32(g.Cols * g.CellPx)
	height := float32(g.Rows * g.CellPx)

	type tc struct {
		label   string
		x, y    float32
		wantCol uint32
		wantRow uint32
		wantOK  bool
	}
	cases := []tc{
		{"origin", 0, 0, 2, 0, true},
		{"mid-cell", 49, 25, 2, 1, true},
		{"neg-x", -1, 48, 2, 2, true},
		{"neg-y", 48, -1, 2, 0, true},
		{"past-width", width + 100, 48, 39, 2, true},
		{"past-height", 48, height + 100, 2, 29, true},
		{"nan-x", float32(math.NaN()), 0, 0, 0, false},
		{"nan-y", 0, float32(math.NaN()), 0, 0, false},
		{"inf-x", float32(math.Inf(1)), 0, 0, 0, false},
		{"neg-inf-y", 0, float32(math.Inf(-1)), 0, 0, false},
		{"maxfloat32", float32(math.MaxFloat32), float32(math.MaxFloat32), 39, 29, true},
	}
	for _, c := range cases {
		t.Run(c.label, func(t *testing.T) {
			col, row, ok := g.Quantize(c.x, c.y)
			if ok != c.wantOK {
				t.Fatalf("ok=%v, want %v", ok, c.wantOK)
			}
			if !c.wantOK {
				return
			}
			if col != c.wantCol || row != c.wantRow {
				t.Errorf("(%d,%d), want (%d,%d)", col, row, c.wantCol, c.wantRow)
			}
		})
	}
}
