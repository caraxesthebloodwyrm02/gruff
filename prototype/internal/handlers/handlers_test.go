package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"notebook-engine/internal/blocks"
	"notebook-engine/internal/grid"
	"notebook-engine/internal/handlers"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func setupRouter() (*gin.Engine, blocks.Store) {
	cfg := grid.GridConfig{CellPx: 24, MarginCols: 2, Cols: 40, Rows: 30}
	store := blocks.NewInMemoryStore()

	r := gin.New()
	r.GET("/", handlers.Index)
	r.GET("/api/grid", handlers.APIGrid(cfg))
	r.GET("/api/blocks", handlers.APIBlocksList(store))
	r.POST("/api/blocks", handlers.APIBlocksCreate(store, cfg))
	r.POST("/api/blocks/clear", handlers.APIBlocksClear(store))
	r.DELETE("/api/blocks/:id", handlers.APIBlocksDelete(store))
	r.GET("/static/*file", handlers.StaticFile)

	return r, store
}

// --- GET / ---

func TestIndexReturns200HTML(t *testing.T) {
	r, _ := setupRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("GET / status=%d, want 200", w.Code)
	}
	ct := w.Header().Get("Content-Type")
	if !strings.Contains(ct, "text/html") {
		t.Errorf("GET / Content-Type=%q, want text/html", ct)
	}
	body := w.Body.String()
	if !strings.Contains(body, "<canvas") {
		t.Error("GET / body missing <canvas> element")
	}
	if !strings.Contains(body, "notebook.js") {
		t.Error("GET / body missing notebook.js script reference")
	}
}

// --- GET /api/grid ---

func TestAPIGridReturnsConfig(t *testing.T) {
	r, _ := setupRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/grid", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("GET /api/grid status=%d, want 200", w.Code)
	}

	var cfg grid.GridConfig
	if err := json.Unmarshal(w.Body.Bytes(), &cfg); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if cfg.CellPx != 24 {
		t.Errorf("cell_px=%d, want 24", cfg.CellPx)
	}
	if cfg.MarginCols != 2 {
		t.Errorf("margin_cols=%d, want 2", cfg.MarginCols)
	}
	if cfg.Cols != 40 {
		t.Errorf("cols=%d, want 40", cfg.Cols)
	}
	if cfg.Rows != 30 {
		t.Errorf("rows=%d, want 30", cfg.Rows)
	}
}

// --- GET /static/notebook.js ---

func TestStaticNotebookJS(t *testing.T) {
	r, _ := setupRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/static/notebook.js", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("GET /static/notebook.js status=%d, want 200", w.Code)
	}
	ct := w.Header().Get("Content-Type")
	if !strings.Contains(ct, "javascript") {
		t.Errorf("Content-Type=%q, want application/javascript", ct)
	}
	if !strings.Contains(w.Body.String(), "quantize") {
		t.Error("notebook.js missing quantize function")
	}
}

func TestStaticUnknownReturns404(t *testing.T) {
	r, _ := setupRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/static/nope.js", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("GET /static/nope.js status=%d, want 404", w.Code)
	}
}

// --- GET /api/blocks (empty) ---

func TestAPIBlocksListEmpty(t *testing.T) {
	r, _ := setupRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/blocks", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("GET /api/blocks status=%d, want 200", w.Code)
	}

	var list []blocks.Block
	if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if len(list) != 0 {
		t.Errorf("expected empty list, got %d blocks", len(list))
	}
}

// --- POST /api/blocks (start/end shape) ---

func TestAPIBlocksCreateStartEnd(t *testing.T) {
	r, _ := setupRouter()

	body := `{"start_col":3,"start_row":1,"end_col":5,"end_row":4}`
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/blocks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("POST /api/blocks status=%d, want 201, body=%s", w.Code, w.Body.String())
	}

	var b blocks.Block
	if err := json.Unmarshal(w.Body.Bytes(), &b); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if b.ID == "" {
		t.Error("expected generated id")
	}
	if b.MinCol != 3 || b.MaxCol != 5 || b.MinRow != 1 || b.MaxRow != 4 {
		t.Errorf("unexpected bounds: %+v", b)
	}
}

