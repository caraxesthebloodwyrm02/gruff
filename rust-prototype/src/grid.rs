use serde::{Serialize, Deserialize};

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct GridConfig {
    pub cell_px: u32,
    pub margin_cols: u32,
}

impl GridConfig {
    /// Snap a pixel coordinate to the nearest grid cell (col, row).
    /// Enforces margin: returned col is never less than margin_cols.
    #[allow(dead_code)]
    pub fn quantize(&self, x: f32, y: f32) -> (u32, u32) {
        let col = (x / self.cell_px as f32).floor() as u32;
        let row = (y / self.cell_px as f32).floor() as u32;
        (col.max(self.margin_cols), row)
    }

    /// Pixel origin of a grid cell's top-left corner.
    #[allow(dead_code)]
    pub fn cell_origin(&self, col: u32, row: u32) -> (f32, f32) {
        (
            col as f32 * self.cell_px as f32,
            row as f32 * self.cell_px as f32,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
        // Even x=0 should return at least margin_cols
        assert_eq!(cfg.quantize(0.0, 0.0).0, 2);
        // x in first margin cell should still return margin_cols
        assert_eq!(cfg.quantize(12.0, 0.0).0, 2);
        // x past margin should return col 3
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
}
