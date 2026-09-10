import hashlib
from collections import OrderedDict
from copy import deepcopy
from threading import Lock, local
from time import perf_counter
from typing import Any

import cv2
import numpy as np
from rapidocr import RapidOCR

from app.ocr.dot_matrix import extract_dot_matrix_lines


_engine_state = local()
_ocr_cache: OrderedDict[str, tuple[list[dict[str, Any]], dict[str, Any]]] = OrderedDict()
_ocr_cache_lock = Lock()
_OCR_CACHE_LIMIT = 64
LEGAL_SIGNAL = ("net", "mrp", "mfg", "mfd", "batch", "fssai", "consumer", "manufactured", "marketed", "use by", "exp")


def get_ocr_engine() -> RapidOCR:
    """Return one engine per worker thread so independent panels can run safely."""
    if not getattr(_engine_state, "engine", None):
        _engine_state.engine = RapidOCR(params={
            "Global.text_score": 0.45,
            "Global.max_side_len": 2400,
            # Let ONNX reuse its CPU arena and avoid oversubscribing every one
            # of the host's logical cores for small recognition crops.
            "EngineConfig.onnxruntime.intra_op_num_threads": 6,
            "EngineConfig.onnxruntime.inter_op_num_threads": 1,
            "EngineConfig.onnxruntime.enable_cpu_mem_arena": True,
        })
    return _engine_state.engine


def warm_ocr_engine() -> None:
    """Initialize models and realistic dynamic tensor shapes before live traffic."""
    canvas = np.full((720, 1200, 3), 255, dtype=np.uint8)
    warm_lines = (
        "PACKAGED COMMODITY DECLARATION",
        "NET QUANTITY 500 g",
        "MRP Rs. 220.00 INCLUSIVE OF ALL TAXES",
        "UNIT SALE PRICE Rs. 0.44 PER g",
        "BATCH A123  MFG 07/2026  USE BY 06/2027",
        "MANUFACTURED BY SAMPLE FOODS PRIVATE LIMITED",
        "CONSUMER CARE 9876543210 care@example.com",
    )
    for index, value in enumerate(warm_lines):
        cv2.putText(canvas, value, (30, 80 + index * 82), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 0), 2, cv2.LINE_AA)
    get_ocr_engine()(canvas, use_det=True, use_cls=True, use_rec=True)


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


def _tall_box_ratio(result) -> float:
    """Return how strongly OCR geometry indicates a sideways package panel."""
    if result.boxes is None or not len(result.boxes):
        return 0.0
    tall = 0
    for box in result.boxes:
        xs = [float(point[0]) for point in box]
        ys = [float(point[1]) for point in box]
        if max(ys) - min(ys) > (max(xs) - min(xs)) * 1.35:
            tall += 1
    return tall / len(result.boxes)


