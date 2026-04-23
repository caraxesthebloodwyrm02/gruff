use notebook_engine::grid::GridConfig;

#[test]
fn quantize_whole_cells() {
    let cfg = GridConfig {
        cell_px: 24,
        margin_cols: 2,
    };
    assert_eq!(cfg.quantize(0.0, 0.0), (2, 0));
    assert_eq!(cfg.quantize(24.0, 24.0), (2, 1));
    assert_eq!(cfg.quantize(48.0, 48.0), (2, 2));
}

#[test]
fn quantize_fractional() {
    let cfg = GridConfig {
        cell_px: 24,
        margin_cols: 2,
    };
    assert_eq!(cfg.quantize(12.5, 12.5), (2, 0));
    assert_eq!(cfg.quantize(36.5, 36.5), (2, 1));
}

#[test]
fn quantize_respects_margin() {
    let cfg = GridConfig {
        cell_px: 24,
        margin_cols: 2,
    };
    assert_eq!(cfg.quantize(0.0, 0.0).0, 2);
    assert_eq!(cfg.quantize(12.0, 0.0).0, 2);
    assert_eq!(cfg.quantize(72.0, 0.0).0, 3);
}

#[test]
fn cell_origin() {
    let cfg = GridConfig {
        cell_px: 24,
        margin_cols: 2,
    };
    assert_eq!(cfg.cell_origin(2, 0), (48.0, 0.0));
    assert_eq!(cfg.cell_origin(3, 1), (72.0, 24.0));
}
