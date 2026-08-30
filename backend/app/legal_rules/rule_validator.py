import re
from collections import defaultdict
from typing import Any

from app.legal_rules.applicability import evaluate_applicability
from app.schemas import ApplicabilityState, CoverageState, QualityState, ValidationRequest


FORMAT_PATTERNS = {
    "net_quantity": re.compile(r"\b\d+(?:[.,]\d+)?\s*(?:mg|g|kg|ml|l|litre|liter|cm|m|n|u|unit|units|piece|pieces|pair|pairs)\b", re.I),
    "month_year": re.compile(r"(?:\b(?:0?[1-9]|1[0-2])[/-]\d{2,4}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4}\b)", re.I),
    "mrp": re.compile(r"(?:\bMRP\b|maximum\s+retail\s+price).*?(?:₹|Rs\.?|INR)?\s*\d+(?:[.,]\d{1,2})?.*?(?:incl(?:usive)?\.?\s+of\s+all\s+taxes|all\s+taxes)", re.I),
    "unit_sale_price": re.compile(r"(?:₹|Rs\.?|INR)\s*\d+(?:[.,]\d{1,2})?\s*(?:per|/)\s*(?:g|kg|cm|m|metre|meter|ml|l|litre|liter|number|unit)\b", re.I),
}


def _all_images_sufficient(request: ValidationRequest) -> bool:
    return bool(request.image_quality) and all(item.status == QualityState.SUFFICIENT for item in request.image_quality)


def validate_rule(rule: dict[str, Any], request: ValidationRequest) -> dict[str, Any]:
    applicability = evaluate_applicability(rule, request.context)
    base = {
        "rule_id": rule["rule_id"],
        "rule_version": rule["version"],
        "rule_reference": rule["rule_reference"],
        "requirement": rule["requirement"],
        "applicability": applicability.state.value,
        "applicability_reasons": list(applicability.reasons),
        "evidence": [],
    }

    if applicability.state == ApplicabilityState.NOT_APPLICABLE:
        return {**base, "outcome": "NOT_APPLICABLE", "reason": "Rule does not apply to this inspection context."}
    if applicability.state == ApplicabilityState.UNCERTAIN:
        return {**base, "outcome": "REVIEW", "reason": "Applicability is uncertain; an inspector or additional product context is required."}

    by_field: dict[str, list[Any]] = defaultdict(list)
    for item in request.evidence:
        by_field[item.field].append(item)

    selected = []
    missing: list[str] = []
    low_confidence: list[str] = []
    conflicts: list[str] = []
    threshold = float(rule.get("minimum_confidence", 0.75))

    for field in rule["required_evidence"]:
        candidates = by_field.get(field, [])
        if not candidates:
            missing.append(field)
            continue

        normalized_values = {" ".join(item.value.lower().split()) for item in candidates if item.confidence >= threshold}
        if len(normalized_values) > 1:
            conflicts.append(field)
            selected.extend(candidates)
            continue

        best = max(candidates, key=lambda item: item.confidence)
        selected.append(best)
        if best.confidence < threshold:
            low_confidence.append(field)

    base["evidence"] = [item.model_dump() for item in selected]

    if conflicts:
        return {**base, "outcome": "REVIEW", "reason": f"Conflicting evidence was detected for: {', '.join(conflicts)}."}

    if low_confidence:
        return {**base, "outcome": "REVIEW", "reason": f"OCR/extraction confidence is below threshold for: {', '.join(low_confidence)}."}

    if missing:
        complete_for_missing = all(request.field_coverage.get(field) == CoverageState.COMPLETE for field in missing)
        if complete_for_missing and _all_images_sufficient(request):
            return {
                **base,
                "outcome": "FAIL",
                "reason": f"No declaration was found for {', '.join(missing)} after sufficient image quality and field-specific complete coverage were established.",
            }
        return {
            **base,
            "outcome": "REVIEW",
            "reason": f"Evidence was not reliably detected for {', '.join(missing)}, but absence is not established from the supplied images.",
        }

    validation_format = rule.get("validation_config", {}).get("format")
    if validation_format:
        pattern = FORMAT_PATTERNS[validation_format]
        invalid = [item.field for item in selected if not pattern.search(item.value)]
        if invalid:
            return {**base, "outcome": "FAIL", "reason": f"Detected declaration has an invalid or incomplete format for: {', '.join(invalid)}."}

    return {**base, "outcome": "PASS", "reason": "Required evidence was detected with sufficient confidence and passed deterministic validation."}


def validate_rules(rules: list[dict[str, Any]], request: ValidationRequest) -> list[dict[str, Any]]:
    return [validate_rule(rule, request) for rule in rules]
