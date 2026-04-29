#!/usr/bin/env python3
"""Validate required provenance and attribution fields in PROJECT_REGISTRY.yaml."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

import yaml


def _is_non_empty_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _project_label(project: dict[str, Any], index: int) -> str:
    return (
        project.get("id")
        or project.get("name")
        or project.get("alias")
        or f"project[{index}]"
    )


def validate_registry(data: Any) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    if not isinstance(data, dict):
        return ["Registry root must be a YAML mapping."], warnings

    policy = data.get("attribution_policy")
    canonical_line = ""
    if isinstance(policy, dict):
        canonical_line = str(policy.get("canonical_line", "")).strip()
    if not canonical_line:
        errors.append("Missing `attribution_policy.canonical_line`.")

    projects = data.get("projects")
    if not isinstance(projects, list) or not projects:
        errors.append("Missing or empty `projects` list.")
        return errors, warnings

    for index, project in enumerate(projects):
        if not isinstance(project, dict):
            errors.append(f"projects[{index}] must be a mapping.")
            continue

        label = _project_label(project, index)

        when_value = project.get("started_on") or project.get("when")
        if not _is_non_empty_text(when_value):
            errors.append(f"{label}: missing `started_on` (when).")

        why_value = project.get("created_why") or project.get("why")
        if not _is_non_empty_text(why_value):
            errors.append(f"{label}: missing `created_why` (why).")

        how_value = project.get("created_how") or project.get("how")
        if not _is_non_empty_text(how_value):
            errors.append(f"{label}: missing `created_how` (how).")

        evidence = project.get("evidence")
        if not isinstance(evidence, list) or not evidence:
            errors.append(f"{label}: missing non-empty `evidence` list.")
        else:
            for evidence_index, entry in enumerate(evidence):
                if not isinstance(entry, dict):
                    errors.append(
                        f"{label}: evidence[{evidence_index}] must be a mapping."
                    )
                    continue
                if not _is_non_empty_text(entry.get("path")):
                    errors.append(
                        f"{label}: evidence[{evidence_index}] missing `path`."
                    )

        attribution = project.get("attribution")
        if not isinstance(attribution, dict):
            errors.append(f"{label}: missing `attribution` mapping.")
        else:
            for field in ("author", "known_as", "signature"):
                if not _is_non_empty_text(attribution.get(field)):
                    errors.append(f"{label}: attribution missing `{field}`.")

            signature = str(attribution.get("signature", "")).strip()
            if canonical_line and signature != canonical_line:
                errors.append(
                    f"{label}: attribution signature mismatch. "
                    f"Expected `{canonical_line}` got `{signature}`."
                )

        if not _is_non_empty_text(project.get("path")):
            warnings.append(f"{label}: missing `path`; propagation may skip it.")

    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate PROJECT_REGISTRY.yaml provenance and attribution fields."
    )
    parser.add_argument(
        "--registry",
        default="~/PROJECT_REGISTRY.yaml",
        help="Path to PROJECT_REGISTRY.yaml",
    )
    args = parser.parse_args()

    registry_path = Path(args.registry).expanduser().resolve()
    if not registry_path.exists():
        print(f"[FAIL] Registry not found: {registry_path}")
        return 1

    try:
        data = yaml.safe_load(registry_path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        print(f"[FAIL] Invalid YAML in {registry_path}: {exc}")
        return 1

    errors, warnings = validate_registry(data)

    if errors:
        print(f"[FAIL] {len(errors)} validation error(s) in {registry_path}:")
        for item in errors:
            print(f"  - {item}")
    else:
        print(f"[OK] Registry validation passed: {registry_path}")

    if warnings:
        print(f"[WARN] {len(warnings)} warning(s):")
        for item in warnings:
            print(f"  - {item}")

    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
