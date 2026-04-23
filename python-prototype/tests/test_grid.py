from notebook_engine.grid import GridConfig


def test_quantize_whole_cells() -> None:
    cfg = GridConfig(cell_px=24, margin_cols=2)
    assert cfg.quantize(0.0, 0.0) == (2, 0)
    assert cfg.quantize(24.0, 24.0) == (2, 1)
    assert cfg.quantize(48.0, 48.0) == (2, 2)


def test_quantize_fractional() -> None:
    cfg = GridConfig(cell_px=24, margin_cols=2)
    assert cfg.quantize(12.5, 12.5) == (2, 0)
    assert cfg.quantize(36.5, 36.5) == (2, 1)


def test_quantize_respects_margin() -> None:
    cfg = GridConfig(cell_px=24, margin_cols=2)
    col, _ = cfg.quantize(0.0, 0.0)
    assert col == 2
    col, _ = cfg.quantize(12.0, 0.0)
    assert col == 2
    col, _ = cfg.quantize(72.0, 0.0)
    assert col == 3


def test_cell_origin() -> None:
    cfg = GridConfig(cell_px=24, margin_cols=2)
    assert cfg.cell_origin(2, 0) == (48.0, 0.0)
    assert cfg.cell_origin(3, 1) == (72.0, 24.0)
