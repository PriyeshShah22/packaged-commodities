"""Targeted recognition for faint dot-matrix values on price/date stickers.

General OCR reliably reads the dark pre-printed labels on these stickers but can
skip the much lighter inkjet/dot-matrix values.  The labels therefore act as
stable spatial anchors for a recognition-only pass over each value row.
"""

import re
from typing import Any

import cv2
import numpy as np


ROW_ANCHORS = {
    "mrp": re.compile(r"\b(?:mrp|maximum\s+retail\s+price)\b", re.I),
    "unit_sale_price": re.compile(r"\bunit\s+sale\s+price\b", re.I),
    "batch_number": re.compile(r"\bbatch\s*(?:no\.?|number)?\b", re.I),
    "manufacture_pack_import_date": re.compile(r"\b(?:date\s+of\s+manufacture|mfg|mfd)\b", re.I),
    "best_before_or_use_by": re.compile(r"\b(?:use\s*by(?:\s+date)?|best\s*before|exp(?:iry)?)\b", re.I),
}
ROW_ORDER = ("mrp", "unit_sale_price", "batch_number", "manufacture_pack_import_date", "best_before_or_use_by")


def _bounds(box: Any) -> tuple[int, int, int, int]:
    xs = [float(point[0]) for point in box]
    ys = [float(point[1]) for point in box]
    return round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys))


