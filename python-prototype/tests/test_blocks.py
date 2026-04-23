from uuid import UUID

import pytest
from pydantic import ValidationError

from notebook_engine.blocks import BlockCreate, InMemoryBlockStore, create_block_for_grid


def test_block_create_from_bounds() -> None:
    payload = BlockCreate(min_col=2, max_col=4, min_row=1, max_row=3)
    bounds = payload.to_bounds()
    assert bounds.min_col == 2
    assert bounds.max_col == 4
    assert bounds.min_row == 1
    assert bounds.max_row == 3


def test_block_create_from_start_end_normalizes() -> None:
    payload = BlockCreate(start_col=5, start_row=6, end_col=3, end_row=2)
    bounds = payload.to_bounds()
    assert bounds.min_col == 3
    assert bounds.max_col == 5
    assert bounds.min_row == 2
    assert bounds.max_row == 6


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


def test_block_create_rejects_incomplete_shape() -> None:
    with pytest.raises(ValidationError):
        BlockCreate(start_col=2, start_row=1, end_col=3)


def test_block_id_is_uuid4_string() -> None:
    store = InMemoryBlockStore()
    payload = BlockCreate(min_col=2, max_col=3, min_row=1, max_row=2)
    created = create_block_for_grid(store=store, payload=payload, margin_cols=2)
    parsed = UUID(created.id)
    assert parsed.version == 4


def test_create_block_rejects_margin_violation() -> None:
    store = InMemoryBlockStore()
    payload = BlockCreate(min_col=1, max_col=2, min_row=0, max_row=1)
    with pytest.raises(ValueError, match="min_col must be >= margin_cols"):
        create_block_for_grid(store=store, payload=payload, margin_cols=2)

