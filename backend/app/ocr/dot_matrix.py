"""Targeted recognition for faint dot-matrix values on price/date stickers.

General OCR reliably reads the dark pre-printed labels on these stickers but can
skip the much lighter inkjet/dot-matrix values.  The labels therefore act as
stable spatial anchors for a recognition-only pass over each value row.
"""

import re
from difflib import SequenceMatcher
from typing import Any

import cv2
import numpy as np


ROW_ANCHORS = {
    "net_quantity": re.compile(r"\b(?:net\s*(?:weight|wt|quantity|qty))\b", re.I),
    "mrp": re.compile(r"\b(?:mrp|maximum\s+retail\s+price)\b", re.I),
    "unit_sale_price": re.compile(r"\b(?:u\s*s\s*p|unit\s+sale\s+price|price\s*per)\b", re.I),
    "batch_number": re.compile(r"\bbatch\s*(?:no\.?|number)?\b", re.I),
    "manufacture_pack_import_date": re.compile(r"\b(?:date\s+of\s+manufacture|mfg|mfd)\b", re.I),
    "best_before_or_use_by": re.compile(r"\b(?:use\s*by(?:\s+date)?|best\s*before|exp(?:iry)?)\b", re.I),
}
ROW_LABELS = {
    "net_quantity": ("netweight", "netwt", "netquantity", "netqty"),
    "mrp": ("mrp", "maximumretailprice"),
    "unit_sale_price": ("usp", "unitsaleprice", "priceper"),
    "batch_number": ("batchno", "batchnumber", "lotno"),
    "manufacture_pack_import_date": ("dateofmanufacture", "manufacturedate", "mfg", "mfd", "packedon"),
    "best_before_or_use_by": ("usebydate", "useby", "bestbefore", "expiry", "exp"),
}


def _row_field(text: str) -> str | None:
    for field, pattern in ROW_ANCHORS.items():
        if pattern.search(text):
            return field
    compact = re.sub(r"[^a-z]", "", text.lower())
    if len(compact) < 3:
        return None
    if compact == "quality":
        return None
    if compact.startswith("mrp"):
        return "mrp"
    if compact.startswith("usp"):
        return "unit_sale_price"
    if compact.startswith("us") and 4 <= len(compact) <= 7:
        return "best_before_or_use_by"
    best_field, best_score = None, 0.0
    for field, labels in ROW_LABELS.items():
        score = max(SequenceMatcher(None, compact, label).ratio() for label in labels)
        if score > best_score:
            best_field, best_score = field, score
    # Short, faint labels such as "Use By" are often damaged into "UsUgy".
    # Spatial filtering around the MRP sticker below prevents this deliberately
    # tolerant label match from leaking into unrelated package copy.
    return best_field if best_score >= .55 else None


def _bounds(box: Any) -> tuple[int, int, int, int]:
    xs = [float(point[0]) for point in box]
    ys = [float(point[1]) for point in box]
    return round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys))


def _box_slope(box: Any) -> float:
    """Estimate the row slope so values need not share the label baseline."""
    points = np.asarray(box, dtype=float)
    if points.shape != (4, 2):
        return 0.0
    ordered = points[np.argsort(points[:, 1])]
    top = ordered[:2][np.argsort(ordered[:2, 0])]
    bottom = ordered[2:][np.argsort(ordered[2:, 0])]
    widths = [top[1, 0] - top[0, 0], bottom[1, 0] - bottom[0, 0]]
    slopes = []
    if abs(widths[0]) > 1:
        slopes.append((top[1, 1] - top[0, 1]) / widths[0])
    if abs(widths[1]) > 1:
        slopes.append((bottom[1, 1] - bottom[0, 1]) / widths[1])
    return float(np.median(slopes)) if slopes else 0.0


