# Makefile — fold 3 of docs/FOURFOLD_NEIGHBORHOOD.md (circuit: automatable gates)
.DEFAULT_GOAL := help

.PHONY: help verify-planes submodule-init fourfold-snap build lint clean

help:
	@echo "Umbrella workspace targets:"
	@echo "  make build           - Build CLI + ingester (tsup + extract-tokens)"
	@echo "  make lint            - Type-check with tsc --noEmit"
	@echo "  make clean           - Remove dist/"
	@echo "  make verify-planes   - Run scripts/verify-planes.sh (planes drift check)"
	@echo "  make submodule-init  - git submodule update --init --recursive"
	@echo "  make fourfold-snap   - Verify four-on-the-floor files + session seal (composition snap)"

build:
	@npm run build

lint:
	@npm run lint

clean:
	@rm -rf dist

verify-planes:
	@bash scripts/verify-planes.sh

submodule-init:
	@git submodule update --init --recursive

# ~92%+ floor: presence of all four folds + parsable seal (see docs/FOUR_ON_THE_FLOOR.md)
fourfold-snap:
	@test -f LICENSE && test -f docs/DESIGN.md && test -f Makefile && test -f docs/INSTRUCTION.md \
		|| (echo "four on the floor: missing root fourfold file" >&2; exit 1)
	@python3 -c "import json; json.load(open('docs/artifacts/session-seal.json'))" \
		|| (echo "four on the floor: session-seal.json parse failed" >&2; exit 1)
	@echo "four on the floor: OK (~92%+ snap; see docs/FOUR_ON_THE_FLOOR.md)"
