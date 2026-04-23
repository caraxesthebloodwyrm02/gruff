package blocks_test

import (
	"testing"

	"notebook-engine/internal/blocks"
)

func ptr(v uint32) *uint32 { return &v }

func TestToBoundsBoundsShape(t *testing.T) {
	p := blocks.BlockCreate{MinCol: ptr(2), MaxCol: ptr(5), MinRow: ptr(1), MaxRow: ptr(3)}
	b, err := p.ToBounds()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if b != (blocks.Bounds{2, 5, 1, 3}) {
		t.Errorf("got %+v", b)
	}
}

func TestToBoundsStartEndNormalizes(t *testing.T) {
	p := blocks.BlockCreate{StartCol: ptr(5), StartRow: ptr(3), EndCol: ptr(2), EndRow: ptr(1)}
	b, err := p.ToBounds()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if b != (blocks.Bounds{2, 5, 1, 3}) {
		t.Errorf("got %+v", b)
	}
}

func TestToBoundsRejectsMixed(t *testing.T) {
	p := blocks.BlockCreate{MinCol: ptr(2), StartCol: ptr(2)}
	if _, err := p.ToBounds(); err == nil {
		t.Fatal("expected error for mixed shapes")
	}
}

func TestToBoundsRejectsIncomplete(t *testing.T) {
	p := blocks.BlockCreate{MinCol: ptr(2), MaxCol: ptr(3)}
	if _, err := p.ToBounds(); err == nil {
		t.Fatal("expected error for incomplete bounds")
	}
}

func TestToBoundsRejectsEmpty(t *testing.T) {
	if _, err := (blocks.BlockCreate{}).ToBounds(); err == nil {
		t.Fatal("expected error for empty payload")
	}
}

func TestToBoundsRejectsInvertedBounds(t *testing.T) {
	p := blocks.BlockCreate{MinCol: ptr(5), MaxCol: ptr(2), MinRow: ptr(0), MaxRow: ptr(0)}
	if _, err := p.ToBounds(); err == nil {
		t.Fatal("expected error for min_col > max_col")
	}
}

func TestStoreLifecycle(t *testing.T) {
	s := blocks.NewInMemoryStore()
	if got := s.List(); len(got) != 0 {
		t.Fatalf("expected empty store, got %d", len(got))
	}
	b := s.Create(blocks.Bounds{2, 3, 1, 2})
	if b.ID == "" {
		t.Fatal("expected generated id")
	}
	if got := s.List(); len(got) != 1 {
		t.Fatalf("expected 1 block, got %d", len(got))
	}
	if !s.Delete(b.ID) {
		t.Fatal("expected delete to succeed")
	}
	if s.Delete(b.ID) {
		t.Fatal("expected second delete to return false")
	}
	s.Create(blocks.Bounds{2, 3, 1, 2})
	s.Create(blocks.Bounds{4, 5, 1, 2})
	s.Clear()
	if got := s.List(); len(got) != 0 {
		t.Fatalf("expected empty after clear, got %d", len(got))
	}
}

func TestCreateForGridRejectsMarginViolation(t *testing.T) {
	s := blocks.NewInMemoryStore()
	payload := blocks.BlockCreate{MinCol: ptr(1), MaxCol: ptr(3), MinRow: ptr(0), MaxRow: ptr(0)}
	if _, err := blocks.CreateForGrid(s, payload, 2); err == nil {
		t.Fatal("expected margin violation error")
	}
	if got := s.List(); len(got) != 0 {
		t.Fatalf("expected store untouched, got %d blocks", len(got))
	}
}

func TestCreateForGridAcceptsValid(t *testing.T) {
	s := blocks.NewInMemoryStore()
	payload := blocks.BlockCreate{StartCol: ptr(3), StartRow: ptr(0), EndCol: ptr(5), EndRow: ptr(2)}
	b, err := blocks.CreateForGrid(s, payload, 2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if b.MinCol != 3 || b.MaxCol != 5 || b.MinRow != 0 || b.MaxRow != 2 {
		t.Errorf("unexpected block: %+v", b)
	}
}