def _recognize_row(engine: Any, row: np.ndarray) -> tuple[str, float]:
    if row.size == 0:
        return "", 0.0

    gray = cv2.cvtColor(row, cv2.COLOR_BGR2GRAY) if row.ndim == 3 else row
    # A white border prevents characters at the crop edge from being clipped.
    bordered = cv2.copyMakeBorder(gray, 6, 6, 8, 8, cv2.BORDER_CONSTANT, value=255)
    enlarged = cv2.resize(bordered, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
    sharpened = cv2.addWeighted(enlarged, 1.35, cv2.GaussianBlur(enlarged, (0, 0), 1), -0.35, 0)

    # The sharpened crop is the most reliable default for faint stamps. Running
    # all three variants for every row multiplied a five-row sticker into dozens
    # of ONNX calls. Only fall back when the first result is genuinely weak.
    best = ("", 0.0)
    candidates = [sharpened, enlarged]
    for candidate in candidates:
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
        if score >= 0.96 and sum(character.isalnum() for character in text) >= 4:
            break
    if best[1] < 0.62 or sum(character.isalnum() for character in best[0]) < 3:
        result = engine(bordered, use_det=False, use_cls=False, use_rec=True)
        if result.txts is not None and result.scores is not None and len(result.txts):
            text, score = str(result.txts[0]).strip(), float(result.scores[0])
            if score > best[1]:
                best = (text, score)
    return best


def _amount(text: str) -> str:
    # Do not manufacture a zero from an OCR'd letter O (for example "No:").
    if not re.search(r"\d", text):
        return ""
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
    if field == "net_quantity":
        match = re.search(r"(\d+(?:[.]\d+)?)\s*(kg|g|gm|ml|l|ltr)\b", text, re.I)
        if not match:
            return "", 0.0
        unit = match.group(2).lower()
        unit = {"gm": "g", "ltr": "L", "l": "L"}.get(unit, unit)
        return f"Net quantity {match.group(1)} {unit}", 0.02
    if field == "mrp":
        amount = _amount(text)
        if not amount or float(amount) <= 0 or float(amount) > 1_000_000:
            return "", 0.0
        return f"MRP ₹{amount} inclusive of all taxes", 0.0
    if field == "unit_sale_price":
        amount = _amount(text)
        upper = text.upper().replace("FER", "PER")
        unit = (
            "kg" if re.search(r"\bKG\b", upper)
            else "ml" if re.search(r"\bML\b", upper)
            else "g" if re.search(r"\b(?:G|GM)\b|PER\s*G", upper)
            else "L" if re.search(r"\b(?:L|LT|LTR|LITRE)\b", upper)
            else ""
        )
        return (f"Unit sale price ₹{amount} per {unit}", 0.03) if amount and unit else ("", 0.0)
    if field == "batch_number":
        tokens = re.findall(r"[A-Z0-9/-]{4,}", text.upper())
        value = max(
            (
                token for token in tokens
                if re.search(r"\d", token)
                and not re.fullmatch(r"\d+(?:G|GM|KG|ML|L|LTR)", token)
            ),
            key=len,
            default="",
        )
        if value:
            value = re.sub(r"(?<=\d)O(?=\d)", "0", value)
            if re.match(r"^20\d[A-Z]", value):
                value = "S" + value[1:]
            # Numeric-only batch identifiers exist, but are easier to confuse
            # with weights/prices and therefore need stronger corroboration.
            penalty = 0.03 if re.search(r"[A-Z]", value) and re.search(r"\d", value) else 0.18
            return f"Batch No {value}", penalty
        return "", 0.0
    value, corrected = _date(text)
    if not value:
        return "", 0.0
    label = "Date of manufacture" if field == "manufacture_pack_import_date" else "Use by date"
    return f"{label}: {value}", 0.1 if corrected else 0.02


def extract_dot_matrix_lines(
    image: np.ndarray,
    result: Any,
    image_id: str,
    engine: Any,
    *,
    coordinate_scale: float = 1.0,
) -> list[dict[str, Any]]:
    if result.boxes is None or result.txts is None:
        return []

    candidates: dict[str, list[tuple[tuple[int, int, int, int], float, str]]] = {field: [] for field in ROW_ANCHORS}
    for box, raw_text in zip(result.boxes, result.txts, strict=False):
        field = _row_field(str(raw_text))
        if field:
            bounds = tuple(round(value * coordinate_scale) for value in _bounds(box))
            candidates[field].append((bounds, _box_slope(box), str(raw_text)))

    reference_field = next((field for field in ("mrp", "batch_number", "unit_sale_price", "net_quantity", "manufacture_pack_import_date") if candidates[field]), None)
    if reference_field is None:
        return []
    # Legal prose elsewhere on the panel may mention "batch no." or "use by".
    # Select the compact vertical group beside the actual MRP sticker.
    mrp_box, mrp_slope, mrp_label = max(candidates[reference_field], key=lambda item: item[0][1])
    mrp_x = (mrp_box[0] + mrp_box[2]) / 2
    mrp_y = (mrp_box[1] + mrp_box[3]) / 2
    mrp_height = max(1, mrp_box[3] - mrp_box[1])
    anchors: dict[str, tuple[tuple[int, int, int, int], float, str]] = {
        reference_field: (mrp_box, mrp_slope, mrp_label)
    }
    for field, items in candidates.items():
        if field == reference_field or not items:
            continue
        nearby = [item for item in items if abs((item[0][1] + item[0][3]) / 2 - mrp_y) <= mrp_height * 4.8]
        if nearby:
            anchors[field] = min(
                nearby,
                key=lambda item: abs((item[0][0] + item[0][2]) / 2 - mrp_x)
                + abs((item[0][1] + item[0][3]) / 2 - mrp_y) * 0.35,
            )

    # Avoid aiming a recognition-only pass into unrelated parts of a package.
    if len(anchors) < 2:
        return []

    heights = [max(1, item[0][3] - item[0][1]) for item in anchors.values()]
    typical_height = float(np.median(heights))
    label_left = min(item[0][0] for item in anchors.values())
    label_right = max(item[0][2] for item in anchors.values())
    value_left = min(image.shape[1] - 1, round(label_right + typical_height * 0.35))
    # Stop at the right edge of the white sticker. Including the dark package
    # beyond it substantially lowers recognition accuracy for faint characters.
    value_width = max(round((label_right - label_left) * 2.8), round(typical_height * 14))
    value_right = min(image.shape[1], value_left + value_width)

    lines: list[dict[str, Any]] = []
    # Project every label's actual baseline across to the value column. This
    # follows skew/perspective and supports irregular row spacing instead of
    # assuming that every manufacturer's sticker uses one fixed template.
    for field, (anchor, _slope, label_text) in anchors.items():
        # Inkjet values are commonly printed on a separately applied white
        # sticker whose rows sit slightly above the pre-printed captions. Try a
        # small scale-relative band, never a product-specific pixel position.
        label_center_y = (anchor[1] + anchor[3]) / 2
        # Longer printed captions can sit below their corresponding stamped
        # baseline. The first of two dated rows (Packed/Mfg) needs the upper
        # band; the later Use-by row remains centered on the common shift.
        shift = {
            "net_quantity": 0.4,
            "batch_number": 0.6,
            "mrp": 0.75,
            "unit_sale_price": 1.1,
            "manufacture_pack_import_date": 1.45,
            "best_before_or_use_by": 1.3,
        }.get(field, 0.85)
        center_y = label_center_y - typical_height * shift
        half_height = max(12, round(typical_height * (0.75 if field == "unit_sale_price" else 0.7 if "date" in field or "before" in field else 0.5)))
        base_top = max(0, round(center_y - half_height))
        base_bottom = min(image.shape[0], round(center_y + half_height))
        best = ("", "", 0.0, 0.0, base_top, base_bottom, value_left)
        offsets = tuple(round(typical_height * value) for value in (0, -0.3, 0.3))
        for offset in offsets:
            top = max(0, base_top + offset)
            bottom = min(image.shape[0], base_bottom + offset)
            # Try the expected value column first, then a full sticker row. The
            # second crop handles dot-matrix values printed below or overlapping
            # a differently sized label rather than perfectly aligned beside it.
            crop_lefts = (
                (value_left, max(0, round(label_left - typical_height * .2)))
                if field in {"manufacture_pack_import_date", "best_before_or_use_by"}
                else (value_left,)
            )
            for crop_left in crop_lefts:
                width_factor = 14 if field in {"batch_number", "manufacture_pack_import_date", "best_before_or_use_by"} else 9
                field_value_right = min(value_right, round(value_left + typical_height * width_factor))
                raw, confidence = _recognize_row(engine, image[top:bottom, crop_left:field_value_right])
                normalized, penalty = _normalize(field, f"{raw} {label_text}")
                position_penalty = abs(offset) / max(1, typical_height) * 0.15
                total_penalty = penalty + position_penalty
                if normalized and confidence - total_penalty > best[2] - best[3]:
                    best = (normalized, raw, confidence, total_penalty, top, bottom, crop_left, field_value_right)
                if normalized and confidence - total_penalty >= 0.90:
                    break
        if len(best) == 7:
            best = (*best, value_right)
        normalized, raw, confidence, penalty, top, bottom, crop_left, crop_right = best
        if not normalized or confidence - penalty < 0.5:
            continue
        lines.append({
            "text": normalized,
            "confidence": round(max(0.35, confidence - penalty), 4),
            "bbox": [float(crop_left), float(top), float(crop_right), float(bottom)],
            "image_id": image_id,
            "source_type": "dot_matrix_ocr",
            "raw_text": raw,
        })
    return lines
