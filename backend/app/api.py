from datetime import date

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.legal_rules.applicability import evaluate_applicability
from app.legal_rules.rule_loader import active_rules
from app.legal_rules.rule_validator import validate_rules
from app.ocr.extractor import extract_declarations
from app.ocr.service import run_ocr
from app.reports import build_bulk_report_pdf, build_report_pdf
from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.dependencies import current_user, require_roles
from app.models import Role, User
from app.schemas import InspectionContext, LoginRequest, SignupRequest, ValidationRequest


router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 15 * 1024 * 1024


def user_payload(user: User) -> dict:
    return {"id": user.id, "email": user.email, "name": user.full_name, "organization": user.organization, "roles": [role.name for role in user.roles]}


@router.post("/auth/login")
def login(payload: LoginRequest, database: Session = Depends(get_db)):
    user = database.scalar(select(User).where(User.email == payload.email.strip().lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return {"access_token": create_access_token(user.id), "token_type": "bearer", "user": user_payload(user)}


@router.post("/auth/signup", status_code=201)
def signup(payload: SignupRequest, database: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if database.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account already exists for this email.")
    viewer = database.scalar(select(Role).where(Role.name == "viewer"))
    if not viewer:
        raise HTTPException(status_code=503, detail="Role registry has not been initialized.")
    user = User(email=email, full_name=payload.name.strip(), organization=payload.organization.strip(), password_hash=hash_password(payload.password), roles=[viewer])
    database.add(user)
    database.commit()
    database.refresh(user)
    return {"access_token": create_access_token(user.id), "token_type": "bearer", "user": user_payload(user)}


@router.get("/auth/me")
def me(user: User = Depends(current_user)):
    return user_payload(user)


@router.get("/legal-rules")
def list_legal_rules(as_of: date = Query(default_factory=date.today), _: User = Depends(require_roles("viewer", "inspector", "admin"))):
    rules = active_rules(as_of)
    return {"as_of": as_of, "count": len(rules), "rules": rules}


@router.post("/applicability/evaluate")
def evaluate_rules(context: InspectionContext, _: User = Depends(require_roles("inspector", "admin"))):
    rules = active_rules(context.inspection_date)
    return {
        "as_of": context.inspection_date,
        "results": [
            {
                "rule_id": rule["rule_id"],
                "rule_version": rule["version"],
                "rule_reference": rule["rule_reference"],
                "requirement": rule["requirement"],
                "result": evaluate_applicability(rule, context).state,
                "reasons": evaluate_applicability(rule, context).reasons,
            }
            for rule in rules
        ],
    }


@router.post("/validations/evaluate")
def evaluate_validation(payload: ValidationRequest, _: User = Depends(require_roles("inspector", "admin"))):
    as_of = payload.as_of or payload.context.inspection_date
    results = validate_rules(active_rules(as_of), payload)
    counts = {state: sum(result["outcome"] == state for result in results) for state in ("PASS", "FAIL", "REVIEW", "NOT_APPLICABLE")}
    return {"as_of": as_of, "counts": counts, "results": results}


@router.post("/ocr/extract")
def extract_image_declarations(files: list[UploadFile] = File(...), _: User = Depends(require_roles("inspector", "admin"))):
    if not files or len(files) > 12:
        raise HTTPException(status_code=400, detail="Upload between 1 and 12 package images.")

    all_lines = []
    image_results = []
    for index, uploaded in enumerate(files):
        if uploaded.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=415, detail=f"Unsupported image type: {uploaded.content_type}")
        content = uploaded.file.read(MAX_IMAGE_BYTES + 1)
        if len(content) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail=f"{uploaded.filename} exceeds the 15 MB image limit.")
        image_id = f"IMG-{index + 1:03d}"
        try:
            lines, quality = run_ocr(content, image_id)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=f"{uploaded.filename}: {error}") from error
        all_lines.extend(lines)
        image_results.append({"image_id": image_id, "file_name": uploaded.filename, "quality": quality, "line_count": len(lines), "lines": lines})

    return {
        "engine": "RapidOCR PP-OCRv6 / ONNX Runtime",
        "images": image_results,
        "total_lines": len(all_lines),
        "fields": extract_declarations(all_lines),
    }


@router.post("/reports/pdf")
def report_pdf(report: dict = Body(...), _: User = Depends(require_roles("viewer", "inspector", "admin"))):
    report_id = str(report.get("id") or "compliance-report").replace("/", "-").replace("\\", "-")
    payload = build_bulk_report_pdf(report) if report.get("reports") else build_report_pdf(report)
    return Response(payload, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="PackMetrix-{report_id}.pdf"'})
