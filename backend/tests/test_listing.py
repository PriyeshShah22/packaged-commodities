"""Inventory screening regression tests; fixtures are not application seed data."""
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader

from app.listing import parse_inventory
from app.main import app
from app.reports import build_report_pdf, build_bulk_report_pdf


@pytest.mark.parametrize('price', ['MRP ₹369.00', 'Rs. 369.00', 'MRP 369/-', '₹ 369'])
def test_normalization_and_original_evidence(price):
    row = parse_inventory(f'Product Name,MRP,Pack Size,Packed On,Use By,Batch\nDates,{price},500 g,FEB-2026,AUG-2026,E-UN26-1265'.encode())['rows'][0]
    assert row['declarations']['mrp'].startswith('MRP ₹369')
    assert row['fields']['mrp']['raw_text'] == price
    assert row['declarations']['manufacture_pack_import_date'] == '02/2026'
    assert row['declarations']['best_before_or_use_by'] == '08/2026'
    assert row['declarations']['net_quantity'] == '500 g'
    assert row['declarations']['batch_number'] == 'E-UN26-1265'


def test_rows_are_isolated_and_missing_values_not_invented():
    rows = parse_inventory(b'Product Name,MRP,Manufacturer,Barcode\nFirst,23,Maker,012345678905\nSecond,,,')['rows']
    assert rows[0]['declarations']['barcode'] == '012345678905'
    assert rows[1]['declarations'] == {}
    assert rows[0]['raw']['MRP'] == '23'


@pytest.mark.parametrize('value', ['31/02/2026', '2026-13-01', 'not supplied', 'junk 07/06/2026 trailing', '12 months from packing'])
def test_invalid_dates_are_preserved_but_not_trusted(value):
    row = parse_inventory(f'Product Name,Mfg Date\nItem,{value}'.encode())['rows'][0]
    assert row['warnings']
    assert row['fields']['manufacture_pack_import_date']['confidence'] < .5
    assert row['declarations']['manufacture_pack_import_date'] == value


def test_date_consistency_and_zero_quantity_require_review_not_violations():
    row = parse_inventory(b'Product Name,Mfg Date,Use By,Net Quantity\nItem,01/01/2090,01/01/2001,0 g')['rows'][0]
    assert len(row['reviewFindings']) == 4
    assert all(item['outcome'] == 'REVIEW' for item in row['reviewFindings'])
    assert any('precedes' in item['reason'] for item in row['reviewFindings'])
    assert row['declarations']['net_quantity'] == '0 g'


def test_relative_best_before_is_retained_without_guessing_expiry():
    row = parse_inventory(b'Product Name,Best Before\nItem,12 months from packing')['rows'][0]
    assert row['declarations']['best_before_or_use_by'] == '12 months from packing'
    assert not row['reviewFindings']


@pytest.mark.parametrize('content', [b'', b'MRP\n23', b'Product Name,MRP\n', b'Product Name,MRP\nA,23,extra', b'Product Name,MRP\n,23', b'Product Name,MRP,Maximum Retail Price\nA,23,24'])
def test_rejects_bad_files(content):
    with pytest.raises(ValueError):
        parse_inventory(content)


def test_limits_and_encoding():
    with pytest.raises(ValueError):
        parse_inventory(b'Product Name\n' + b'Item\n' * 51)
    with pytest.raises(ValueError):
        parse_inventory(b'x' * (2 * 1024 * 1024 + 1))
    with pytest.raises(ValueError):
        parse_inventory(b'Product Name\n\xff')
    assert parse_inventory('\ufeffProduct Name;MRP\nItem;23'.encode())['rows'][0]['name'] == 'Item'


def test_authenticated_import_validation_and_pdfs():
    with TestClient(app) as client:
        files = {'file': ('inventory.csv', b'Product Name,MRP,Net Quantity\nProduct one,23,100 g\nProduct two,,', 'text/csv')}
        assert client.post('/api/v1/listing/import', files=files).status_code == 401
        login = client.post('/api/v1/auth/login', json={'email': 'officer.sharma@consumeraffairs.gov.in', 'password': 'LegalMetrology2026!'})
        headers = {'Authorization': f"Bearer {login.json()['access_token']}"}
        imported = client.post('/api/v1/listing/import', files=files, headers=headers)
        assert imported.status_code == 200
        reports = []
        for row in imported.json()['rows']:
            result = client.post('/api/v1/validations/evaluate', json={'context': {'inspection_mode': 'physical_package', 'package_context': 'retail_prepackaged'}, 'evidence': list(row['fields'].values()), 'field_coverage': {}, 'image_quality': []}, headers=headers)
            assert result.status_code == 200, result.text
            data = result.json()
            assert data['counts']['FAIL'] == 0
            assert data['counts']['REVIEW'] > 0
            reports.append({'id': str(row['rowNumber']), 'captureMode': 'listing', 'listingSource': {'fileName': 'inventory.csv', 'rowNumber': row['rowNumber']}, 'details': {'productName': row['name']}, 'declarations': row['declarations'], 'results': data['results'], 'counts': data['counts'], 'status': 'REVIEW'})
        for payload in [build_report_pdf(reports[0]), build_bulk_report_pdf({'id': 'LIST-TEST', 'mode': 'listing', 'reports': reports})]:
            text = '\n'.join(page.extract_text() for page in PdfReader(BytesIO(payload)).pages)
            assert 'Product one' in text
            assert 'inventory' in text.lower()
            assert 'Complete extracted text' not in text
            assert 'OCR Transcript' not in text
            assert 'photographic package evidence' not in text
        viewer = client.post('/api/v1/auth/login', json={'email': 'viewer@packmetrix.local', 'password': 'LegalMetrology2026!'})
        assert client.post('/api/v1/listing/import', files=files, headers={'Authorization': f"Bearer {viewer.json()['access_token']}"}).status_code == 403
