# LO7 Runbook

Daily flow:

1. Generate or open a manifest with `lo7-manifest show`.
2. Start the notebook server with `uv run notebook-engine`.
3. Render heatmap output with `uv run lo7-heatmap`.
4. Render compass output with `uv run lo7-compass render`.
5. Emit bridge payload with `uv run lo7-compass emit-bridge`.

Required env for craft render:

```bash
export LO7_CRAFT_RENDER_COMMAND="/path/to/craft-wrapper"
```
