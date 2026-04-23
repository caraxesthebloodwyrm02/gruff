# Packaging Notes

Python package entrypoints:

- `notebook-engine`
- `lo7-manifest`
- `lo7-heatmap`
- `lo7-compass`

Schema assets live in `schemas/` so both Python tooling and the existing `dist/cli.js` Gruff artifacts can reference the same contracts.
