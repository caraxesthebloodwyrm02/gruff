# Prototype Structure Questionnaire

This document guides you through defining the structure for each prototype. Answer each question to customize the baseline.

---

## 1. Rust Prototype (`rust-prototype-scaffolding`)

### 1.1 Definition
**Current State:**
- Package: `rust-prototype`
- Version: `0.1.0`
- Framework: Actix Web 4

**Questions:**
- [ ] **Q1.1.1**: Should the package name be changed? If yes, provide new name.
- [ ] **Q1.1.2**: What version should be used? (default: `0.1.0`)

---

### 1.2 Arguments
**Current State:**
- CLI arguments: None yet
- Configuration: `config.yaml` or `.env` template

**Questions:**
- [ ] **Q1.2.1**: Should CLI argument parsing be included?
  - Options: `clap` (recommended), `structopt`, or custom
- [ ] **Q1.2.2**: What command-line arguments are needed?
  - Examples: `--host`, `--port`, `--debug`, `--config`

---

### 1.3 Functions
**Current State:**
- Core logic: `src/main.rs` with HTTP server
- Routes: Single `/` endpoint

**Questions:**
- [ ] **Q1.3.1**: What additional routes are needed?
  - Examples: `/api/v1/users`, `/api/v1/items`
- [ ] **Q1.3.2**: Should middleware be included?
  - Examples: CORS, logging, authentication

---

### 1.4 Print Statements
**Current State:**
- No print/logging statements

**Questions:**
- [ ] **Q1.4.1**: What logging framework should be used?
  - Options: `log` + `env_logger` (recommended), `tracing`
- [ ] **Q1.4.2**: Should debug statements be included for development?

---

### 1.5 Testing
**Current State:**
- Basic test: `assert_eq!(2 + 2, 4)`

**Questions:**
- [ ] **Q1.5.1**: Should integration tests be added?
- [ ] **Q1.5.2**: Should benchmark tests be included?

---

## 2. Go Prototype (`go-prototype-scaffolding`)

### 2.1 Definition
**Current State:**
- Module: `go-prototype`
- Version: `0.1.0`
- Framework: Gin v1.9.1

**Questions:**
- [ ] **Q2.1.1**: Should the module name be changed?
- [ ] **Q2.1.2**: What Go version should be used? (default: `1.21`)

---

### 2.2 Arguments
**Current State:**
- CLI arguments: None yet

**Questions:**
- [ ] **Q2.2.1**: Should CLI argument parsing be included?
  - Options: `flag` (standard), ` cobra`, `kingpin`
- [ ] **Q2.2.2**: What command-line arguments are needed?

---

### 2.3 Functions
**Current State:**
- Core logic: `src/main.go` with HTTP server
- Routes: Single `/` endpoint

**Questions:**
- [ ] **Q2.3.1**: What additional routes are needed?
- [ ] **Q2.3.2**: Should middleware be included?

---

### 2.4 Print Statements
**Current State:**
- No print/logging statements

**Questions:**
- [ ] **Q2.4.1**: What logging framework should be used?
  - Options: `log` + `slog` (recommended), `zap`, `logrus`
- [ ] **Q2.4.2**: Should structured logging be used?

---

### 2.5 Testing
**Current State:**
- Basic test: None yet

**Questions:**
- [ ] **Q2.5.1**: Should tests be added?
- [ ] **Q2.5.2**: Should integration tests be included?

---

## 3. Python Prototype (`python-prototype-scaffolding`)

### 3.1 Definition
**Current State:**
- Package: `python-prototype`
- Version: `0.1.0`
- Framework: Flask 3.0.0

**Questions:**
- [ ] **Q3.1.1**: Should the package name be changed?
- [ ] **Q3.1.2**: What Python version should be used? (default: `>=3.11`)

---

### 3.2 Arguments
**Current State:**
- CLI arguments: `--host`, `--port`, `--debug` (using argparse)

**Questions:**
- [ ] **Q3.2.1**: Should argument parsing use `click` instead of `argparse`?
- [ ] **Q3.2.2**: What additional arguments are needed?

---

### 3.3 Functions
**Current State:**
- Core logic: `src/main.py` with Flask server
- Routes: Single `/` endpoint

**Questions:**
- [ ] **Q3.3.1**: What additional routes are needed?
- [ ] **Q3.3.2**: Should Blueprints be used for route organization?

---

### 3.4 Print Statements
**Current State:**
- Print: `[Print] Starting Python prototype on {host}:{port}`
- Logging: Using `logging` module

**Questions:**
- [ ] **Q3.4.1**: Should logging level be configurable?
- [ ] **Q3.4.2**: Should structured logging be used?

---

### 3.5 Testing
**Current State:**
- Basic test: None yet

**Questions:**
- [ ] **Q3.5.1**: Should `pytest` tests be added?
- [ ] **Q3.5.2**: Should `unittest` be used instead?

---

## Summary

After answering all questions, the following will be defined:

| Prototype | Framework | Package/Module Name | Python Version | CLI Arguments | Routes | Logging |
|----------|----------|-------------------|---------------|---------------|--------|---------|
| Rust | Actix Web | `rust-prototype` | — | TBD | `/` | TBD |
| Go | Gin | `go-prototype` | `1.21` | TBD | `/` | TBD |
| Python | Flask | `python-prototype` | `>=3.11` | `--host`, `--port`, `--debug` | `/` | `logging` |

---

## Next Steps

1. **Answer** each question by marking the checkbox and providing your answer.
2. **Submit** the completed document.
3. **Implementation** will be generated based on your responses.
