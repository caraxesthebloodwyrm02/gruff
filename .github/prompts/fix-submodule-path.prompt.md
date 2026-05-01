---
name: "Fix orphaned submodule gitlink"
description: >
  Removes an orphaned gitlink from the gruff index that caused git exit 128 on
  every Reliability Guardrails CI run. The pattern: a correct gitlink exists at
  one path and a stale gitlink at another — .gitmodules is correct, the orphan
  is the sole problem.
  Trigger phrases: "submodule path", "git exit 128", "fix submodule", "orphaned gitlink".
argument-hint: "dry-run | apply"
agent: "agent"
tools: [read_file, replace_string_in_file, run_in_terminal]
---

## Scope

Repository: `caraxesthebloodwyrm02/gruff`
Symptom: `The process '/usr/bin/git' failed with exit code 128` on every CI run — step **Initialize python-prototype submodule** (`git submodule update --init python-prototype`).

**Actual root cause (verified 2026-05-01):** Two gitlinks existed in the index simultaneously. Commit `7d49243` correctly added `python-prototype` (root-level, matching `.gitmodules`), but the old `workspace/python-prototype` gitlink was left in the index as an orphan. `.gitmodules` was already correct — the orphaned gitlink was the sole problem.

---

## Diagnosis commands

Run these first to confirm how many gitlinks exist in the index:

```bash
# 1. What does .gitmodules say?
cat /home/irfankabir/gruff/.gitmodules

# 2. How many gitlinks are in the index? (should be exactly one)
git -C /home/irfankabir/gruff ls-files --stage | grep ^160000

# 3. What does submodule status say?
git -C /home/irfankabir/gruff submodule status
```

Orphan present if `ls-files --stage` shows two `160000` lines — one matching `.gitmodules`, one at a stale path.

---

## Fix — remove the orphaned gitlink

```bash
cd /home/irfankabir/gruff

# 1. Remove the stale gitlink from the index (does not touch the working tree directory)
git rm --cached workspace/python-prototype

# 2. Register the correct entry in .git/config
git submodule init python-prototype

# 3. Remove the stale .git/config entry left from the orphan
git config --remove-section submodule."workspace/python-prototype"

# 4. Verify — should show exactly one gitlink at python-prototype
git ls-files --stage | grep ^160000
git submodule status

# 5. Commit and push
git add -A
git commit -m "fix: remove orphaned workspace/python-prototype gitlink from index"
git push origin main
```

---

## Verification

After pushing, confirm CI annotation is gone:

```bash
GRUFF_ID=$(gh run list --repo caraxesthebloodwyrm02/gruff --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view $GRUFF_ID --repo caraxesthebloodwyrm02/gruff 2>&1 | grep -A2 "ANNOTATIONS\|exit code 128"
```

Pass criteria: no `git` exit code 128 annotation in the run output.

---

## Constraints

- Do not force-push. Commit and push normally.
- `git rm --cached` removes only the index entry — the working tree directory is unaffected.
- If `git config --remove-section` reports no section found, that is fine — skip it.
- Identity switches via `~/.gitconfig` `includeIf` — do not override `user.*`.
