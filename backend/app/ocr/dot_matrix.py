"""Targeted recognition for faint dot-matrix values on price/date stickers.

General OCR reliably reads the dark pre-printed labels on these stickers but can
skip the much lighter inkjet/dot-matrix values.  The labels therefore act as
stable spatial anchors for a recognition-only pass over each value row.
"""

import re
from difflib import SequenceMatcher
from itertools import combinations
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
    month_names = {
        "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
        "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
    }
    upper = text.upper()
    month_token = next((name for name in month_names if re.search(rf"\b{name}[A-Z]*\b", upper)), None)
    if month_token:
        numbers = [int(value) for value in re.findall(r"\d{1,4}", upper)]
        year = next((value for value in reversed(numbers) if value >= 1000), None)
        day = next((value for value in numbers if value != year and 1 <= value <= 31), None)
        if year and 2000 <= year <= 2099:
            month = month_names[month_token]
            return (f"{day:02d}/{month:02d}/{year:04d}" if day else f"{month:02d}/{year:04d}"), False

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
    if len(digits) == 6:
        day, month, short_year = int(digits[:2]), int(digits[2:4]), int(digits[4:])
        if 1 <= day <= 31 and 1 <= month <= 12:
            return f"{day:02d}/{month:02d}/{2000 + short_year:04d}", True
    if len(digits) != 8:
        return "", corrected
    day, month, year = int(digits[:2]), int(digits[2:4]), int(digits[4:])
    if not (1 <= day <= 31 and 1 <= month <= 12 and 2000 <= year <= 2099):
        return "", corrected
    return f"{day:02d}/{month:02d}/{year:04d}", corrected


def _is_plausible_row_value(field: str, text: str) -> bool:
    """Identify already-detected values without assuming a specific layout."""
    if _row_field(text):
        return False
    if field in {"manufacture_pack_import_date", "best_before_or_use_by"}:
        return bool(_date(text)[0])
    if field == "net_quantity":
        return bool(re.search(r"\d+(?:[.]\d+)?\s*(?:kg|g|gm|ml|l|ltr)\b", text, re.I))
    if field == "batch_number":
        compact = re.sub(r"[^A-Z0-9]", "", text.upper())
        return len(compact) >= 3 and bool(re.search(r"[A-Z]", compact) and re.search(r"\d", compact))
    if field in {"mrp", "unit_sale_price"}:
        stripped = re.sub(r"\b(?:RS|INR)\b", "", text.upper())
        letters = re.sub(r"[^A-Z]", "", stripped)
        date_shaped = len(re.findall(r"[./:-]", text)) >= 2 or bool(re.search(r"(?:19|20)\d{1,2}", text))
        return bool(_amount(text) and not letters and not date_shaped and not _date(text)[0])
    return False


def _looks_like_partial_date(text: str) -> bool:
    """Use damaged dates for geometry without accepting them as final values."""
    digits = re.sub(r"\D", "", text)
    separators = len(re.findall(r"[./:-]", text))
    return bool(
        _date(text)[0]
        or (len(digits) >= 6 and separators >= 2)
        or (len(digits) >= 6 and re.search(r"(?:19|20)\d{1,2}", digits))
    )


def _value_lanes(
    anchors: dict[str, tuple[tuple[int, int, int, int], float, str]],
    field_shifts: dict[str, float],
    global_shift: float,
    typical_height: float,
    image_height: int,
) -> dict[str, tuple[float, float, float]]:
    """Give each label one exclusive value lane, even when rows are staggered.

    The lane centres are inferred from OCR detections in this image.  Midpoints
    between adjacent centres prevent a strong recognition from a neighbouring
    row (for example a batch number) from being reused as an MRP or date.
    """
    ordered = sorted(
        anchors,
        key=lambda field: (anchors[field][0][1] + anchors[field][0][3]) / 2,
    )
    centres: dict[str, float] = {}
    previous = float("-inf")
    minimum_gap = typical_height * 0.45
    for field in ordered:
        anchor = anchors[field][0]
        label_y = (anchor[1] + anchor[3]) / 2
        projected = label_y + field_shifts.get(field, global_shift)
        # Noisy partial OCR must not reverse the physical order of printed rows.
        projected = max(projected, previous + minimum_gap)
        centres[field] = projected
        previous = projected

    lanes: dict[str, tuple[float, float, float]] = {}
    for index, field in enumerate(ordered):
        centre = centres[field]
        if index:
            top = (centres[ordered[index - 1]] + centre) / 2
        else:
            next_gap = centres[ordered[1]] - centre if len(ordered) > 1 else typical_height * 2
            top = centre - max(typical_height * 0.8, next_gap / 2)
        if index + 1 < len(ordered):
            bottom = (centre + centres[ordered[index + 1]]) / 2
        else:
            previous_gap = centre - centres[ordered[index - 1]] if index else typical_height * 2
            bottom = centre + max(typical_height * 0.8, previous_gap / 2)
        lanes[field] = (max(0.0, top), centre, min(float(image_height), bottom))
    return lanes


