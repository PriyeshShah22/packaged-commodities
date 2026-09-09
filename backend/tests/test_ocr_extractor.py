from types import SimpleNamespace

import cv2
import numpy as np

from app.ocr.extractor import extract_declarations
from app.api import _grouping_tokens, _token_similarity
from app.ocr.dot_matrix import (
    _date,
    _is_plausible_row_value,
    _looks_like_partial_date,
    _normalize,
    _row_field,
    _value_lanes,
)
from app.ocr import service


def line(text, confidence=0.95, image_id="IMG-001", y=0):
    return {"text": text, "confidence": confidence, "image_id": image_id, "bbox": [10, y, 400, y + 20]}


def test_live_ocr_uses_fast_primary_pass_and_keeps_full_cache_separate(monkeypatch):
    image = np.full((620, 820, 3), 180, dtype=np.uint8)
    ok, encoded = cv2.imencode(".jpg", image)
    assert ok
    result = SimpleNamespace(
        boxes=np.array([[[10, 10], [300, 10], [300, 40], [10, 40]]]),
        txts=["MRP Rs. 23.00"],
        scores=[.96],
    )
    engine_calls = []
    dot_calls = []

    def engine(*args, **kwargs):
        engine_calls.append(kwargs)
        return result

    monkeypatch.setattr(service, "get_ocr_engine", lambda: engine)
    monkeypatch.setattr(service, "extract_dot_matrix_lines", lambda *args, **kwargs: dot_calls.append(True) or [])
    service._ocr_cache.clear()

    live_lines, live_quality = service.run_ocr(encoded.tobytes(), "CAM-1", live=True)
    live_engine_calls = len(engine_calls)
    full_lines, full_quality = service.run_ocr(encoded.tobytes(), "IMG-1")

    assert live_lines[0]["text"] == "MRP Rs. 23.00"
    assert live_quality["dot_matrix_fields_detected"] == 0
    assert live_engine_calls == 1
    assert len(engine_calls) > live_engine_calls
    assert dot_calls == [True]
    assert not live_quality["ocr_cache_hit"]
    assert not full_quality["ocr_cache_hit"]
    assert full_lines[0]["image_id"] == "IMG-1"


def test_extracts_core_package_declarations_with_evidence_location():
    fields = extract_declarations([
        line("Manufactured by ABC Foods Pvt Ltd", y=10),
        line("12 Industrial Estate, Ahmedabad, Gujarat, India", y=35),
        line("Net Quantity 200 g", y=60),
        line("MRP Rs. 50 inclusive of all taxes", y=85),
        line("Consumer Care care@abcfoods.in 1800 111 222", y=110),
        line("Best before 6 months from packing", y=135),
    ])
    assert "200 g" in fields["net_quantity"]["value"]
    assert fields["mrp"]["value"] == "MRP ₹50 inclusive of all taxes"
    assert "care@abcfoods.in" in fields["consumer_care"]["value"]
    assert fields["mrp"]["image_id"] == "IMG-001"
    assert len(fields["mrp"]["bbox"]) == 4


def test_keeps_alternatives_for_conflicting_multi_image_values():
    fields = extract_declarations([
        line("MRP Rs. 50 inclusive of all taxes", image_id="IMG-001"),
        line("MRP Rs. 60 inclusive of all taxes", image_id="IMG-002"),
    ])
    assert fields["mrp"]["alternatives"]


def test_cross_checks_damaged_dot_mrp_against_quantity_and_unit_price():
    fields = extract_declarations([
        line("200 g", confidence=.95, y=10),
        line("MRP ₹639.00 inclusive of all taxes", confidence=.82, y=35),
        line("Unit sale price ₹1.70 per g", confidence=.91, y=60),
    ])

    assert fields["net_quantity"]["value"] == "200 g"
    assert fields["unit_sale_price"]["value"] == "₹1.70 per g"
    assert fields["mrp"]["value"] == "MRP ₹339.00 inclusive of all taxes"
    assert "Cross-checked" in fields["mrp"]["inference"]


