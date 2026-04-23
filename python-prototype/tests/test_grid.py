from notebook_engine.grid import BlockBounds, GridConfig, UniversalGrid


def test_quantize_whole_cells() -> None:
    cfg = GridConfig(cell_px=24, margin_cols=2, cols=40, rows=30)
    assert cfg.quantize(0.0, 0.0) == (2, 0)
    assert cfg.quantize(24.0, 24.0) == (2, 1)
    assert cfg.quantize(72.0, 48.0) == (3, 2)


def test_quantize_respects_bounds() -> None:
    grid = UniversalGrid(GridConfig(cell_px=24, margin_cols=2, cols=5, rows=4))
    assert grid.quantize(-10.0, -10.0).model_dump() == {'col': 2, 'row': 0}
    assert grid.quantize(10_000.0, 10_000.0).model_dump() == {'col': 4, 'row': 3}


def test_clamp_bounds() -> None:
    grid = UniversalGrid(GridConfig(cell_px=24, margin_cols=2, cols=6, rows=6))
    clamped = grid.clamp_bounds(BlockBounds(min_col=0, max_col=99, min_row=-0, max_row=99))
    assert clamped.min_col == 2
    assert clamped.max_col == 5
    assert clamped.max_row == 5


def test_cell_origin() -> None:
    cfg = GridConfig(cell_px=24, margin_cols=2)
    assert cfg.cell_origin(2, 0) == (48.0, 0.0)
    assert cfg.cell_origin(3, 1) == (72.0, 24.0)
