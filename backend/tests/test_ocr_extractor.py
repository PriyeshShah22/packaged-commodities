from app.ocr.extractor import extract_declarations
from app.ocr.dot_matrix import _date, _normalize


def line(text, confidence=0.95, image_id="IMG-001", y=0):
    return {"text": text, "confidence": confidence, "image_id": image_id, "bbox": [10, y, 400, y + 20]}


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
    assert fields["manufacture_pack_import_date"]["value"] == "17/08/26"
    assert fields["best_before_or_use_by"]["value"] == "16/10/26"
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