def test_single_ingredient_identity_beats_back_panel_marketing_slogan():
    fields = extract_declarations([
        line("SOURCED DIRECT", confidence=.99, y=10),
        line("Natural feature of product", confidence=.98, y=40),
        line("Ingredients: Cashew Kernels", confidence=.94, y=80),
        line("Allergens: Contains tree nuts", confidence=.96, y=110),
    ])

    assert fields["product_name"]["value"] == "Cashew Kernels"
    assert fields["commodity_name"]["value"] == "Cashew Kernels"
    assert fields["product_name"]["source_type"] == "ingredient_identity"


def test_label_anchoring_does_not_map_nutrition_values_to_net_quantity():
    fields = extract_declarations([
        line("SALT"), line("IODISED"), line("NET.WT.200gm"), line("482 KCA"),
        line("MRP:120"), line("MFG:17/08/26"), line("Protein"),
        line("3.30gm"), line("50.01gm"), line("EXP:16/10/26"),
        line("BATCH NO G052511"),
    ])
    assert fields["net_quantity"]["value"] == "200 g"
    assert fields["mrp"]["value"].startswith("MRP ₹120")
    assert fields["manufacture_pack_import_date"]["value"] == "17/08/2026"
    assert fields["best_before_or_use_by"]["value"] == "16/10/2026"
    assert fields["batch_number"]["value"] == "G052511"


def test_maps_responsible_party_contact_fssai_and_generic_product_separately():
    fields = extract_declarations([
        line("Product Category: Medium Fat Frozen Dessert", y=5),
        line("Consumer care: For feedback contact", y=10),
        line("customercare@creampot.in or call", y=20),
        line("+918484088130", y=30),
        line("Marketed by: Walko Food Company Pvt. Ltd.", y=40),
        line("701B, Churchgate Chamber, 5 New Marine Line,", y=50),
        line("Mumbai, Maharashtra-400020", y=60),
        line("FSSAI Lic. No. 11522997000407", y=70),
    ])
    assert fields["commodity_name"]["value"] == "Medium Fat Frozen Dessert"
    assert fields["responsible_party_name"]["value"] == "Walko Food Company Pvt. Ltd."
    assert "Mumbai" in fields["responsible_party_address"]["value"]
    assert fields["fssai_license"]["value"] == "11522997000407"
    assert fields["consumer_phone"]["value"] == "+918484088130"
    assert fields["consumer_email"]["value"] == "customercare@creampot.in"


def test_maps_fssai_value_when_ocr_splits_caption_and_number():
    fields = extract_declarations([
        line("FSSAI Lic. No.", y=10),
        line("11522997000407", y=32),
        line("8906082371231", y=80),
    ])
    assert fields["fssai_license"]["value"] == "11522997000407"
    assert fields["barcode"]["value"] == "8906082371231"


def test_qr_detector_payload_is_retained_as_a_structured_field():
    fields = extract_declarations([
        {**line("QR Code: https://example.test/product/42"), "source_type": "qr_detector"},
    ])
    assert fields["qr_code"]["value"] == "https://example.test/product/42"


def test_address_does_not_include_nearby_party_or_qr_instructions():
    def box(text, x, y, width=300):
        return {"text": text, "confidence": .96, "image_id": "BACK", "bbox": [x, y, x + width, y + 24]}

    fields = extract_declarations([
        box("Manufactured by: For manufacturing unit address", 600, 20, 390),
        box("Marketed by: Example Foods Pvt. Ltd.", 20, 100, 420),
        box("701B, Commerce Chamber, 5 New Marine Line", 20, 132, 470),
        box("Mumbai, Maharashtra 400020", 20, 164, 310),
        box("scan the QR code", 20, 190, 220),
    ])
    assert fields["responsible_party_address"]["value"] == "701B, Commerce Chamber, 5 New Marine Line Mumbai, Maharashtra 400020"


def test_standalone_postal_line_maps_and_normalizes_spaced_pin_code():
    fields = extract_declarations([
        line("Kolihire, Tal Purandar, Dist. Pune 412 303.", confidence=.94, y=30),
    ])
    assert fields["responsible_party_address"]["value"] == "Kolihire, Tal Purandar, Dist. Pune 412303"


def test_expiry_date_is_not_promoted_to_batch_number():
    fields = extract_declarations([
        line("Batch No.", y=10),
        line("23-02-2027", y=30),
        line("Best Before: 23-02-2027", y=50),
    ])
    assert "batch_number" not in fields
    assert fields["best_before_or_use_by"]["value"] == "23/02/2027"


