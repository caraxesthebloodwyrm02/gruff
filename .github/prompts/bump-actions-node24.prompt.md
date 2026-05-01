---
name: "Bump actions to Node.js 24 (gruff reliability.yml)"
description: >
  Upgrades all GitHub Actions in reliability.yml from Node.js 20 to Node.js 24
  compatible versions before the June 2, 2026 forced migration deadline.
  Affects: actions/checkout, actions/setup-python, actions/setup-node,
  docker/setup-buildx-action, docker/build-push-action.
  Trigger phrases: "Node.js 24", "actions deprecation", "bump actions", "node20 deprecation", "reliability.yml versions".
argument-hint: "check | apply"
agent: "agent"
tools: [read_file, replace_string_in_file, run_in_terminal]
---

## Scope

Repository: `caraxesthebloodwyrm02/gruff`
File: `.github/workflows/reliability.yml`
Deadline: **June 2, 2026** (Node.js 24 becomes default). Node.js 20 runner removed September 16, 2026.
Source: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/

---

## Required version bumps

| Action | Current | Target | Jobs affected |
|--------|---------|--------|---------------|
| `actions/checkout` | `@v4` | `@v4.2.2` | all 3 |
| `actions/setup-python` | `@v5` | `@v5.5.0` | `python-runtime-tests` |
| `actions/setup-node` | `@v4` | `@v4.4.0` | `control-plane-smoke` |
| `docker/setup-buildx-action` | `@v3` | `@v3.10.0` | `docker` |
| `docker/build-push-action` | `@v5` | `@v6.16.0` | `docker` |

Note: `actions/checkout@v4.2.2` is already the pinned version in `lantern`'s `ci.yml` — use it as the canonical reference.

---

## Check command

Before applying, confirm current pins:

```bash
grep -n 'uses:' /home/irfankabir/gruff/.github/workflows/reliability.yml
```

---

## Apply

**Adjacent script:** `scripts/bump-actions-node24.sh`

```bash
bash /home/irfankabir/gruff/scripts/bump-actions-node24.sh
```

The script performs all 5 pin replacements in-place, shows a diff, and stages the file.

**Manual equivalent:**
```bash
cd /home/irfankabir/gruff
sed -i \
  -e 's|actions/checkout@v4$|actions/checkout@v4.2.2|g' \
  -e 's|actions/setup-python@v5$|actions/setup-python@v5.5.0|g' \
  -e 's|actions/setup-node@v4$|actions/setup-node@v4.4.0|g' \
  -e 's|docker/setup-buildx-action@v3$|docker/setup-buildx-action@v3.10.0|g' \
  -e 's|docker/build-push-action@v5$|docker/build-push-action@v6.16.0|g' \
  .github/workflows/reliability.yml
git diff .github/workflows/reliability.yml
git add .github/workflows/reliability.yml
git commit -m "chore: pin actions to Node.js 24-compatible versions (deadline June 2 2026)

- actions/checkout@v4 → @v4.2.2 (all 3 jobs)
- actions/setup-python@v5 → @v5.5.0
- actions/setup-node@v4 → @v4.4.0
- docker/setup-buildx-action@v3 → @v3.10.0
- docker/build-push-action@v5 → @v6.16.0"
```

---

## Verification

After pushing, confirm the Node.js 20 deprecation annotation is gone:

```bash
git -C /home/irfankabir/gruff push origin main
# wait ~60s then:
GRUFF_ID=$(gh run list --repo caraxesthebloodwyrm02/gruff --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view $GRUFF_ID --repo caraxesthebloodwyrm02/gruff 2>&1 | grep -i "node.js 20\|annotation\|warning" || echo "PASS: no Node.js 20 annotation"
```

Pass criteria: no `Node.js 20 actions are deprecated` annotation. All three jobs still pass (✓).

---

## Constraints

- Bump only the 5 listed actions. Do not alter job logic, environment variables, or timeouts.
- Confirm the resulting `reliability.yml` is valid YAML before committing (`python3 -c "import yaml,sys; yaml.safe_load(sys.stdin)" < .github/workflows/reliability.yml`).
- Do not force-push. Commit and push normally.
- Identity switches via `~/.gitconfig` `includeIf` — do not override `user.*`.
- If this is run alongside scope A (submodule path fix), do each as a separate commit.
