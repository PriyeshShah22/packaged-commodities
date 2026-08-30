# PackMetrix backend

This service provides the evidence-first API behind PackMetrix: authentication and RBAC, RapidOCR extraction, declaration mapping, versioned Legal Metrology rules, deterministic validation, relational models, and PDF report generation.

## Run locally

```powershell
py -m venv .venv
.venv\Scripts\python -m pip install -e ".[dev]"
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

The default database is SQLite for local verification. Set `PACKMETRIX_DATABASE_URL` to a PostgreSQL URL in deployment.

Useful endpoints:

- `GET /health`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/ocr/extract`
- `GET /api/v1/legal-rules?as_of=2026-08-30`
- `POST /api/v1/applicability/evaluate`
- `POST /api/v1/validations/evaluate`
- `POST /api/v1/reports/pdf`

No endpoint equates “OCR did not detect a field” with legal absence. A missing field becomes `FAIL` only when field-specific image coverage is explicitly complete and all submitted image quality is sufficient; otherwise the result is `REVIEW`.

## Verify

```powershell
.venv\Scripts\python -m pytest -q
```

The OCR service automatically rotates sideways panels, compares a small-text enhancement pass, and performs targeted row recognition for faint dot-matrix price/date stickers.