// --- POST /api/blocks (bounds shape) ---

func TestAPIBlocksCreateBounds(t *testing.T) {
	r, _ := setupRouter()

	body := `{"min_col":2,"max_col":6,"min_row":0,"max_row":3}`
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/blocks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("POST /api/blocks status=%d, want 201, body=%s", w.Code, w.Body.String())
	}

	var b blocks.Block
	if err := json.Unmarshal(w.Body.Bytes(), &b); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if b.MinCol != 2 || b.MaxCol != 6 || b.MinRow != 0 || b.MaxRow != 3 {
		t.Errorf("unexpected bounds: %+v", b)
	}
}

// --- POST /api/blocks (margin violation) ---

func TestAPIBlocksCreateRejectsMarginViolation(t *testing.T) {
	r, _ := setupRouter()

	body := `{"min_col":1,"max_col":3,"min_row":0,"max_row":0}`
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/blocks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Errorf("POST /api/blocks with margin violation: status=%d, want 422", w.Code)
	}
}

// --- POST /api/blocks (invalid JSON) ---

func TestAPIBlocksCreateRejectsInvalidJSON(t *testing.T) {
	r, _ := setupRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/blocks", strings.NewReader("{bad"))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Errorf("POST /api/blocks with bad JSON: status=%d, want 422", w.Code)
	}
}

// --- POST /api/blocks (empty payload) ---

func TestAPIBlocksCreateRejectsEmptyPayload(t *testing.T) {
	r, _ := setupRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/blocks", strings.NewReader("{}"))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Errorf("POST /api/blocks with empty payload: status=%d, want 422", w.Code)
	}
}

// --- DELETE /api/blocks/:id ---

func TestAPIBlocksDeleteExisting(t *testing.T) {
	r, store := setupRouter()

	b := store.Create(blocks.Bounds{MinCol: 3, MaxCol: 5, MinRow: 1, MaxRow: 2})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("DELETE", "/api/blocks/"+b.ID, nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("DELETE /api/blocks/%s status=%d, want 204", b.ID, w.Code)
	}
	if len(store.List()) != 0 {
		t.Error("expected store empty after delete")
	}
}

func TestAPIBlocksDeleteNotFound(t *testing.T) {
	r, _ := setupRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("DELETE", "/api/blocks/nonexistent-id", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("DELETE unknown block: status=%d, want 404", w.Code)
	}
}

// --- POST /api/blocks/clear ---

func TestAPIBlocksClear(t *testing.T) {
	r, store := setupRouter()

	store.Create(blocks.Bounds{MinCol: 2, MaxCol: 3, MinRow: 0, MaxRow: 1})
	store.Create(blocks.Bounds{MinCol: 4, MaxCol: 5, MinRow: 0, MaxRow: 1})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/blocks/clear", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("POST /api/blocks/clear status=%d, want 204", w.Code)
	}
	if len(store.List()) != 0 {
		t.Error("expected store empty after clear")
	}
}

// --- Full lifecycle: create → list → delete → list ---

func TestBlocksFullLifecycle(t *testing.T) {
	r, _ := setupRouter()

	// Create a block
	body := `{"start_col":3,"start_row":0,"end_col":5,"end_row":2}`
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/blocks", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("create: status=%d", w.Code)
	}
	var created blocks.Block
	json.Unmarshal(w.Body.Bytes(), &created)

	// List should have 1 block
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/blocks", nil)
	r.ServeHTTP(w, req)
	var list []blocks.Block
	json.Unmarshal(w.Body.Bytes(), &list)
	if len(list) != 1 {
		t.Fatalf("list: got %d blocks, want 1", len(list))
	}
	if list[0].ID != created.ID {
		t.Errorf("list[0].ID=%s, want %s", list[0].ID, created.ID)
	}

	// Delete the block
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("DELETE", "/api/blocks/"+created.ID, nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusNoContent {
		t.Fatalf("delete: status=%d", w.Code)
	}

	// List should be empty
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/blocks", nil)
	r.ServeHTTP(w, req)
	json.Unmarshal(w.Body.Bytes(), &list)
	if len(list) != 0 {
		t.Errorf("list after delete: got %d blocks, want 0", len(list))
	}
}
