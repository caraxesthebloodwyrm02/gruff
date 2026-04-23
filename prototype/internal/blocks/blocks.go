// Package blocks implements the in-memory store and DTOs for notebook blocks.
//
// Mirrors the Rust `src/blocks.rs` and Python `notebook_engine.blocks` contracts
// so that all three cascade implementations expose identical JSON shapes.
package blocks

import (
	"errors"
	"sync"

	"github.com/google/uuid"
)

// Block is the persisted shape returned by all block endpoints.
type Block struct {
	ID     string `json:"id"`
	MinCol uint32 `json:"min_col"`
	MaxCol uint32 `json:"max_col"`
	MinRow uint32 `json:"min_row"`
	MaxRow uint32 `json:"max_row"`
}

// BlockCreate is the POST /api/blocks request body.
//
// The payload accepts EITHER fully-specified bounds (min_col/max_col/min_row/max_row)
// OR start/end point pairs (start_col/start_row/end_col/end_row). Mixing shapes
// or providing an incomplete shape is rejected.
type BlockCreate struct {
	MinCol *uint32 `json:"min_col,omitempty"`
	MaxCol *uint32 `json:"max_col,omitempty"`
	MinRow *uint32 `json:"min_row,omitempty"`
	MaxRow *uint32 `json:"max_row,omitempty"`

	StartCol *uint32 `json:"start_col,omitempty"`
	StartRow *uint32 `json:"start_row,omitempty"`
	EndCol   *uint32 `json:"end_col,omitempty"`
	EndRow   *uint32 `json:"end_row,omitempty"`
}

// Bounds holds validated (min_col, max_col, min_row, max_row).
type Bounds struct {
	MinCol, MaxCol, MinRow, MaxRow uint32
}

// ToBounds validates the request shape and normalizes start/end into bounds.
func (b BlockCreate) ToBounds() (Bounds, error) {
	hasBounds := b.MinCol != nil || b.MaxCol != nil || b.MinRow != nil || b.MaxRow != nil
	hasPoints := b.StartCol != nil || b.StartRow != nil || b.EndCol != nil || b.EndRow != nil

	if hasBounds && hasPoints {
		return Bounds{}, errors.New("provide either bounds fields or start/end fields, not both")
	}
	if !hasBounds && !hasPoints {
		return Bounds{}, errors.New("provide one complete block shape: bounds or start/end")
	}

	if hasBounds {
		if b.MinCol == nil || b.MaxCol == nil || b.MinRow == nil || b.MaxRow == nil {
			return Bounds{}, errors.New("bounds shape requires min_col, max_col, min_row, max_row")
		}
		if *b.MinCol > *b.MaxCol {
			return Bounds{}, errors.New("min_col must be <= max_col")
		}
		if *b.MinRow > *b.MaxRow {
			return Bounds{}, errors.New("min_row must be <= max_row")
		}
		return Bounds{*b.MinCol, *b.MaxCol, *b.MinRow, *b.MaxRow}, nil
	}

	if b.StartCol == nil || b.StartRow == nil || b.EndCol == nil || b.EndRow == nil {
		return Bounds{}, errors.New("start/end shape requires start_col, start_row, end_col, end_row")
	}
	return Bounds{
		MinCol: min(*b.StartCol, *b.EndCol),
		MaxCol: max(*b.StartCol, *b.EndCol),
		MinRow: min(*b.StartRow, *b.EndRow),
		MaxRow: max(*b.StartRow, *b.EndRow),
	}, nil
}

// Store is the interface implemented by InMemoryStore.
type Store interface {
	List() []Block
	Create(b Bounds) Block
	Delete(id string) bool
	Clear()
}

// InMemoryStore is a goroutine-safe Store backed by a map.
type InMemoryStore struct {
	mu     sync.RWMutex
	blocks map[string]Block
}

// NewInMemoryStore constructs an empty store.
func NewInMemoryStore() *InMemoryStore {
	return &InMemoryStore{blocks: make(map[string]Block)}
}

// List returns all blocks in unspecified order.
func (s *InMemoryStore) List() []Block {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Block, 0, len(s.blocks))
	for _, b := range s.blocks {
		out = append(out, b)
	}
	return out
}

// Create inserts a new block with a generated UUIDv4 id.
func (s *InMemoryStore) Create(b Bounds) Block {
	block := Block{
		ID:     uuid.NewString(),
		MinCol: b.MinCol,
		MaxCol: b.MaxCol,
		MinRow: b.MinRow,
		MaxRow: b.MaxRow,
	}
	s.mu.Lock()
	s.blocks[block.ID] = block
	s.mu.Unlock()
	return block
}

// Delete removes a block by id; returns false if not found.
func (s *InMemoryStore) Delete(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.blocks[id]; !ok {
		return false
	}
	delete(s.blocks, id)
	return true
}

// Clear drops all blocks.
func (s *InMemoryStore) Clear() {
	s.mu.Lock()
	s.blocks = make(map[string]Block)
	s.mu.Unlock()
}

// CreateForGrid enforces the margin invariant (min_col >= marginCols).
func CreateForGrid(store Store, payload BlockCreate, marginCols uint32) (Block, error) {
	bounds, err := payload.ToBounds()
	if err != nil {
		return Block{}, err
	}
	if bounds.MinCol < marginCols {
		return Block{}, errors.New("min_col must be >= margin_cols")
	}
	return store.Create(bounds), nil
}
