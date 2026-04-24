.PHONY: verify-planes fourfold-snap submodule-init build lint test

verify-planes:
	@echo "Checking planes/ symlink drift..."
	@if [ -L planes ] && [ -d planes ]; then \
		echo "planes/ symlink is valid"; \
	else \
		echo "WARNING: planes/ symlink missing or broken"; \
	fi

fourfold-snap:
	@echo "Verifying four-on-the-floor files..."
	@test -f session-seal.json && echo "session-seal.json exists" || echo "WARNING: session-seal.json missing"
	@for f in four-on-the-floor/*.md; do \
		[ -f "$$f" ] && echo "Found: $$f" || echo "Missing: $$f"; \
	done

submodule-init:
	git submodule update --init --recursive

build:
	npm run build

lint:
	npm run lint

test:
	npm test
	cd python-prototype && source .venv/bin/activate && python -m pytest tests/ -q
