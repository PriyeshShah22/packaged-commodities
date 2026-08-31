from threading import local
from typing import Any

import cv2
import numpy as np
from rapidocr import RapidOCR

from app.ocr.dot_matrix import extract_dot_matrix_lines


_engine_state = local()
LEGAL_SIGNAL = ("net", "mrp", "mfg", "mfd", "batch", "fssai", "consumer", "manufactured", "marketed", "use by", "exp")


def get_ocr_engine() -> RapidOCR:
    """Return one engine per worker thread so independent panels can run safely."""
    if not getattr(_engine_state, "engine", None):
        _engine_state.engine = RapidOCR(params={"Global.text_score": 0.45, "Global.max_side_len": 2400})
    return _engine_state.engine


def _result_score(result) -> float:
    if result.txts is None:
        return 0
    score = 0.0
    for text, confidence in zip(result.txts, result.scores, strict=False):
        value = str(text).lower()
        score += float(confidence)
        score += sum(signal in value for signal in LEGAL_SIGNAL) * 4
        score += min(2, sum(character.isdigit() for character in value) / 5)
    return score


def _needs_enhanced_pass(result) -> bool:
    """Use a costly second pass only when the first pass is genuinely weak."""
    if result.txts is None or result.scores is None:
        return True
    texts = [str(text).strip() for text in result.txts if str(text).strip()]
    scores = [float(score) for score in result.scores]
    if len(texts) < 5:
        return True
    average = sum(scores) / max(1, len(scores))
    return average < 0.72


def run_ocr(image_bytes: bytes, image_id: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("The uploaded file could not be decoded as an image.")

    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur_variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    quality = {
        "width": width,
        "height": height,
        "blur_variance": round(blur_variance, 2),
        "resolution_sufficient": width >= 800 and height >= 600,
        "blur_status": "low" if blur_variance >= 100 else "moderate" if blur_variance >= 45 else "high",
    }

    engine = get_ocr_engine()
    result = engine(image, use_det=True, use_cls=True, use_rec=True)

    # Phone photographs frequently arrive with the package panel sideways.
    # A strong majority of tall detected text boxes is a reliable indication
    # that the whole frame, rather than individual text, needs rotation.
    rotation = 0
    if result.boxes is not None and len(result.boxes):
        tall = 0
        for box in result.boxes:
            xs = [float(point[0]) for point in box]
            ys = [float(point[1]) for point in box]
            if max(ys) - min(ys) > (max(xs) - min(xs)) * 1.35:
                tall += 1
        if tall / len(result.boxes) >= 0.55:
            counter_clockwise = cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE)
            rotated_result = engine(counter_clockwise, use_det=True, use_cls=True, use_rec=True)
            original_count = len(result.txts) if result.txts is not None else 0
            if rotated_result.txts is not None and len(rotated_result.txts) >= original_count * 0.75:
                image = counter_clockwise
                result = rotated_result
                rotation = 270
    quality["auto_rotation_degrees"] = rotation

    # Keep the naturally oriented pixels for the dot-matrix pass. Cubic
    # upscaling helps ordinary small print but can merge the separated dots
    # in inkjet-stamped dates into misleading solid glyphs.
    dot_matrix_image = image
    dot_matrix_result = result

    # Small phone frames are upscaled and gently sharpened only when the first
    # pass is weak, avoiding a routine second full-model invocation.
    quality["enhanced_for_small_text"] = False
    if min(image.shape[:2]) < 900 and _needs_enhanced_pass(result):
        scale = min(1.7, 1200 / min(image.shape[:2]))
        enhanced = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        blurred = cv2.GaussianBlur(enhanced, (0, 0), 1.1)
        enhanced = cv2.addWeighted(enhanced, 1.45, blurred, -0.45, 0)
        enhanced_result = engine(enhanced, use_det=True, use_cls=True, use_rec=True)
        if _result_score(enhanced_result) >= _result_score(result):
            image = enhanced
            result = enhanced_result
            quality["enhanced_for_small_text"] = True

    dot_matrix_lines = extract_dot_matrix_lines(dot_matrix_image, dot_matrix_result, image_id, engine)

    lines: list[dict[str, Any]] = []
    if result.boxes is None or result.txts is None or result.scores is None:
        return lines, quality

    for box, text, confidence in zip(result.boxes, result.txts, result.scores, strict=False):
        x_values = [float(point[0]) for point in box]
        y_values = [float(point[1]) for point in box]
        lines.append({
            "text": str(text),
            "confidence": round(float(confidence), 4),
            "bbox": [min(x_values), min(y_values), max(x_values), max(y_values)],
            "image_id": image_id,
        })
    lines.extend(dot_matrix_lines)
    quality["dot_matrix_fields_detected"] = len(dot_matrix_lines)
    return lines, quality