def test_complete_live_price_beats_confident_clipped_fragment():
    fields = extract_declarations([
        line("MRP ₹220.00", confidence=.78, image_id="CAM-PRECISION"),
        line("MRP ₹2", confidence=.99, image_id="CAM-FAST"),
    ])
    assert fields["mrp"]["value"] == "MRP ₹220.00"


def test_nutrition_declared_amount_and_rda_columns_are_preserved():
    def cell(text, x, y, width=100):
        return {"text": text, "confidence": .96, "image_id": "NUTRITION", "bbox": [x, y, x + width, y + 22]}

    fields = extract_declarations([
        cell("Nutritional Information", 10, 10, 250),
        cell("Nutrient", 10, 40), cell("Per 100 g", 220, 40), cell("% RDA", 420, 40),
        cell("Total Sugar", 10, 70, 150), cell("22.16 g", 220, 70), cell("16.75", 420, 70),
    ])
    assert "Total Sugar 22.16 g | RDA 16.75" in fields["nutrition_information"]["value"]


def test_repairs_common_dot_matrix_price_date_and_batch_confusions():
    assert _normalize("mrp", "Bs:220:00")[0] == "MRP ₹220.00 inclusive of all taxes"
    assert _normalize("mrp", "No:")[0] == ""
    assert _normalize("unit_sale_price", "ES:220FER LT")[0] == "Unit sale price ₹220 per L"
    assert _normalize("batch_number", "2O7F26")[0] == "Batch No S07F26"
    assert _date("97/0672026")[0] == "07/06/2026"
    assert _date("97/06/2026")[0] == "07/06/2026"


def test_dot_matrix_labels_survive_spacing_and_minor_ocr_damage():
    assert _row_field("M R P (incl. taxes)") == "mrp"
    assert _row_field("BATCH N0.") == "batch_number"
    assert _row_field("USE BY DATE") == "best_before_or_use_by"


def test_does_not_use_phone_number_as_batch_or_cross_map_specialized_dates():
    fields = extract_declarations([
        line("+918484088130", y=10),
        line("character of batch no. and scan the QR code", y=10),
        {**line("Use by date: 06/06/2027", y=40), "source_type": "dot_matrix_ocr"},
        line("DATE OF MANUFACTURE:", y=40),
    ])
    assert "batch_number" not in fields
    assert "manufacture_pack_import_date" not in fields
    assert fields["best_before_or_use_by"]["value"] == "06/06/2027"


def test_product_name_rejects_url_contact_identifiers_and_prefers_prominent_label():
    lines = [
        line("www.creampot.in", confidence=1.0, y=10),
        line("customercare@creampot.in", confidence=.99, y=30),
        line("+918484088130", confidence=.99, y=50),
        line("11522997000407", confidence=1.0, y=70),
        line("8906082371231", confidence=1.0, y=90),
        {**line("CHOCOLATE", confidence=.96, y=120), "bbox": [10, 120, 500, 180]},
        {**line("Desire", confidence=1.0, y=185), "bbox": [100, 185, 400, 225]},
    ]
    fields = extract_declarations(lines)
    assert fields["product_name"]["value"] == "Chocolate Desire"
    assert "creampot.in" not in fields["product_name"]["value"].lower()


def test_separate_product_extractions_do_not_share_fields():
    product_one = extract_declarations([line("MRP Rs. 220 inclusive of all taxes"), line("Net Quantity 1 L", y=30)])
    product_two = extract_declarations([line("MRP Rs. 80 inclusive of all taxes", image_id="IMG-001"), line("Net Quantity 200 g", image_id="IMG-001", y=30)])
    assert product_one["mrp"]["value"].startswith("MRP ₹220")
    assert product_two["mrp"]["value"].startswith("MRP ₹80")
    assert product_one["net_quantity"]["value"] == "1 L"
    assert product_two["net_quantity"]["value"] == "200 g"


