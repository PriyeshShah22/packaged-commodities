import json
from datetime import date

from jsonschema import Draft202012Validator, FormatChecker

from app.legal_rules.rule_loader import REGISTRY_DIR, active_rules, load_all_rules


def test_registry_entries_match_schema():
    schema = json.loads((REGISTRY_DIR / "rule_schema.json").read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = []
    for rule in load_all_rules():
        errors.extend(validator.iter_errors(rule))
    assert errors == []


def test_2026_ecommerce_rule_is_date_versioned():
    rule_id = "LMPC-R6-10A-ECOMMERCE-COO-FILTER"
    assert rule_id not in {rule["rule_id"] for rule in active_rules(date(2026, 6, 30))}
    assert rule_id in {rule["rule_id"] for rule in active_rules(date(2026, 7, 1))}
    assert rule_id not in {rule["rule_id"] for rule in active_rules(date(2027, 7, 1))}
