from io import BytesIO

from pypdf import PdfReader

from app.reports import build_bulk_report_pdf, build_report_pdf


PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="


def test_officer_pdf_is_structured_and_includes_reviewable_transcript():
    report = {
        "id": "PMX-TEST-P1", "inspectionId": "INS-TEST", "batchId": "BULK-TEST", "date": "31/08/2026, 10:30 am", "inspectorName": "Insp. Ramesh Sharma", "ruleSetAsOf": "2026-08-01",
        "status": "REVIEW", "workflowStatus": "OPEN", "verificationScore": 56,
        "counts": {"PASS": 5, "FAIL": 0, "REVIEW": 4},
        "details": {"productName": "Chocolate Desire", "productId": "8906082371231"},
        "declarations": {"responsible_party_name": "Walko Food Company Pvt. Ltd.", "net_quantity": "1 L", "mrp": "MRP ₹220 inclusive of all taxes", "barcode": "8906082371231"},
        "results": [{"rule_id": "DATE", "rule_reference": "Rule 6(1)(d)", "requirement": "Date declaration", "outcome": "REVIEW", "reason": "Confirm that the date declaration applies.", "evidence": [{"field": "manufacture_pack_import_date", "value": "07/06/2026"}]}],
        "ocrLines": [{"text": "SECRET DEBUG TRANSCRIPT LINE", "confidence": .99}], "imageCount": 2, "captureMode": "upload",
        "evidenceImages": [{"imageId": "IMG-001", "fileName": "front.png", "thumbnail": PIXEL}, {"imageId": "IMG-002", "fileName": "back.png", "thumbnail": PIXEL}],
    }
    payload = build_report_pdf(report)
    text = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(payload)).pages)
    assert "Chocolate Desire" in text
    assert "EVIDENCE VERIFICATION" in text
    assert "INS-TEST" in text and "BULK-TEST" in text and "2026-08-01" in text
    assert "₹220" in text and "■220" not in text
    assert "AI screening result" in text and "Final officer determination" in text
    assert "Legal reference" in text
    assert "Complete extracted text" in text
    assert "SECRET DEBUG TRANSCRIPT LINE" in text
    assert "2 uploaded package surface image(s) retained for this product" in text


def test_live_report_omits_submitted_evidence_gallery():
    report = {
        "id": "LIVE-TEST", "date": "now", "status": "REVIEW", "captureMode": "live",
        "details": {"productName": "Live product"}, "declarations": {}, "results": [],
        "imageCount": 12, "thumbnail": PIXEL,
        "evidenceImages": [{"imageId": "LIVE-001", "thumbnail": PIXEL}],
    }
    payload = build_report_pdf(report)
    text = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(payload)).pages)
    assert "Submitted evidence" not in text


def test_bulk_pdf_keeps_two_products_distinct():
    first = {"id": "P1", "date": "now", "details": {"productName": "Chocolate Desire", "productId": "11111111"}, "declarations": {"barcode": "11111111", "mrp": "MRP 220"}, "counts": {}, "results": []}
    second = {"id": "P2", "date": "now", "details": {"productName": "Salt Crackers", "productId": "22222222"}, "declarations": {"barcode": "22222222", "mrp": "MRP 80"}, "counts": {}, "results": []}
    payload = build_bulk_report_pdf({"id": "BATCH-TEST", "reports": [first, second]})
    text = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(payload)).pages)
    assert "Chocolate Desire" in text and "11111111" in text
    assert "Salt Crackers" in text and "22222222" in text
    assert text.index("Chocolate Desire") < text.index("Salt Crackers")