def test_normalizes_common_price_date_quantity_and_batch_formats():
    variants = [
        ("MRP ₹23.00", "MRP ₹23.00"),
        ("MRP 23/-", "MRP ₹23"),
        ("MRP Rs. 23,50", "MRP ₹23.50"),
        ("MRP INR 23", "MRP ₹23"),
    ]
    for text, expected in variants:
        fields = extract_declarations([line(text)])
        assert fields["mrp"]["value"] == expected
        assert fields["mrp"]["raw_text"] == text
    fields = extract_declarations([
        line("Mfg. Date 24-11-2025", y=10),
        line("USE BY 23.02.27", y=35),
        line("Batch # ab-19/x", y=60),
        line("Net Wt: 500 GMS", y=85),
    ])
    assert fields["manufacture_pack_import_date"]["value"] == "24/11/2025"
    assert fields["best_before_or_use_by"]["value"] == "23/02/2027"
    assert fields["batch_number"]["value"] == "AB-19/X"
    assert fields["net_quantity"]["value"] == "500 g"
    relative = extract_declarations([line("Best before 6 months from packing")])
    assert relative["best_before_or_use_by"]["value"] == "6 months from packing"


def test_mrp_does_not_take_adjacent_batch_number_and_back_panel_is_not_product_name():
    fields = extract_declarations([
        line("Batch No 016KE", y=10),
        line("MRP ₹ 016KE 23.00 (₹ 0.23/g)", y=35),
        line("Tis O Ram Tmakorfancy Industrialarea, Ghaziabad (U.P.)-201102", y=70),
        line("Per Lit", y=95),
        line("Issai", y=120),
    ])
    assert fields["mrp"]["value"] == "MRP ₹23.00"
    assert "product_name" not in fields


def test_mrp_prefers_retail_amount_over_dot_matrix_unit_price_candidate():
    fields = extract_declarations([
        {**line("MRP ₹0.23 inclusive of all taxes", y=35), "source_type": "dot_matrix_ocr"},
        line("23.00 (₹0.23/g)", y=35),
    ])
    assert fields["mrp"]["value"] == "MRP ₹23.00 inclusive of all taxes"

def test_grouping_uses_brand_domain_as_hint_without_turning_it_into_product_name():
    front = _grouping_tokens([{"text": "CREAM POT CHOCOLATE DESIRE", "confidence": .98}], {})
    back = _grouping_tokens([{"text": "www.creampot.in", "confidence": .99}], {})
    assert _token_similarity(front, back) >= .2
    assert "www.creampot.in" not in front | back


def test_unusual_spaced_stamped_price_date_batch_and_quantity_formats():
    fields = extract_declarations([
        line("M R P Rs. 369.00", y=10),
        line("U S P ₹0.74 per g", y=35),
        line("P K D FEB-2026", y=60),
        line("USE BY AUG-2026", y=85),
        line("B. No A7-26/X", y=110),
        line("N E T W T 500 GMS", y=135),
    ])
    assert fields["mrp"]["value"] == "MRP ₹369.00"
    assert fields["mrp"]["raw_text"] == "M R P Rs. 369.00"
    assert fields["unit_sale_price"]["value"] == "₹0.74 per g"
    assert fields["manufacture_pack_import_date"]["value"] == "02/2026"
    assert fields["best_before_or_use_by"]["value"] == "08/2026"
    assert fields["batch_number"]["value"] == "A7-26/X"
    assert fields["net_quantity"]["value"] == "500 g"


def test_random_ocr_sentence_is_not_promoted_to_product_name():
    fields = extract_declarations([
        {**line("Tis O Ram Tmakorfancy Name Andoes Otrerent Ts True Natue", confidence=.96), "bbox": [5, 5, 900, 90]},
        line("FSSAI Lic. No. 10016051001876", y=100),
    ])
    assert "product_name" not in fields


def test_maps_values_when_live_ocr_splits_labels_into_adjacent_boxes():
    def box(text, x, y, width=180, confidence=.94):
        return {"text": text, "confidence": confidence, "image_id": "CAM-001", "bbox": [x, y, x + width, y + 24]}

    fields = extract_declarations([
        box("MRP", 20, 10, 75), box("₹ 230", 115, 12, 90),
        box("Net Wt.", 20, 50, 90), box("500 g", 125, 52, 80),
        box("Packed On", 20, 90, 110), box("FEB-2026", 150, 92, 105),
        box("Use By", 20, 130, 85), box("AUG-2026", 150, 132, 105),
        box("Batch No.", 20, 170, 100), box("E-UN26-1265", 150, 172, 145),
        box("Customer Care", 20, 210, 130), box("+91 98765 43210", 170, 212, 165),
    ])

    assert fields["mrp"]["value"] == "MRP ₹230"
    assert fields["net_quantity"]["value"] == "500 g"
    assert fields["manufacture_pack_import_date"]["value"] == "02/2026"
    assert fields["best_before_or_use_by"]["value"] == "08/2026"
    assert fields["batch_number"]["value"] == "E-UN26-1265"
    assert fields["consumer_phone"]["value"] == "+919876543210"
    assert "MRP ₹ 230" in fields["mrp"]["raw_text"]


