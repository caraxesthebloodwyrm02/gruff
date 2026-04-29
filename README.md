# 🏰 Central Plaza (Local Root)

Welcome to the **Mangrove Ecosystem** root directory.

This directory (`~/gruff/`) serves as the local filesystem umbrella holding the dual-layer architecture defined by the **School Charter** and **TUV-001**.

## 🗺️ Local Navigation

| Directory | Purpose | Git Tracked? |
| :--- | :--- | :--- |
| [**`workspace/`**](./workspace/) | **Main development tree (Practice/Write).** Local workspace content stays untracked in this repo, except the pinned `python-prototype` submodule. | ⚠️ Mixed (mostly local + one submodule) |
| [**`school/`**](./school/) | **Sandbox mode (Learning/Read).** Driven by the School Charter for practice, observation, and enforcement. | ❌ No (Local Sandbox) |

---

### 🚦 Where to go next?

1. **For Project & NPM info:** Read the [Workspace README](./workspace/README.md).
2. **For District-level Navigation:** Open the [Central Plaza Map](./workspace/CENTRAL_PLAZA.md).
3. **To start developing:** `cd workspace/`

### `python-prototype` submodule workflow

- Initialize/update after clone: `git submodule update --init --recursive`.
- Pull latest canonical geometrybox changes locally: `git -C workspace/python-prototype pull`.
- Pin a newer revision in this repo: `git add workspace/python-prototype && git commit -m "chore: bump python-prototype submodule"`.

### Documentation

- Notebook engine guide: [workspace/docs/notebook-engine-guide.md](./workspace/docs/notebook-engine-guide.md)

## Attribution

Built by Prince (Irfan Kabir)
Canonical identity source: /home/irfankabir/IDENTITY.md
