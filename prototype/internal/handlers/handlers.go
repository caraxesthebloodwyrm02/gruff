package handlers

import (
	_ "embed"
	"net/http"

	"github.com/gin-gonic/gin"

	"notebook-engine/internal/blocks"
	"notebook-engine/internal/grid"
)

//go:embed static/index.html
var indexHTML string

//go:embed static/notebook.js
var notebookJS string

// Index serves the notebook single-page app.
func Index(c *gin.Context) {
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(indexHTML))
}

// APIGrid returns the grid configuration as JSON.
func APIGrid(cfg grid.GridConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, cfg)
	}
}

// StaticFile serves embedded static assets.
func StaticFile(c *gin.Context) {
	switch c.Param("file") {
	case "/notebook.js":
		c.Data(http.StatusOK, "application/javascript", []byte(notebookJS))
	default:
		c.Status(http.StatusNotFound)
	}
}

// APIBlocksList returns all blocks in the store.
func APIBlocksList(store blocks.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, store.List())
	}
}

// APIBlocksCreate creates a new block, enforcing the margin invariant.
func APIBlocksCreate(store blocks.Store, cfg grid.GridConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		var payload blocks.BlockCreate
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"detail": err.Error()})
			return
		}
		b, err := blocks.CreateForGrid(store, payload, cfg.MarginCols)
		if err != nil {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"detail": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, b)
	}
}

// APIBlocksDelete removes a block by id.
func APIBlocksDelete(store blocks.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !store.Delete(c.Param("id")) {
			c.JSON(http.StatusNotFound, gin.H{"detail": "Block not found"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

// APIBlocksClear removes all blocks.
func APIBlocksClear(store blocks.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		store.Clear()
		c.Status(http.StatusNoContent)
	}
}
