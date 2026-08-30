import json
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any


REGISTRY_DIR = Path(__file__).resolve().parent


@lru_cache
def load_all_rules() -> tuple[dict[str, Any], ...]:
    with (REGISTRY_DIR / "rules.json").open(encoding="utf-8") as handle:
        rules = json.load(handle)

    seen: set[tuple[str, str]] = set()
    for rule in rules:
        key = (rule["rule_id"], rule["version"])
        if key in seen:
            raise ValueError(f"Duplicate rule/version in registry: {key}")
        seen.add(key)
    return tuple(rules)


def active_rules(as_of: date) -> list[dict[str, Any]]:
    active: list[dict[str, Any]] = []
    for rule in load_all_rules():
        starts = date.fromisoformat(rule["effective_date"])
        ends = date.fromisoformat(rule["end_date"]) if rule.get("end_date") else None
        if starts <= as_of and (ends is None or as_of <= ends):
            active.append(rule.copy())
    return active


def get_rule(rule_id: str, as_of: date) -> dict[str, Any] | None:
    matches = [rule for rule in active_rules(as_of) if rule["rule_id"] == rule_id]
    if not matches:
        return None
    if len(matches) > 1:
        raise ValueError(f"Overlapping active versions for {rule_id} on {as_of}")
    return matches[0]