def _recognize_row(engine: Any, row: np.ndarray) -> tuple[str, float]:
    if row.size == 0:
        return "", 0.0

    gray = cv2.cvtColor(row, cv2.COLOR_BGR2GRAY) if row.ndim == 3 else row
    # A white border prevents characters at the crop edge from being clipped.
    bordered = cv2.copyMakeBorder(gray, 6, 6, 8, 8, cv2.BORDER_CONSTANT, value=255)
    enlarged = cv2.resize(bordered, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
    sharpened = cv2.addWeighted(enlarged, 1.35, cv2.GaussianBlur(enlarged, (0, 0), 1), -0.35, 0)

    best = ("", 0.0)
    for candidate in (bordered, enlarged, sharpened):
        result = engine(candidate, use_det=False, use_cls=False, use_rec=True)
        if result.txts is None or result.scores is None or not len(result.txts):
            continue
        text = str(result.txts[0]).strip()
        score = float(result.scores[0])
        # Prefer a plausible longer value when scores are close.
        rank = score + min(0.12, sum(character.isalnum() for character in text) * 0.008)
        best_rank = best[1] + min(0.12, sum(character.isalnum() for character in best[0]) * 0.008)
        if rank > best_rank:
            best = (text, score)
    return best


def _amount(text: str) -> str:
    cleaned = text.upper().replace("O", "0")
    cleaned = re.sub(r"(?<=\d)[:;,](?=\d{2}\b)", ".", cleaned)
    matches = re.findall(r"\d+(?:[.]\d{1,2})?", cleaned)
    return max(matches, key=lambda value: ("." in value, len(value)), default="")


def _date(text: str) -> tuple[str, bool]:
    digits = re.sub(r"\D", "", text)
    corrected = False
    if len(digits) >= 8:
        # Dot-matrix separators are commonly read as 7/1/9. Preserve the final
        # four-digit year, then repair only an unambiguous extra leading glyph.
        if len(digits) == 9 and digits[-4:-2] in {"20", "19"}:
            prefix = digits[:-4]
            if len(prefix) == 5:
                repaired = ""
                for index in range(5):
                    option = prefix[:index] + prefix[index + 1:]
                    variants = [option]
                    if option[0] in "179":
                        variants.append("0" + option[1:])
                    repaired = next(
                        (value for value in variants if 1 <= int(value[:2]) <= 31 and 1 <= int(value[2:]) <= 12),
                        repaired,
                    )
                if repaired:
                    prefix = repaired
                    corrected = True
            digits = prefix + digits[-4:]
        elif len(digits) > 8:
            digits = digits[-8:]
            corrected = True
    if len(digits) == 7:
        digits = "0" + digits
        corrected = True
    if len(digits) == 8 and int(digits[:2]) > 31 and digits[0] in "179":
        repaired = "0" + digits[1:]
        if 1 <= int(repaired[:2]) <= 31 and 1 <= int(repaired[2:4]) <= 12:
            digits = repaired
            corrected = True
    if len(digits) != 8:
        return "", corrected
    day, month, year = int(digits[:2]), int(digits[2:4]), int(digits[4:])
    if not (1 <= day <= 31 and 1 <= month <= 12 and 2000 <= year <= 2099):
        return "", corrected
    return f"{day:02d}/{month:02d}/{year:04d}", corrected


def _normalize(field: str, text: str) -> tuple[str, float]:
    if field == "mrp":
        amount = _amount(text)
        return (f"MRP ₹{amount} inclusive of all taxes", 0.0) if amount else ("", 0.0)
    if field == "unit_sale_price":
        amount = _amount(text)
        upper = text.upper().replace("FER", "PER")
        unit = "L" if re.search(r"\b(?:L|LT|LTR|LITRE)\b", upper) else "kg" if re.search(r"\bKG\b", upper) else ""
        return (f"Unit sale price ₹{amount} per {unit}", 0.03) if amount and unit else ("", 0.0)
    if field == "batch_number":
        tokens = re.findall(r"[A-Z0-9/-]{4,}", text.upper())
        value = max((token for token in tokens if re.search(r"\d", token)), key=len, default="")
        if value:
            value = re.sub(r"(?<=\d)O(?=\d)", "0", value)
            if re.match(r"^20\d[A-Z]", value):
                value = "S" + value[1:]
            return f"Batch No {value}", 0.08
        return "", 0.0
    value, corrected = _date(text)
    if not value:
        return "", 0.0
    label = "Date of manufacture" if field == "manufacture_pack_import_date" else "Use by date"
    return f"{label}: {value}", 0.1 if corrected else 0.02


def extract_dot_matrix_lines(image: np.ndarray, result: Any, image_id: str, engine: Any) -> list[dict[str, Any]]:
    if result.boxes is None or result.txts is None:
        return []

    candidates: dict[str, list[tuple[int, int, int, int]]] = {field: [] for field in ROW_ANCHORS}
    for box, raw_text in zip(result.boxes, result.txts, strict=False):
        text = str(raw_text)
        for field, pattern in ROW_ANCHORS.items():
            if pattern.search(text):
                candidates[field].append(_bounds(box))

    if not candidates["mrp"]:
        return []
    # Legal prose elsewhere on the panel may mention "batch no." or "use by".
    # Select the compact vertical group beside the actual MRP sticker.
    mrp_box = max(candidates["mrp"], key=lambda box: box[1])
    mrp_x = (mrp_box[0] + mrp_box[2]) / 2
    mrp_y = (mrp_box[1] + mrp_box[3]) / 2
    mrp_height = max(1, mrp_box[3] - mrp_box[1])
    anchors: dict[str, tuple[int, int, int, int]] = {"mrp": mrp_box}
    for field, boxes in candidates.items():
        if field == "mrp" or not boxes:
            continue
        nearby = [box for box in boxes if abs((box[1] + box[3]) / 2 - mrp_y) <= mrp_height * 3.6]
        if nearby:
            anchors[field] = min(
                nearby,
                key=lambda box: abs((box[0] + box[2]) / 2 - mrp_x) + abs((box[1] + box[3]) / 2 - mrp_y) * 0.35,
            )

    # Avoid aiming a recognition-only pass into unrelated parts of a package.
    if len(anchors) < 3 or "mrp" not in anchors:
        return []

    heights = [max(1, box[3] - box[1]) for box in anchors.values()]
    typical_height = float(np.median(heights))
    label_left = min(box[0] for box in anchors.values())
    label_right = max(box[2] for box in anchors.values())
    value_left = min(image.shape[1] - 1, round(label_right + typical_height * 0.8))
    # Stop at the right edge of the white sticker. Including the dark package
    # beyond it substantially lowers recognition accuracy for faint characters.
    value_width = max(round((label_right - label_left) * 1.02), round(typical_height * 8), 320)
    value_right = min(image.shape[1], value_left + value_width)

    lines: list[dict[str, Any]] = []
    # Values on standard price stickers form a tight five-row dot-matrix block.
    # Multi-line printed labels (especially the MRP tax note) do not share the
    # stamped baseline, so derive the value rows from that regular block.
    first_center_y = mrp_box[3] + typical_height * 0.03
    row_step = typical_height * 0.4
    for row_index, field in enumerate(ROW_ORDER):
        if field not in anchors:
            continue
        center_y = first_center_y + row_index * row_step
        half_height = max(7, round(typical_height * 0.25))
        base_top = max(0, round(center_y - half_height))
        base_bottom = min(image.shape[0], round(center_y + half_height))
        best = ("", "", 0.0, 0.0, base_top, base_bottom)
        offsets = range(-2, 3) if field in {"manufacture_pack_import_date", "best_before_or_use_by"} else (0,)
        for offset in offsets:
            top = max(0, base_top + offset)
            bottom = min(image.shape[0], base_bottom + offset)
            raw, confidence = _recognize_row(engine, image[top:bottom, value_left:value_right])
            normalized, penalty = _normalize(field, raw)
            if normalized and confidence - penalty > best[2] - best[3]:
                best = (normalized, raw, confidence, penalty, top, bottom)
        normalized, raw, confidence, penalty, top, bottom = best
        if not normalized:
            continue
        lines.append({
            "text": normalized,
            "confidence": round(max(0.35, confidence - penalty), 4),
            "bbox": [float(value_left), float(top), float(value_right), float(bottom)],
            "image_id": image_id,
            "source_type": "dot_matrix_ocr",
            "raw_text": raw,
        })
    return lines