def test_complete_numeric_value_beats_higher_confidence_clipped_fragment():
    fields = extract_declarations([
        line("MRP ₹230.00", confidence=.94, image_id="CAM-001"),
        line("MRP ₹2", confidence=.99, image_id="CAM-002"),
        line("Net Wt. 500 g", confidence=.93, image_id="CAM-001", y=30),
        line("Net Wt. 5 g", confidence=.98, image_id="CAM-002", y=30),
    ])
    assert fields["mrp"]["value"] == "MRP ₹230.00"
    assert fields["net_quantity"]["value"] == "500 g"


def test_single_prominent_brand_fragment_is_not_a_complete_product_name():
    fields = extract_declarations([
        {**line("ACME", confidence=.99), "bbox": [10, 10, 500, 80]},
        line("Net Quantity 500 g", y=100),
    ])
    assert "product_name" not in fields


def test_maps_misaligned_price_value_using_spatial_evidence():
    def box(text, x, y, width=120, height=24, confidence=.95):
        return {"text": text, "confidence": confidence, "image_id": "CAM-001", "bbox": [x, y, x + width, y + height]}

    fields = extract_declarations([
        box("M.R.P. (incl. taxes)", 20, 20, 190, 22),
        box("₹ 349.00", 245, 34, 130, 46),
        box("Batch K21A", 20, 100, 150, 22),
    ])

    assert fields["mrp"]["value"] == "MRP ₹349.00 inclusive of all taxes"
    assert "₹ 349.00" in fields["mrp"]["raw_text"]


def test_separates_brand_from_dominant_product_name_without_name_lookup():
    fields = extract_declarations([
        {**line("PROV SELECT", confidence=.94, y=10), "bbox": [80, 10, 350, 45]},
        {**line("CASHEW", confidence=.97, y=65), "bbox": [35, 65, 470, 135]},
        line("Net Quantity 200 g", y=170),
    ])

    assert fields["brand_name"]["value"] == "Prov Select"
    assert fields["product_name"]["value"] == "Cashew"


def test_extracts_ingredient_block_and_nutrition_rows():
    fields = extract_declarations([
        line("Ingredients: Cashew, edible vegetable oil,", y=10),
        line("iodised salt and spices", y=35),
        line("Nutritional Information", y=80),
        line("Energy 482 kcal", y=105),
        line("Protein 3.30 g", y=130),
        line("Total Fat 50.01 g", y=155),
        line("MRP Rs. 120", y=210),
    ])

    assert "Cashew" in fields["ingredients"]["value"]
    assert "iodised salt" in fields["ingredients"]["value"]
    assert "Energy 482 kcal" in fields["nutrition_information"]["value"]
    assert "Protein 3.30 g" in fields["nutrition_information"]["value"]


def test_allergen_warning_is_never_promoted_to_brand():
    fields = extract_declarations([
        {**line("ALLERGENS: CONTAINS TRACES OF OTHER NUTS", confidence=.98, y=10), "bbox": [10, 10, 700, 70]},
        {**line("CASHEW", confidence=.96, y=90), "bbox": [80, 90, 520, 155]},
    ])

    assert fields.get("brand_name", {}).get("value") != "Allergens: Contains Traces Of Other Nuts"


def test_semantic_consistency_rejects_impossible_unit_price_digit_join():
    fields = extract_declarations([
        line("MRP ₹2288", confidence=.9, y=10),
        line("Unit sale price ₹2607488 per g", confidence=.95, y=40),
    ])

    assert fields["mrp"]["confidence"] < .8
    assert "unit_sale_price" not in fields


def test_dot_matrix_date_parser_accepts_common_non_iso_formats():
    assert _date("20 JUL 2026")[0] == "20/07/2026"
    assert _date("200726")[0] == "20/07/2026"
    assert _looks_like_partial_date("16-01-202")


