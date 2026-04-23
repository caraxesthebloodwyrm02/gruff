from uuid import UUID

import pytest
from pydantic import ValidationError

from notebook_engine.blocks import (
    BlockCreate,
    BlockValidationError,
    InMemoryBlockStore,
    create_block_for_grid,
    normalize_block_create,
)


def test_block_create_from_bounds() -> None:
    payload = BlockCreate(min_col=2, max_col=4, min_row=1, max_row=3)
    bounds, label, tone = normalize_block_create(payload, margin_cols=2)
    assert bounds.min_col == 2
    assert label == ''
    assert tone == 'amber'


def test_block_create_from_start_end_normalizes() -> None:
    payload = BlockCreate(start_col=5, start_row=6, end_col=3, end_row=2, label='  Sprint  ', tone='mint')
    bounds, label, tone = normalize_block_create(payload, margin_cols=2)
    assert bounds.min_col == 3
    assert bounds.max_col == 5
    assert bounds.min_row == 2
    assert bounds.max_row == 6
    assert label == 'Sprint'
    assert tone == 'mint'


def test_block_create_rejects_mixed_shapes() -> None:
    with pytest.raises(ValidationError):
        BlockCreate(
            min_col=2,
            max_col=3,
            min_row=1,
            max_row=2,
            start_col=2,
            start_row=1,
            end_col=3,
            end_row=2,
        )


def test_create_block_rejects_margin_violation() -> None:
    payload = BlockCreate(min_col=1, max_col=2, min_row=0, max_row=1)
    with pytest.raises(BlockValidationError, match='min_col must be >= margin_cols'):
        normalize_block_create(payload, margin_cols=2)


def test_create_block_rejects_unknown_tone() -> None:
    payload = BlockCreate(min_col=2, max_col=3, min_row=0, max_row=1, tone='neon')
    with pytest.raises(BlockValidationError, match='tone must be one of'):
        normalize_block_create(payload, margin_cols=2)


def test_block_id_is_uuid4_string() -> None:
    store = InMemoryBlockStore()
    payload = BlockCreate(min_col=2, max_col=3, min_row=1, max_row=2)
    created = create_block_for_grid(store=store, payload=payload, margin_cols=2)
    parsed = UUID(created.id)
    assert parsed.version == 4
    assert created.created_at
    assert created.updated_at
