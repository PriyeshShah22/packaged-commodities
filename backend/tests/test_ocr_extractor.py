from types import SimpleNamespace

import cv2
import numpy as np

from app.ocr.extractor import extract_declarations
from app.api import _grouping_tokens, _token_similarity
from app.ocr.dot_matrix import _date, _normalize
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
    monkeypatch.setattr(service, "extract_dot_matrix_lines", lambda *args: dot_calls.append(True) or [])
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


def test_repairs_common_dot_matrix_price_date_and_batch_confusions():
    assert _normalize("mrp", "Bs:220:00")[0] == "MRP ₹220.00 inclusive of all taxes"
    assert _normalize("unit_sale_price", "ES:220FER LT")[0] == "Unit sale price ₹220 per L"
    assert _normalize("batch_number", "2O7F26")[0] == "Batch No S07F26"
    assert _date("97/0672026")[0] == "07/06/2026"
    assert _date("97/06/2026")[0] == "07/06/2026"


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