def _estimate_alignment_shifts(
    anchors: dict[str, tuple[tuple[int, int, int, int], float, str]],
    result: Any,
    coordinate_scale: float,
    typical_height: float,
    value_right: int,
) -> tuple[dict[str, float], float]:
    """Learn whether values sit above or below labels from the current image."""
    detected_values: list[tuple[tuple[int, int, int, int], str]] = []
    boxes = [] if result.boxes is None else result.boxes
    texts = [] if result.txts is None else result.txts
    for box, raw_text in zip(boxes, texts, strict=False):
        bounds = tuple(round(value * coordinate_scale) for value in _bounds(box))
        detected_values.append((bounds, str(raw_text)))

    shifts: dict[str, float] = {}

    # Dates are assigned one-to-one. A partly missed Use By date must not cause
    # the already-detected Packed On date to be copied into both legal fields.
    date_fields = [
        field for field in ("manufacture_pack_import_date", "best_before_or_use_by")
        if field in anchors
    ]
    date_values = [
        (bounds, text) for bounds, text in detected_values
        if not _row_field(text) and _looks_like_partial_date(text)
    ]
    # Match date rows in reading order, not merely to the closest label. On
    # many packs all dot-matrix values are shifted upward: the Use By value may
    # therefore be physically closer to the Packed On label than its own.
    ordered_date_fields = sorted(
        date_fields,
        key=lambda field: (anchors[field][0][1] + anchors[field][0][3]) / 2,
    )
    ordered_date_values = sorted(date_values, key=lambda item: (item[0][1] + item[0][3]) / 2)
    if ordered_date_fields and len(ordered_date_values) >= len(ordered_date_fields):
        valid_assignments = []
        for chosen in combinations(ordered_date_values, len(ordered_date_fields)):
            assignment = []
            for field, (bounds, _text) in zip(ordered_date_fields, chosen, strict=True):
                anchor = anchors[field][0]
                anchor_y = (anchor[1] + anchor[3]) / 2
                value_x = (bounds[0] + bounds[2]) / 2
                value_y = (bounds[1] + bounds[3]) / 2
                delta = value_y - anchor_y
                if not (anchor[2] - typical_height * .5 <= value_x <= value_right and abs(delta) <= typical_height * 3.5):
                    break
                assignment.append((field, delta))
            else:
                valid_assignments.append((sum(abs(delta) for _field, delta in assignment), assignment))
        if valid_assignments:
            for field, delta in min(valid_assignments, key=lambda item: item[0])[1]:
                shifts[field] = delta

    for field, (anchor, _slope, _label) in anchors.items():
        if field in date_fields:
            continue
        anchor_y = (anchor[1] + anchor[3]) / 2
        possible = []
        for bounds, text in detected_values:
            value_x = (bounds[0] + bounds[2]) / 2
            value_y = (bounds[1] + bounds[3]) / 2
            if value_x < anchor[2] - typical_height * .5 or value_x > value_right:
                continue
            delta = value_y - anchor_y
            if abs(delta) <= typical_height * 3.5 and _is_plausible_row_value(field, text):
                possible.append((abs(delta), delta))
        if possible:
            shifts[field] = min(possible)[1]

    global_shift = float(np.median(list(shifts.values()))) if shifts else 0.0
    return shifts, global_shift


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
    field_shifts, global_shift = _estimate_alignment_shifts(
        anchors, result, coordinate_scale, typical_height, value_right
    )
    lanes = _value_lanes(
        anchors, field_shifts, global_shift, typical_height, image.shape[0]
    )

    lines: list[dict[str, Any]] = []
    # Project every label's actual baseline across to the value column. This
    # follows skew/perspective and supports irregular row spacing instead of
    # assuming that every manufacturer's sticker uses one fixed template.
    for field, (anchor, _slope, label_text) in anchors.items():
        lane_top, center_y, lane_bottom = lanes[field]
        half_height = max(12, round(typical_height * (0.75 if field == "unit_sale_price" else 0.7 if "date" in field or "before" in field else 0.5)))
        base_top = max(round(lane_top), round(center_y - half_height))
        base_bottom = min(round(lane_bottom), round(center_y + half_height))
        best = ("", "", 0.0, 0.0, base_top, base_bottom, value_left)
        offsets = tuple(round(typical_height * value) for value in (0, -0.35, 0.35, -0.7, 0.7, -1.1, 1.1))
        for offset in offsets:
            candidate_center = center_y + offset
            if not lane_top <= candidate_center <= lane_bottom:
                continue
            top = max(round(lane_top), round(candidate_center - half_height))
            bottom = min(round(lane_bottom), round(candidate_center + half_height))
            if bottom - top < 10:
                continue
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
                # Classification is performed on the recognized value alone.
                # Adding the label is useful for normalization, but must never
                # make a batch/date-shaped neighbouring value look like a price.
                if not _is_plausible_row_value(field, raw):
                    continue
                normalized, penalty = _normalize(field, f"{raw} {label_text}")
                position_penalty = abs(offset) / max(1, typical_height) * 0.28
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
