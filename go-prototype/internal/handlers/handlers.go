package handlers

import (
	_ "embed"
	"net/http"

	"github.com/gin-gonic/gin"

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
