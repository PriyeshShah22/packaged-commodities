from app.legal_rules.applicability import evaluate_applicability
from app.legal_rules.rule_loader import load_all_rules
from app.schemas import ApplicabilityState, InspectionContext, InspectionMode


def rule(rule_id: str):
    return next(item for item in load_all_rules() if item["rule_id"] == rule_id)


def test_retail_rules_do_not_run_on_wholesale_package():
    context = InspectionContext(
        inspection_mode=InspectionMode.PHYSICAL_PACKAGE,
        package_context="wholesale",
        origin="domestic",
        sales_context="wholesale",
    )
    result = evaluate_applicability(rule("LMPC-R6-1E-MRP"), context)
    assert result.state == ApplicabilityState.NOT_APPLICABLE


def test_import_origin_unknown_requires_review():
    context = InspectionContext(
        inspection_mode=InspectionMode.PHYSICAL_PACKAGE,
        package_context="retail_prepackaged",
        origin="unknown",
        sales_context="retail",
    )
    result = evaluate_applicability(rule("LMPC-R6-1B-COUNTRY-OF-ORIGIN"), context)
    assert result.state == ApplicabilityState.UNCERTAIN


def test_conditional_date_rule_is_uncertain_without_condition():
    context = InspectionContext(
        inspection_mode=InspectionMode.PHYSICAL_PACKAGE,
        package_context="retail_prepackaged",
        origin="domestic",
        sales_context="retail",
    )
    result = evaluate_applicability(rule("LMPC-R6-1D-DATE"), context)
    assert result.state == ApplicabilityState.UNCERTAIN
