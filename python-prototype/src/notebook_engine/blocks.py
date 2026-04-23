from __future__ import annotations

from datetime import UTC, datetime
from typing import Protocol
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from notebook_engine.grid import BlockBounds

ALLOWED_TONES = {'amber', 'mint', 'azure', 'rose', 'slate'}


def utc_now() -> str:
    return datetime.now(tz=UTC).isoformat()


class BlockCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')

    min_col: int | None = Field(default=None, ge=0)
    max_col: int | None = Field(default=None, ge=0)
    min_row: int | None = Field(default=None, ge=0)
    max_row: int | None = Field(default=None, ge=0)

    start_col: int | None = Field(default=None, ge=0)
    start_row: int | None = Field(default=None, ge=0)
    end_col: int | None = Field(default=None, ge=0)
    end_row: int | None = Field(default=None, ge=0)
    label: str = Field(default='', max_length=80)
    tone: str = Field(default='amber', min_length=1, max_length=24)

    @model_validator(mode='after')
    def validate_shape(self) -> BlockCreate:
        bounds_values = [self.min_col, self.max_col, self.min_row, self.max_row]
        points_values = [self.start_col, self.start_row, self.end_col, self.end_row]

        has_any_bounds = any(value is not None for value in bounds_values)
        has_any_points = any(value is not None for value in points_values)

        if has_any_bounds and has_any_points:
            raise ValueError('Provide either bounds fields or start/end fields, not both')
        if not has_any_bounds and not has_any_points:
            raise ValueError('Provide one complete block shape: bounds or start/end')
        if has_any_bounds and not all(value is not None for value in bounds_values):
            raise ValueError('Bounds shape requires min_col, max_col, min_row, max_row')
        if has_any_points and not all(value is not None for value in points_values):
            raise ValueError('Start/end shape requires start_col, start_row, end_col, end_row')
        return self

    def to_bounds(self) -> BlockBounds:
        if self.min_col is not None:
            return BlockBounds(
                min_col=self.min_col,
                max_col=self.max_col,
                min_row=self.min_row,
                max_row=self.max_row,
            )

        assert self.start_col is not None
        assert self.start_row is not None
        assert self.end_col is not None
        assert self.end_row is not None

        return BlockBounds(
            min_col=min(self.start_col, self.end_col),
            max_col=max(self.start_col, self.end_col),
            min_row=min(self.start_row, self.end_row),
            max_row=max(self.start_row, self.end_row),
        )


class Block(BaseModel):
    model_config = ConfigDict(frozen=True, extra='forbid')

    id: str = Field(min_length=1)
    min_col: int = Field(ge=0)
    max_col: int = Field(ge=0)
    min_row: int = Field(ge=0)
    max_row: int = Field(ge=0)
    label: str = Field(default='', max_length=80)
    tone: str = Field(default='amber', min_length=1, max_length=24)
    created_at: str = Field(default_factory=utc_now)
    updated_at: str = Field(default_factory=utc_now)

    @classmethod
    def from_bounds(
        cls,
        block_id: str,
        bounds: BlockBounds,
        *,
        label: str,
        tone: str,
        created_at: str | None = None,
        updated_at: str | None = None,
    ) -> Block:
        timestamp = created_at or utc_now()
        return cls(
            id=block_id,
            label=label,
            tone=tone,
            created_at=timestamp,
            updated_at=updated_at or timestamp,
            **bounds.model_dump(),
        )

    def to_bounds(self) -> BlockBounds:
        return BlockBounds(
            min_col=self.min_col,
            max_col=self.max_col,
            min_row=self.min_row,
            max_row=self.max_row,
        )


class BlockValidationError(ValueError):
    def __init__(
        self,
        message: str,
        *,
        field: str | None = None,
        input_value: object = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.field = field
        self.input_value = input_value

    def to_request_error(self) -> dict[str, object]:
        loc: tuple[str, ...] = ('body', self.field) if self.field else ('body',)
        return {
            'type': 'value_error',
            'loc': loc,
            'msg': f'Value error, {self.message}',
            'input': self.input_value,
            'ctx': {'error': self.message},
        }


def _field_for_bounds_error(message: str) -> str | None:
    if 'min_col must be <=' in message:
        return 'max_col'
    if 'min_row must be <=' in message:
        return 'max_row'
    return None


def normalize_block_create(
    payload: BlockCreate,
    *,
    margin_cols: int,
) -> tuple[BlockBounds, str, str]:
    try:
        bounds = payload.to_bounds()
    except ValidationError as exc:
        first_error = exc.errors(include_url=False)[0]
        message = str(first_error['msg']).removeprefix('Value error, ')
        loc = first_error.get('loc', ())
        field = loc[0] if loc and isinstance(loc[0], str) else _field_for_bounds_error(message)
        raise BlockValidationError(message, field=field, input_value=first_error.get('input')) from exc

    if bounds.min_col < margin_cols:
        raise BlockValidationError(
            f'min_col must be >= margin_cols ({margin_cols})',
            field='min_col',
            input_value=bounds.min_col,
        )

    if bounds.min_col > bounds.max_col:
        raise BlockValidationError('min_col must be <= max_col', field='max_col', input_value=bounds.max_col)
    if bounds.min_row > bounds.max_row:
        raise BlockValidationError('min_row must be <= max_row', field='max_row', input_value=bounds.max_row)

    label = payload.label.strip()
    tone = payload.tone.strip().lower()
    if tone not in ALLOWED_TONES:
        raise BlockValidationError(
            f'tone must be one of: {", ".join(sorted(ALLOWED_TONES))}',
            field='tone',
            input_value=payload.tone,
        )
    return bounds, label, tone


class BlockStore(Protocol):
    def list(self) -> list[Block]:
        ...

    def create(self, bounds: BlockBounds, *, label: str, tone: str) -> Block:
        ...

    def delete(self, block_id: str) -> bool:
        ...

    def clear(self) -> None:
        ...


class InMemoryBlockStore:
    def __init__(self) -> None:
        self._blocks: dict[str, Block] = {}

    def list(self) -> list[Block]:
        return list(self._blocks.values())

    def create(self, bounds: BlockBounds, *, label: str, tone: str) -> Block:
        block_id = str(uuid4())
        block = Block.from_bounds(block_id, bounds, label=label, tone=tone)
        self._blocks[block_id] = block
        return block

    def delete(self, block_id: str) -> bool:
        return self._blocks.pop(block_id, None) is not None

    def clear(self) -> None:
        self._blocks.clear()


def create_block_for_grid(
    store: BlockStore,
    payload: BlockCreate,
    margin_cols: int,
) -> Block:
    bounds, label, tone = normalize_block_create(payload, margin_cols=margin_cols)
    return store.create(bounds, label=label, tone=tone)
