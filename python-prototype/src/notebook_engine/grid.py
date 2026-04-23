from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class CellCoord(BaseModel):
    model_config = ConfigDict(frozen=True, extra='forbid')

    col: int = Field(ge=0)
    row: int = Field(ge=0)


class BlockBounds(BaseModel):
    model_config = ConfigDict(frozen=True, extra='forbid')

    min_col: int = Field(ge=0)
    max_col: int = Field(ge=0)
    min_row: int = Field(ge=0)
    max_row: int = Field(ge=0)


class GridConfig(BaseModel):
    model_config = ConfigDict(frozen=True, extra='forbid')

    cell_px: int = Field(default=24, gt=0)
    margin_cols: int = Field(default=2, ge=0)
    cols: int | None = Field(default=40, gt=0)
    rows: int | None = Field(default=30, gt=0)

    def universal(self) -> UniversalGrid:
        return UniversalGrid(self)

    def quantize(self, x: float, y: float) -> tuple[int, int]:
        cell = self.universal().quantize(x, y)
        return cell.col, cell.row

    def cell_origin(self, col: int, row: int) -> tuple[float, float]:
        return self.universal().cell_origin(col, row)


class UniversalGrid:
    """Shared notebook geometry helpers for runtime code, tests, and exports."""

    def __init__(self, config: GridConfig):
        self.config = config

    def quantize(self, x: float, y: float) -> CellCoord:
        col = int(x // self.config.cell_px)
        row = int(y // self.config.cell_px)
        col = max(col, self.config.margin_cols)
        row = max(row, 0)
        if self.config.cols is not None:
            col = min(col, self.config.cols - 1)
        if self.config.rows is not None:
            row = min(row, self.config.rows - 1)
        return CellCoord(col=col, row=row)

    def cell_origin(self, col: int, row: int) -> tuple[float, float]:
        return float(col * self.config.cell_px), float(row * self.config.cell_px)

    def normalize_bounds(self, start: CellCoord, end: CellCoord) -> BlockBounds:
        return BlockBounds(
            min_col=min(start.col, end.col),
            max_col=max(start.col, end.col),
            min_row=min(start.row, end.row),
            max_row=max(start.row, end.row),
        )

    def clamp_bounds(self, bounds: BlockBounds) -> BlockBounds:
        max_col = self.config.cols - 1 if self.config.cols is not None else bounds.max_col
        max_row = self.config.rows - 1 if self.config.rows is not None else bounds.max_row
        return BlockBounds(
            min_col=max(bounds.min_col, self.config.margin_cols),
            max_col=min(bounds.max_col, max_col),
            min_row=max(bounds.min_row, 0),
            max_row=min(bounds.max_row, max_row),
        )

    def block_size(self, bounds: BlockBounds) -> tuple[int, int]:
        return (
            bounds.max_col - bounds.min_col + 1,
            bounds.max_row - bounds.min_row + 1,
        )

    def cell_count(self, bounds: BlockBounds) -> int:
        width, height = self.block_size(bounds)
        return width * height

    def board_capacity(self) -> int:
        cols = (self.config.cols or 40) - self.config.margin_cols
        rows = self.config.rows or 30
        return max(cols, 1) * max(rows, 1)
