from app.legal_rules.rule_loader import load_all_rules
from app.legal_rules.rule_validator import validate_rule
from app.schemas import EvidenceItem, ImageQuality, InspectionContext, InspectionMode, ValidationRequest


def rule(rule_id: str):
    return next(item for item in load_all_rules() if item["rule_id"] == rule_id)


def retail_request(**updates):
    values = {
        "context": InspectionContext(
            inspection_mode=InspectionMode.PHYSICAL_PACKAGE,
            package_context="retail_prepackaged",
            origin="domestic",
            sales_context="retail",
        ),
        "evidence": [],
        "field_coverage": {},
        "image_quality": [],
    }
    values.update(updates)
    return ValidationRequest(**values)


def test_not_detected_is_review_when_coverage_is_incomplete():
    request = retail_request(
        field_coverage={"consumer_care": "incomplete"},
        image_quality=[ImageQuality(image_id="IMG-001", status="sufficient")],
    )
    result = validate_rule(rule("LMPC-R6-2-CONSUMER-CARE"), request)
    assert result["outcome"] == "REVIEW"
    assert "absence is not established" in result["reason"]


def test_missing_can_fail_only_with_complete_coverage_and_good_images():
    request = retail_request(
        field_coverage={"consumer_care": "complete"},
        image_quality=[ImageQuality(image_id="IMG-001", status="sufficient")],
    )
    result = validate_rule(rule("LMPC-R6-2-CONSUMER-CARE"), request)
    assert result["outcome"] == "FAIL"


def test_low_confidence_is_review_not_failure():
    request = retail_request(
        evidence=[EvidenceItem(field="consumer_care", value="care@example.com", confidence=0.42, image_id="IMG-002")]
    )
    result = validate_rule(rule("LMPC-R6-2-CONSUMER-CARE"), request)
    assert result["outcome"] == "REVIEW"


def test_conflicting_evidence_is_review_and_both_sources_are_retained():
    request = retail_request(
        evidence=[
            EvidenceItem(field="consumer_care", value="care-one@example.com", confidence=0.95, image_id="IMG-001"),
            EvidenceItem(field="consumer_care", value="care-two@example.com", confidence=0.96, image_id="IMG-002"),
        ]
    )
    result = validate_rule(rule("LMPC-R6-2-CONSUMER-CARE"), request)
    assert result["outcome"] == "REVIEW"
    assert len(result["evidence"]) == 2


def test_valid_mrp_passes_with_bbox_evidence():
    request = retail_request(
        evidence=[
            EvidenceItem(
                field="mrp",
                value="MRP ₹50 inclusive of all taxes",
                confidence=0.98,
                image_id="IMG-001",
                bbox=[120, 420, 310, 470],
            )
        ]
    )
    result = validate_rule(rule("LMPC-R6-1E-MRP"), request)
    assert result["outcome"] == "PASS"
    assert result["evidence"][0]["bbox"] == [120.0, 420.0, 310.0, 470.0]


def test_invalid_format_is_review_until_coverage_and_quality_are_confirmed():
    evidence = [EvidenceItem(field="mrp", value="MRP ₹016", confidence=0.99, image_id="IMG-001")]
    uncertain = retail_request(evidence=evidence, field_coverage={"mrp": "incomplete"}, image_quality=[ImageQuality(image_id="IMG-001", status="sufficient")])
    assert validate_rule(rule("LMPC-R6-1E-MRP"), uncertain)["outcome"] == "REVIEW"
    confirmed = retail_request(evidence=evidence, field_coverage={"mrp": "complete"}, image_quality=[ImageQuality(image_id="IMG-001", status="sufficient")])
    assert validate_rule(rule("LMPC-R6-1E-MRP"), confirmed)["outcome"] == "FAIL"