def run_ocr(image_bytes: bytes, image_id: str, *, live: bool = False) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    started = perf_counter()
    digest = hashlib.sha256(image_bytes).hexdigest()
    cache_key = f"{'live' if live else 'full'}:{digest}"
    with _ocr_cache_lock:
        cached = _ocr_cache.get(cache_key)
        if cached:
            _ocr_cache.move_to_end(cache_key)
            cached_lines, cached_quality = deepcopy(cached)
            for line in cached_lines:
                line["image_id"] = image_id
            cached_quality["ocr_cache_hit"] = True
            cached_quality["timing_ms"] = {"total": round((perf_counter() - started) * 1000, 1), "cache": True}
            return cached_lines, cached_quality

    decode_started = perf_counter()
    array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("The uploaded file could not be decoded as an image.")

    source_image = image
    height, width = image.shape[:2]
    # Live capture is progressive: use a bounded, high-enough resolution for the
    # first response instead of making an inspector wait for every expensive
    # evidence enhancement. Uploaded evidence continues through the full path.
    if live and max(height, width) > 1200:
        # This is the fast whole-frame pass. Faint stamp rows are read from the
        # untouched source below, so increasing this further only delays live
        # feedback without reliably improving dot-matrix digits.
        scale = 1200 / max(height, width)
        image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur_variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    quality = {
        "width": width,
        "height": height,
        "blur_variance": round(blur_variance, 2),
        "resolution_sufficient": width >= 800 and height >= 600,
        "blur_status": "low" if blur_variance >= 100 else "moderate" if blur_variance >= 45 else "high",
        "timing_ms": {"decode_and_quality": round((perf_counter() - decode_started) * 1000, 1)},
    }

    # Camera panels are frequently held sideways while the device remains in
    # portrait orientation. Try that likely orientation first in live mode. If
    # it is wrong, the box-orientation check below falls back to the untouched
    # frame and compares recognition quality before accepting it.
    original_orientation = image
    pre_rotated_live = live and image.shape[0] > image.shape[1] * 1.35
    if pre_rotated_live:
        image = cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE)

    engine = get_ocr_engine()
    primary_started = perf_counter()
    result = engine(image, use_det=True, use_cls=True, use_rec=True)
    quality["timing_ms"]["primary_ocr"] = round((perf_counter() - primary_started) * 1000, 1)

    # Phone photographs frequently arrive with the package panel sideways.
    # A strong majority of tall detected text boxes is a reliable indication
    # that the whole frame, rather than individual text, needs rotation.
    rotation = 270 if pre_rotated_live else 0
    orientation_started = perf_counter()
    if result.boxes is not None and len(result.boxes):
        original_tall_ratio = _tall_box_ratio(result)
        if original_tall_ratio >= 0.55:
            alternative = original_orientation if pre_rotated_live else cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE)
            alternative_result = engine(alternative, use_det=True, use_cls=True, use_rec=True)
            alternative_score = _result_score(alternative_result)
            original_score = _result_score(result)
            # The recognizer can rotate individual word crops and achieve a
            # deceptively high text score while leaving every bounding box
            # sideways. Prefer coherent whole-panel geometry when it retains
            # most of the textual evidence; targeted label/value alignment
            # depends on those coordinates sharing one reading direction.
            geometry_repaired = (
                _tall_box_ratio(alternative_result) <= original_tall_ratio * 0.35
                and alternative_score >= original_score * 0.72
            )
            if alternative_score >= original_score or geometry_repaired:
                image = alternative
                result = alternative_result
                rotation = 0 if pre_rotated_live else 270
    quality["timing_ms"]["orientation_fallback"] = round((perf_counter() - orientation_started) * 1000, 1)
    quality["auto_rotation_degrees"] = rotation

    # Keep the naturally oriented pixels for the dot-matrix pass. Cubic
    # upscaling helps ordinary small print but can merge the separated dots
    # in inkjet-stamped dates into misleading solid glyphs.
    # Preserve original camera pixels for faint dot-matrix characters. The
    # normal live pass stays bounded at 1200 px for speed; only the small price
    # sticker crop is read from the high-resolution source below.
    dot_matrix_image = cv2.rotate(source_image, cv2.ROTATE_90_COUNTERCLOCKWISE) if rotation == 270 else source_image
    dot_matrix_result = result
    coordinate_scale = dot_matrix_image.shape[1] / max(1, image.shape[1])

    # Small phone frames are upscaled and gently sharpened only when the first
    # pass is weak, avoiding a routine second full-model invocation.
    quality["enhanced_for_small_text"] = False
    if not live and min(image.shape[:2]) < 900 and _needs_enhanced_pass(result):
        scale = min(1.7, 1200 / min(image.shape[:2]))
        enhanced = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        blurred = cv2.GaussianBlur(enhanced, (0, 0), 1.1)
        enhanced = cv2.addWeighted(enhanced, 1.45, blurred, -0.45, 0)
        enhanced_result = engine(enhanced, use_det=True, use_cls=True, use_rec=True)
        if _result_score(enhanced_result) >= _result_score(result):
            image = enhanced
            result = enhanced_result
            quality["enhanced_for_small_text"] = True

    # Return whole-frame text immediately in live mode. The camera schedules
    # this same image through the existing comprehensive path in the background.
    # Running the multi-offset stamp search here blocked the first response and
    # then repeated that work again during precision refinement.
    stamped_started = perf_counter()
    dot_matrix_lines = (
        extract_dot_matrix_lines(
            dot_matrix_image,
            dot_matrix_result,
            image_id,
            engine,
            coordinate_scale=coordinate_scale,
            comprehensive=not live,
        )
        if not live
        else []
    )
    quality["precision_deferred"] = live
    quality["timing_ms"]["stamped_fields"] = round((perf_counter() - stamped_started) * 1000, 1)

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
    quality["ocr_cache_hit"] = False
    quality["timing_ms"]["total"] = round((perf_counter() - started) * 1000, 1)
    with _ocr_cache_lock:
        _ocr_cache[cache_key] = deepcopy((lines, quality))
        _ocr_cache.move_to_end(cache_key)
        while len(_ocr_cache) > _OCR_CACHE_LIMIT:
            _ocr_cache.popitem(last=False)
    return lines, quality
