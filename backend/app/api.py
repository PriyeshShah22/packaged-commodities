from datetime import date
from concurrent.futures import ThreadPoolExecutor
import re
from time import perf_counter

import cv2
import numpy as np

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
MAX_OCR_WORKERS = 3
OCR_EXECUTOR = ThreadPoolExecutor(max_workers=MAX_OCR_WORKERS, thread_name_prefix="packmetrix-ocr")


def _image_hash(content: bytes) -> str:
    image = cv2.imdecode(np.frombuffer(content, np.uint8), cv2.IMREAD_GRAYSCALE)
    if image is None:
        return ""
    small = cv2.resize(image, (9, 8), interpolation=cv2.INTER_AREA)
    return "".join("1" if value else "0" for value in (small[:, 1:] > small[:, :-1]).flatten())


def _color_signature(content: bytes) -> list[float]:
    image = cv2.imdecode(np.frombuffer(content, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        return []
    hsv = cv2.cvtColor(cv2.resize(image, (160, 160), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2HSV)
    histogram = cv2.calcHist([hsv], [0, 1], None, [16, 4], [0, 180, 0, 256]).flatten()
    norm = float(np.linalg.norm(histogram)) or 1.0
    return [round(float(value / norm), 5) for value in histogram]


def _field_value(fields: dict, name: str) -> str:
    return str((fields.get(name) or {}).get("value") or "").strip()


def _tokens(value: str) -> set[str]:
    ignored = {"the", "and", "food", "foods", "private", "pvt", "ltd", "limited", "india"}
    return {token for token in re.findall(r"[a-z0-9]+", value.lower()) if len(token) > 2 and token not in ignored}


def _grouping_tokens(lines: list[dict], fields: dict) -> set[str]:
    """Identity hints used only for grouping, never as the displayed product name."""
    result = _tokens(" ".join((_field_value(fields, "product_name"), _field_value(fields, "commodity_name"))))
    rejected = re.compile(r"\b(?:mrp|net|batch|date|fssai|licen[cs]e|manufactured|marketed|packed|address|consumer|customer|nutrition|ingredients?|calories|protein|quantity|price)\b", re.I)
    for line in lines:
        text = str(line.get("text") or "").strip()
        confidence = float(line.get("confidence") or 0)
        if confidence < .70 or rejected.search(text) or sum(character.isdigit() for character in text) > 3:
            continue
        result.update(_tokens(text))
        for domain in re.findall(r"(?:www\.)?([a-z][a-z0-9-]{3,})\.(?:in|com|co\.in|net|org)\b", text, re.I):
            result.add(domain.lower())
    return result


def _token_similarity(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    exact = len(left & right) / max(1, len(left | right))
    fuzzy_matches = sum(any(a in b or b in a for b in right) for a in left if len(a) >= 5)
    return max(exact, fuzzy_matches / max(1, min(len(left), len(right))))


def _hash_distance(left: str, right: str) -> int:
    return sum(a != b for a, b in zip(left, right, strict=False)) if left and right else 64


def _color_similarity(left: list[float], right: list[float]) -> float:
    return float(np.dot(left, right)) if left and right else 0.0


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
def extract_image_declarations(
    files: list[UploadFile] = File(...),
    live: bool = Query(False),
    _: User = Depends(require_roles("inspector", "admin")),
):
    request_started = perf_counter()
    if not files or len(files) > 12:
        raise HTTPException(status_code=400, detail="Upload between 1 and 12 package images.")

    uploads = []
    for index, uploaded in enumerate(files):
        if uploaded.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=415, detail=f"Unsupported image type: {uploaded.content_type}")
        content = uploaded.file.read(MAX_IMAGE_BYTES + 1)
        if len(content) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail=f"{uploaded.filename} exceeds the 15 MB image limit.")
        uploads.append((index, uploaded.filename, content))

    def process(item):
        index, filename, content = item
        image_id = f"IMG-{index + 1:03d}"
        try:
            lines, quality = run_ocr(content, image_id, live=live)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=f"{filename}: {error}") from error
        return {"image_id": image_id, "file_name": filename, "quality": quality, "line_count": len(lines), "lines": lines}

    # Keep concurrency bounded while allowing front/back/side panels to overlap.
    # Reuse bounded worker threads so their thread-local ONNX engines stay warm
    # across Live OCR requests. Creating a pool here used to reload all models
    # for each accepted camera frame.
    image_results = list(OCR_EXECUTOR.map(process, uploads))
    all_lines = [line for image in image_results for line in image["lines"]]
    extraction_started = perf_counter()
    fields = extract_declarations(all_lines)
    extraction_ms = round((perf_counter() - extraction_started) * 1000, 1)

    return {
        "engine": "RapidOCR PP-OCRv6 / ONNX Runtime",
        "images": image_results,
        "total_lines": len(all_lines),
        "fields": fields,
        "timing": {
            "ocr_ms": round(sum(image["quality"].get("timing_ms", {}).get("total", 0) for image in image_results), 1),
            "structured_extraction_ms": extraction_ms,
            "request_total_ms": round((perf_counter() - request_started) * 1000, 1),
        },
    }


@router.post("/ocr/bulk-group")
def bulk_group_images(files: list[UploadFile] = File(...), _: User = Depends(require_roles("inspector", "admin"))):
    if not files or len(files) > 60:
        raise HTTPException(status_code=400, detail="Upload between 1 and 60 package images for bulk grouping.")
    uploads = []
    for index, uploaded in enumerate(files):
        if uploaded.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=415, detail=f"Unsupported image type: {uploaded.content_type}")
        content = uploaded.file.read(MAX_IMAGE_BYTES + 1)
        if len(content) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail=f"{uploaded.filename} exceeds the 15 MB image limit.")
        uploads.append((index, uploaded.filename, content))

    def process(item):
        index, filename, content = item
        image_id = f"BULK-{index + 1:03d}"
        lines, quality = run_ocr(content, image_id)
        fields = extract_declarations(lines)
        return {"index": index, "image_id": image_id, "file_name": filename, "quality": quality, "lines": lines, "fields": fields, "grouping_tokens": _grouping_tokens(lines, fields), "visual_hash": _image_hash(content), "color_signature": _color_signature(content)}

    images = list(OCR_EXECUTOR.map(process, uploads))

    groups: list[dict] = []
    for image in images:
        barcode = _field_value(image["fields"], "barcode")
        identity = _tokens(" ".join((_field_value(image["fields"], "product_name"), _field_value(image["fields"], "commodity_name"))))
        grouping_identity = image["grouping_tokens"]
        party = _tokens(_field_value(image["fields"], "responsible_party_name"))
        best = None
        for group in groups:
            same_barcode = bool(barcode and barcode in group["barcodes"])
            identity_overlap = len(identity & group["identity_tokens"]) / max(1, len(identity | group["identity_tokens"]))
            grouping_overlap = _token_similarity(grouping_identity, group["grouping_tokens"])
            party_overlap = bool(party and party & group["party_tokens"])
            visually_close = any(_hash_distance(image["visual_hash"], value) <= 8 for value in group["hashes"])
            color_similarity = max((_color_similarity(image["color_signature"], value) for value in group["colors"]), default=0)
            appearance_identity = (visually_close or color_similarity >= .68) and (identity_overlap >= .25 or grouping_overlap >= .20 or party_overlap)
            exceptionally_similar = color_similarity >= .97
            score = 1.0 if same_barcode else .86 if identity_overlap >= .6 or grouping_overlap >= .45 else .78 if appearance_identity else .76 if exceptionally_similar else 0
            if score and (best is None or score > best[0]):
                best = (score, group, "Barcode / GTIN match" if same_barcode else "Product text match" if identity_overlap >= .6 else "Visual and label identity match")
        if best:
            score, group, reason = best
            group["images"].append(image); group["confidence"] = min(group["confidence"], score); group["reason"] = reason
            group["barcodes"].add(barcode); group["identity_tokens"].update(identity); group["grouping_tokens"].update(grouping_identity); group["party_tokens"].update(party); group["hashes"].append(image["visual_hash"]); group["colors"].append(image["color_signature"])
        else:
            groups.append({"id": f"GROUP-{len(groups) + 1:03d}", "images": [image], "confidence": 1.0 if barcode else .65 if identity else .45, "reason": "Barcode-backed product identity" if barcode else "Single-view identity needs confirmation", "barcodes": {barcode}, "identity_tokens": set(identity), "grouping_tokens": set(grouping_identity), "party_tokens": set(party), "hashes": [image["visual_hash"]], "colors": [image["color_signature"]]})

    response_groups = []
    for group in groups:
        lines = [line for image in group["images"] for line in image["lines"]]
        fields = extract_declarations(lines)
        product = fields.get("product_name") or {}; commodity = fields.get("commodity_name") or {}
        name = str(product.get("value") or "") if float(product.get("confidence") or 0) >= .75 else str(commodity.get("value") or "") if float(commodity.get("confidence") or 0) >= .8 else ""
        name = name or "Unidentified product"
        needs_confirmation = group["confidence"] < .75 or (len(group["images"]) == 1 and name == "Unidentified product")
        response_groups.append({"id": group["id"], "name": name, "confidence": group["confidence"], "needs_confirmation": needs_confirmation, "reason": group["reason"] if not needs_confirmation else "Product identity or grouping needs confirmation", "fields": fields, "images": group["images"]})
    return {"image_count": len(images), "group_count": len(response_groups), "groups": response_groups}


@router.post("/reports/pdf")
def report_pdf(report: dict = Body(...), _: User = Depends(require_roles("viewer", "inspector", "admin"))):
    report_id = str(report.get("id") or "compliance-report").replace("/", "-").replace("\\", "-")
    payload = build_bulk_report_pdf(report) if report.get("reports") else build_report_pdf(report)
    return Response(payload, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="PackMetrix-{report_id}.pdf"'})