def test_dot_matrix_field_validation_rejects_neighbouring_row_types():
    assert not _is_plausible_row_value("mrp", "AN2607488")
    assert not _is_plausible_row_value("unit_sale_price", "20-07-2026")
    assert _is_plausible_row_value("batch_number", "AN2607488")
    assert _is_plausible_row_value("manufacture_pack_import_date", "20 JUL 2026")


def test_dynamic_value_lanes_preserve_printed_row_order():
    anchors = {
        "mrp": ((10, 100, 60, 120), 0.0, "MRP"),
        "manufacture_pack_import_date": ((10, 140, 90, 160), 0.0, "Packed On"),
        "best_before_or_use_by": ((10, 180, 90, 200), 0.0, "Use By"),
    }
    lanes = _value_lanes(
        anchors,
        {
            "mrp": -8,
            "manufacture_pack_import_date": -28,
            "best_before_or_use_by": -35,
        },
        global_shift=-20,
        typical_height=20,
        image_height=300,
    )

    assert lanes["mrp"][2] <= lanes["manufacture_pack_import_date"][1]
    assert lanes["manufacture_pack_import_date"][2] <= lanes["best_before_or_use_by"][1]
    assert lanes["manufacture_pack_import_date"][0] < lanes["manufacture_pack_import_date"][1] < lanes["manufacture_pack_import_date"][2]


def test_nutrition_quantity_is_not_promoted_to_package_net_quantity():
    def box(text, x, y, width=140, height=22):
        return {"text": text, "confidence": .96, "image_id": "BACK", "bbox": [x, y, x + width, y + height]}

    fields = extract_declarations([
        box("Total Carbohydrate", 20, 20, 180),
        box("15.3 g", 220, 20, 70),
        box("Protein", 20, 50, 100),
        box("1.9 g", 220, 50, 60),
    ])

    assert "net_quantity" not in fields
    assert "15.3 g" in fields["nutrition_information"]["value"]


def test_batch_number_is_not_taken_from_explanatory_prose():
    fields = extract_declarations([
        line("Please scan the first character of batch no. and scan the 1000"),
    ])

    assert "batch_number" not in fields


def test_unit_price_can_be_reviewably_derived_for_one_base_unit():
    fields = extract_declarations([
        line("NET QUANTITY: 1 L", y=10),
        line("MRP ₹220.00 inclusive of all taxes", y=40),
        line("UNIT SALE PRICE ₹:", y=70),
    ])

    assert fields["unit_sale_price"]["value"] == "₹220.00 per L"
    assert fields["unit_sale_price"]["confidence"] < .7
    assert "Calculated" in fields["unit_sale_price"]["inference"]


def test_responsible_party_address_collects_split_postal_block():
    def box(text, x, y, width=260, height=24, confidence=.96):
        return {"text": text, "confidence": confidence, "image_id": "BACK", "bbox": [x, y, x + width, y + height]}

    fields = extract_declarations([
        box("Manufactured by:", 20, 20, 180),
        box("Example Processed Foods Pvt. Ltd.", 220, 20, 360),
        box("Khasra No. 41, Food Park", 220, 52, 310),
        box("Village Rampur, District Sonipat", 220, 82, 350),
        box("Haryana 131001", 220, 112, 220),
        box("MRP Rs. 23 inclusive of all taxes", 20, 190, 330),
    ])

    assert fields["responsible_party_name"]["value"] == "Example Processed Foods Pvt. Ltd."
    address = fields["responsible_party_address"]["value"]
    assert "Khasra No. 41" in address
    assert "District Sonipat" in address
    assert "131001" in address
    assert "MRP" not in address
    assert "Manufactured by" not in address


def test_additive_statement_is_not_promoted_to_product_or_brand():
    fields = extract_declarations([
        {**line("DARK SOYA", confidence=.98, y=10), "bbox": [20, 10, 500, 80]},
        {**line("Preservative (INS 211), permitted", confidence=.97, y=90), "bbox": [20, 90, 570, 145]},
        {**line("class II starch", confidence=.96, y=150), "bbox": [20, 150, 400, 195]},
    ])

    assert "Preservative" not in fields.get("product_name", {}).get("value", "")
    assert "Starch" not in fields.get("brand_name", {}).get("value", "")
