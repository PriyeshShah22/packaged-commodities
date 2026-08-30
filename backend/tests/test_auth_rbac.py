from fastapi.testclient import TestClient

from app.main import app


PASSWORD = "LegalMetrology2026!"


def test_inspector_can_run_rules_and_viewer_cannot():
    with TestClient(app) as client:
        inspector = client.post("/api/v1/auth/login", json={"email": "officer.sharma@consumeraffairs.gov.in", "password": PASSWORD})
        assert inspector.status_code == 200
        inspector_token = inspector.json()["access_token"]
        assert inspector.json()["user"]["roles"] == ["inspector"]

        viewer = client.post("/api/v1/auth/login", json={"email": "viewer@packmetrix.local", "password": PASSWORD})
        viewer_token = viewer.json()["access_token"]
        context = {"inspection_mode": "physical_package", "package_context": "unknown", "product_category": "unknown", "origin": "unknown", "sales_context": "unknown"}
        assert client.post("/api/v1/applicability/evaluate", json=context, headers={"Authorization": f"Bearer {inspector_token}"}).status_code == 200
        assert client.post("/api/v1/applicability/evaluate", json=context, headers={"Authorization": f"Bearer {viewer_token}"}).status_code == 403


def test_report_pdf_requires_session_and_is_valid_pdf():
    with TestClient(app) as client:
        assert client.post("/api/v1/reports/pdf", json={"id": "TEST"}).status_code == 401
        viewer = client.post("/api/v1/auth/login", json={"email": "viewer@packmetrix.local", "password": PASSWORD}).json()
        response = client.post("/api/v1/reports/pdf", json={"id": "TEST-001", "date": "30/08/2026", "status": "REVIEW", "score": 50, "violations": [], "ocrLines": []}, headers={"Authorization": f"Bearer {viewer['access_token']}"})
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert response.content.startswith(b"%PDF")


def test_bulk_report_combines_separate_product_results():
    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={"email": "viewer@packmetrix.local", "password": PASSWORD}).json()
        report = {"id": "BATCH-001", "reports": [
            {"id": "P-1", "status": "COMPLIANT", "score": 100, "details": {"productName": "Maggie", "productId": "1"}, "declarations": {"net_quantity": "70 g"}, "violations": [], "ocrLines": []},
            {"id": "P-2", "status": "REVIEW", "score": 75, "details": {"productName": "Yellow Chips", "productId": "2"}, "declarations": {"net_quantity": "200 g"}, "violations": [], "ocrLines": []},
        ]}
        response = client.post("/api/v1/reports/pdf", json=report, headers={"Authorization": f"Bearer {login['access_token']}"})
        assert response.status_code == 200
        assert response.content.startswith(b"%PDF")
