package main

import (
	"flag"
	"fmt"
	"log/slog"
	"os"

	"github.com/gin-gonic/gin"

	"notebook-engine/internal/grid"
	"notebook-engine/internal/handlers"
)

func main() {
	host := flag.String("host", "127.0.0.1", "bind address")
	port := flag.Int("port", 8080, "listen port")
	cellPx := flag.Uint("cell-px", 24, "grid cell size in pixels")
	marginCols := flag.Uint("margin-cols", 2, "left margin width in grid columns")
	flag.Parse()

	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	log.Info("starting notebook-engine",
		"host", *host,
		"port", *port,
		"cell_px", *cellPx,
		"margin_cols", *marginCols,
	)

	cfg := grid.GridConfig{
		CellPx:     uint32(*cellPx),
		MarginCols: uint32(*marginCols),
	}

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	r.GET("/", handlers.Index)
	r.GET("/api/grid", handlers.APIGrid(cfg))
	r.GET("/static/*file", handlers.StaticFile)

	addr := fmt.Sprintf("%s:%d", *host, *port)
	log.Info("listening", "addr", addr)
	if err := r.Run(addr); err != nil {
		log.Error("server failed", "err", err)
		os.Exit(1)
	}
}
