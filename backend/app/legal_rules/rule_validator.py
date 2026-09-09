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

FIELD_LABELS = {
    "responsible_party_name": "manufacturer, packer, or importer name",
    "responsible_party_address": "responsible-party address",
    "commodity_name": "common or generic commodity name",
    "net_quantity": "net quantity",
    "mrp": "maximum retail price",
    "consumer_care": "consumer-care contact",
    "country_of_origin": "country of origin",
    "manufacture_pack_import_date": "manufacture, packing, or import date",
    "best_before_or_use_by": "best-before or use-by date",
    "unit_sale_price": "unit sale price",
}

CONDITION_EVIDENCE = {
    "date_declaration_required": "manufacture_pack_import_date",
    "may_become_unfit_for_human_consumption": "best_before_or_use_by",
    "unit_sale_price_required": "unit_sale_price",
}


def _labels(fields: list[str]) -> str:
    return ", ".join(FIELD_LABELS.get(field, field.replace("_", " ")) for field in fields)


def _review_reason(rule: dict[str, Any], reasons: tuple[str, ...] | list[str]) -> str:
    fields = _labels(rule.get("required_evidence", []))
    conditions = rule.get("applicability", {}).get("required_conditions", [])
    origins = rule.get("applicability", {}).get("origins", [])
    if origins:
        return f"Confirm whether the product is imported before the {fields} requirement is applied."
    if conditions:
        condition = conditions[0].replace("_", " ")
        return f"Confirm that {condition} for this product; the detected {fields} is retained as evidence."
    detail = next((reason for reason in reasons if reason), "inspection context is incomplete")
    return f"Confirm the product context for {fields}: {detail}."


def _all_images_sufficient(request: ValidationRequest) -> bool:
    return bool(request.image_quality) and all(item.status == QualityState.SUFFICIENT for item in request.image_quality)


def _context_with_evidence_inferences(rule: dict[str, Any], request: ValidationRequest):
    """Resolve context only when the package itself supplies strong evidence.

    A visible declaration can establish that a conditional check should be
    validated without asking the officer to repeat the same fact in a checkbox.
    Country of origin is likewise inferred only from a confident, labelled OCR
    field. Missing evidence never creates an inference and therefore remains
    REVIEW rather than becoming a false pass or failure.
    """
    context = request.context.model_copy(deep=True)
    threshold = float(rule.get("minimum_confidence", 0.75))
    strong_fields = {
        item.field: item
        for item in request.evidence
        if item.value.strip() and item.confidence >= threshold
    }
    inferences: list[str] = []

    if context.origin == "unknown" and "country_of_origin" in strong_fields:
        country = strong_fields["country_of_origin"].value.strip()
        if re.search(r"\bindia\b", country, re.I):
            context.origin = "domestic"
            inferences.append("domestic origin inferred from the detected country-of-origin declaration")
        elif re.search(r"[A-Za-z]{3,}", country):
            context.origin = "imported"
            inferences.append("imported origin inferred from the detected country-of-origin declaration")

    required_conditions = set(rule.get("applicability", {}).get("required_conditions", []))
    for condition in required_conditions:
        field = CONDITION_EVIDENCE.get(condition)
        if field and field in strong_fields and condition not in context.product_conditions:
            context.product_conditions.add(condition)
            inferences.append(f"{condition.replace('_', ' ')} inferred from detected {_labels([field])}")

    return context, inferences


def validate_rule(rule: dict[str, Any], request: ValidationRequest) -> dict[str, Any]:
    inferred_context, context_inferences = _context_with_evidence_inferences(rule, request)
    applicability = evaluate_applicability(rule, inferred_context)
    base = {
        "rule_id": rule["rule_id"],
        "rule_version": rule["version"],
        "rule_reference": rule["rule_reference"],
        "requirement": rule["requirement"],
        "applicability": applicability.state.value,
        "applicability_reasons": list(applicability.reasons),
        "context_inferences": context_inferences,
        "evidence": [],
    }

    if applicability.state == ApplicabilityState.NOT_APPLICABLE:
        return {**base, "outcome": "NOT_APPLICABLE", "reason": "Rule does not apply to this inspection context."}
    if applicability.state == ApplicabilityState.UNCERTAIN:
        return {**base, "outcome": "REVIEW", "reason": _review_reason(rule, applicability.reasons)}

    by_field: dict[str, list[Any]] = defaultdict(list)
    for item in request.evidence:
        by_field[item.field].append(item)

    # Rule 6(2) accepts a consumer contact channel. The UI stores phone and
    # email separately for usability, so make either one satisfy the combined
    # legal evidence key instead of producing a contradictory review card.
    if not by_field.get("consumer_care"):
        for alias in ("consumer_phone", "consumer_email"):
            by_field["consumer_care"].extend(
                item.model_copy(update={"field": "consumer_care"}) for item in by_field.get(alias, [])
            )

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
        return {**base, "outcome": "REVIEW", "reason": f"Different values were detected for {_labels(conflicts)}; compare them with the package evidence."}

    if low_confidence:
        return {**base, "outcome": "REVIEW", "reason": f"The detected {_labels(low_confidence)} is uncertain; verify it against the highlighted package evidence."}

    if missing:
        complete_for_missing = all(request.field_coverage.get(field) == CoverageState.COMPLETE for field in missing)
        if complete_for_missing and _all_images_sufficient(request):
            return {
                **base,
                "outcome": "FAIL",
                "reason": f"No {_labels(missing)} declaration was found after all relevant package surfaces and image quality were confirmed.",
            }
        return {
            **base,
            "outcome": "REVIEW",
            "reason": f"The {_labels(missing)} was not reliably detected; absence is not established. More package surfaces or clearer evidence are needed.",
        }

    validation_format = rule.get("validation_config", {}).get("format")
    if validation_format:
        pattern = FORMAT_PATTERNS[validation_format]
        invalid = [item.field for item in selected if not pattern.search(item.value)]
        if invalid:
            format_confirmed = all(request.field_coverage.get(field) == CoverageState.COMPLETE for field in invalid) and _all_images_sufficient(request)
            if format_confirmed:
                return {**base, "outcome": "FAIL", "reason": f"The detected {_labels(invalid)} declaration has an invalid format after the relevant package surfaces and image quality were confirmed."}
            return {**base, "outcome": "REVIEW", "reason": f"The detected {_labels(invalid)} could not be normalized to the required format; verify the original package text or provide clearer evidence."}

    detected = "; ".join(f"{FIELD_LABELS.get(item.field, item.field)}: {item.value}" for item in selected)
    return {**base, "outcome": "PASS", "reason": f"Detected and validated: {detected}."}


def validate_rules(rules: list[dict[str, Any]], request: ValidationRequest) -> list[dict[str, Any]]:
    return [validate_rule(rule, request) for rule in rules]
