"""Generate QA PDFs from the user's package-evidence fixture through the live API."""
from pathlib import Path
from datetime import date
import httpx

root = Path(__file__).resolve().parents[2]
out = root / 'tmp' / 'pdfs'
out.mkdir(parents=True, exist_ok=True)
with httpx.Client(base_url='http://127.0.0.1:8000', timeout=45) as client:
    login = client.post('/api/v1/auth/login', json={'email': 'officer.sharma@consumeraffairs.gov.in', 'password': 'LegalMetrology2026!'})
    login.raise_for_status()
    client.headers['Authorization'] = f"Bearer {login.json()['access_token']}"
    imported = client.post('/api/v1/listing/import', files={'file': ('listing-package-evidence.csv', (Path(__file__).parent / 'fixtures' / 'listing-package-evidence.csv').read_bytes(), 'text/csv')})
    imported.raise_for_status()
    batch = 'LIST-335c43ac-eeda-42d8-bfb7-9859fb71062c'
    reports = []
    for row in imported.json()['rows']:
        analysis = client.post('/api/v1/validations/evaluate', json={'context': {'inspection_mode': 'physical_package', 'package_context': 'retail_prepackaged'}, 'evidence': list(row['fields'].values())})
        analysis.raise_for_status()
        report = {'id': f"PMX-{batch}-ROW-{row['rowNumber']}", 'batchId': batch, 'captureMode': 'listing', 'date': date.today().isoformat(), 'inspectorName': 'QA verification of supplied package evidence', 'listingSource': {'fileName': 'listing-package-evidence.csv', 'rowNumber': row['rowNumber']}, 'details': {'productName': row['name']}, 'declarations': row['declarations'], 'fieldEvidence': row['fields'], 'status': 'REVIEW', **analysis.json()}
        reports.append(report)
    for filename, payload in [('listing-individual.pdf', reports[0]), ('listing-summary.pdf', {'id': batch, 'mode': 'listing', 'date': date.today().isoformat(), 'inspectorName': reports[0]['inspectorName'], 'reports': reports})]:
        response = client.post('/api/v1/reports/pdf', json=payload)
        response.raise_for_status()
        assert response.content.startswith(b'%PDF')
        (out / filename).write_bytes(response.content)
        print(f'{filename}: {len(response.content)} bytes; HTTP {response.status_code}')
