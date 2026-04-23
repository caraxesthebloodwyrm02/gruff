from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class GridConfig(BaseModel):
    model_config = ConfigDict(frozen=True, extra='forbid')

    cell_px: int = Field(default=24, gt=0)
    margin_cols: int = Field(default=2, ge=0)

    def quantize(self, x: float, y: float) -> tuple[int, int]:
        """Snap pixel coordinates to the nearest grid cell (col, row)."""
        col = int(x // self.cell_px)
        row = int(y // self.cell_px)
        return max(col, self.margin_cols), row

    def cell_origin(self, col: int, row: int) -> tuple[float, float]:
        """Return the pixel coordinate of a cell's top-left corner."""
        return float(col * self.cell_px), float(row * self.cell_px)
