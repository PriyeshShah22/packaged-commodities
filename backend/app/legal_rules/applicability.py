from dataclasses import dataclass
from typing import Any

from app.schemas import ApplicabilityState, InspectionContext


@dataclass(frozen=True)
class ApplicabilityResult:
    state: ApplicabilityState
    reasons: tuple[str, ...]


CONTEXT_FIELDS = {
    "inspection_modes": "inspection_mode",
    "package_contexts": "package_context",
    "product_categories": "product_category",
    "origins": "origin",
    "sales_contexts": "sales_context",
}


def evaluate_applicability(rule: dict[str, Any], context: InspectionContext) -> ApplicabilityResult:
    constraints = rule.get("applicability", {})
    uncertain: list[str] = []

    for constraint_name, context_name in CONTEXT_FIELDS.items():
        allowed = constraints.get(constraint_name)
        if not allowed:
            continue
        value = getattr(context, context_name)
        value = value.value if hasattr(value, "value") else value
        if value == "unknown":
            uncertain.append(f"{context_name} is unknown")
        elif value not in allowed:
            return ApplicabilityResult(
                ApplicabilityState.NOT_APPLICABLE,
                (f"{context_name}={value} is outside {allowed}",),
            )

    required_conditions = set(constraints.get("required_conditions", []))
    missing_conditions = required_conditions - context.product_conditions
    if missing_conditions:
        uncertain.append(f"unresolved product conditions: {sorted(missing_conditions)}")

    if uncertain:
        return ApplicabilityResult(ApplicabilityState.UNCERTAIN, tuple(uncertain))
    return ApplicabilityResult(ApplicabilityState.APPLICABLE, ("all applicability constraints satisfied",))
