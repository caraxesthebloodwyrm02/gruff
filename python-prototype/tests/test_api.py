from fastapi.testclient import TestClient

from notebook_engine.api import build_app
from notebook_engine.blocks import InMemoryBlockStore
from notebook_engine.grid import GridConfig


def make_client(*, cell_px: int = 24, margin_cols: int = 2) -> TestClient:
    config = GridConfig(cell_px=cell_px, margin_cols=margin_cols)
    app = build_app(config, store=InMemoryBlockStore())
    return TestClient(app)


def test_get_grid_uses_config_values() -> None:
    client = make_client(cell_px=32, margin_cols=3)
    response = client.get("/api/grid")
    assert response.status_code == 200
    assert response.json() == {"cell_px": 32, "margin_cols": 3}


def test_block_lifecycle_bounds_shape() -> None:
    client = make_client()
    create = client.post(
        "/api/blocks",
        json={"min_col": 2, "max_col": 4, "min_row": 1, "max_row": 3},
    )
    assert create.status_code == 201
    created = create.json()
    assert created["id"]

    listed = client.get("/api/blocks")
    assert listed.status_code == 200
    blocks = listed.json()
    assert len(blocks) == 1
    assert blocks[0]["id"] == created["id"]

    deleted = client.delete(f"/api/blocks/{created['id']}")
    assert deleted.status_code == 204

    listed_after = client.get("/api/blocks")
    assert listed_after.status_code == 200
    assert listed_after.json() == []


def test_block_lifecycle_start_end_shape_and_clear() -> None:
    client = make_client()

    create_one = client.post(
        "/api/blocks",
        json={"start_col": 5, "start_row": 6, "end_col": 3, "end_row": 2},
    )
    assert create_one.status_code == 201
    body = create_one.json()
    assert body["min_col"] == 3
    assert body["max_col"] == 5
    assert body["min_row"] == 2
    assert body["max_row"] == 6

    create_two = client.post(
        "/api/blocks",
        json={"min_col": 6, "max_col": 7, "min_row": 0, "max_row": 1},
    )
    assert create_two.status_code == 201

    clear = client.post("/api/blocks/clear")
    assert clear.status_code == 204

    listed_after = client.get("/api/blocks")
    assert listed_after.status_code == 200
    assert listed_after.json() == []


def test_invalid_payloads_return_422() -> None:
    client = make_client()

    mixed = client.post(
        "/api/blocks",
        json={
            "min_col": 2,
            "max_col": 3,
            "min_row": 1,
            "max_row": 2,
            "start_col": 2,
            "start_row": 1,
            "end_col": 3,
            "end_row": 2,
        },
    )
    assert mixed.status_code == 422

    invalid_range = client.post(
        "/api/blocks",
        json={"min_col": 4, "max_col": 2, "min_row": 1, "max_row": 3},
    )
    assert invalid_range.status_code == 422

    margin_violation = client.post(
        "/api/blocks",
        json={"min_col": 1, "max_col": 2, "min_row": 0, "max_row": 1},
    )
    assert margin_violation.status_code == 422


def test_delete_missing_block_returns_404() -> None:
    client = make_client()
    response = client.delete("/api/blocks/missing-id")
    assert response.status_code == 404


def test_html_and_static_assets_smoke() -> None:
    client = make_client()

    html = client.get("/")
    assert html.status_code == 200
    assert 'id="nb"' in html.text

    js = client.get("/static/notebook.js")
    assert js.status_code == 200
    assert "fetch('/api/grid')" in js.text
    assert "fetch('/api/blocks')" in js.text

