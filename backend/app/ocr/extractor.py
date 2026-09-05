import re
import unicodedata
from collections.abc import Iterable
from typing import Any, Callable


ANCHORS = {
    "mrp": re.compile(r"\b(?:m\s*\.?\s*r\s*\.?\s*p\.?|maximum\s+retail\s+price)\b", re.I),
    "net_quantity": re.compile(r"\b(?:n\s*e\s*t)[\s.:-]*(?:q\s*t\s*y|quantity|w\s*t\.?|weight)\b", re.I),
    "consumer_care": re.compile(r"\b(?:consumer\s*(?:care|complaint)|customer\s*care|feedback\s+contact)\b", re.I),
    "country_of_origin": re.compile(r"\b(?:country\s+of\s+origin|made\s+in|product\s+of)\b", re.I),
    "manufacture_pack_import_date": re.compile(r"\b(?:m\s*f\s*g|m\s*f\s*d|date\s+of\s+manufacture|manufactur(?:ed|ing)\s+(?:date|on)|pack(?:ed|ing)\s+(?:date|on)|p\s*(?:c\s*)?k\s*d|imported\s+on)\b", re.I),
    "best_before_or_use_by": re.compile(r"\b(?:best\s*before|use\s*by(?:\s+date)?|exp(?:iry|ires?)?)\b", re.I),
    "unit_sale_price": re.compile(r"\b(?:u\s*s\s*p|unit\s*sale\s*price|price\s*per)\b", re.I),
    "responsible_party_name": re.compile(r"\b(?:manufactured|marketed|packed|imported)\s+by\b", re.I),
    "batch_number": re.compile(r"\b(?:batch|lot|b\s*\.?\s*no)\s*(?:no\.?|number|#)?\b", re.I),
    "fssai_license": re.compile(r"\b(?:fssai|[il1]?ssai)\s*(?:lic(?:ence)?\.?\s*)?(?:no\.?|number)?\b", re.I),
    "commodity_name": re.compile(r"\b(?:product\s+category|common\s+(?:or\s+generic\s+)?name|generic\s+name|name\s+of\s+commodity)\b", re.I),
}

EMAIL = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
URL = re.compile(r"(?:\bhttps?://|\bwww\.|\b[a-z0-9][a-z0-9-]*\.(?:com|in|org|net|co\.in)\b)", re.I)
PHONE = re.compile(r"(?<!\d)(?:\+?91[\s-]?)?[6-9](?:[\s-]?\d){9}(?!\d)")
QUANTITY = re.compile(r"\b\d+(?:[.,]\d+)?\s*(?:mg|g|gms?|gm|grams?|kgs?|kg|ml|mL|litres?|liters?|ltr|lt|l|ℓ|cm|metres?|meters?|m|nos?\.?|units?|pieces?|pcs?|pairs?)\b", re.I)
PRICE = re.compile(r"(?:₹|r\s*s\.?|inr)?\s*(\d+(?:[.,]\d{1,2})?)(?:\s*/-)?(?![A-Za-z0-9])", re.I)
DATE = re.compile(r"\b(?:[0-3]?\d[./-][01]?\d[./-]\d{2,4}|(?:0?[1-9]|1[0-2])[./-]\d{2,4}|(?:[0-3]?\d[\s./-]+)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s./-]+\d{2,4})\b", re.I)
DURATION = re.compile(r"\b\d+\s*(?:days?|weeks?|months?|years?)\s*(?:from|after)\s*(?:packing|packaging|manufacture|mfg)\b", re.I)
BATCH = re.compile(r"\b[A-Z0-9][A-Z0-9/-]{3,}\b", re.I)
FSSAI = re.compile(r"\b\d{14}\b")
BARCODE = re.compile(r"\b\d{8,14}\b")
COMPANY = re.compile(r"\b(?:pvt\.?|private|ltd\.?|limited|company|co\.?|foods?|industries|enterprises|llp)\b", re.I)
ADDRESS_HINT = re.compile(r"\b(?:road|rd\.?|street|st\.?|line|lane|industrial|estate|district|dist\.?|india|pincode|pin|gujarat|maharashtra|delhi|mumbai|kolkata|chennai|bengaluru|bangalore|plot|sector|chamber|village|taluka)\b", re.I)
NUTRITION = re.compile(r"\b(?:nutrition|serving|protein|fat|sodium|sugar|carbohydrate|calories|kcal|fibre|cholesterol|rda|ingredients?)\b", re.I)
GENERIC_LABEL = re.compile(r"\b(?:net|mrp|batch|mfg|mfd|expiry|use by|consumer|manufactured|marketed|fssai|lic[\s.]*no|quantity|price|date|address|qr\s*code|follow\s+us|website|incl(?:usive)?|tax(?:es)?)\b", re.I)
PRODUCT_REJECT = re.compile(r"\b(?:www|https?|email|phone|mobile|contact|customer|consumer|fssai|issai|licen[cs]e|barcode|gtin|batch|lot|manufactured|marketed|packed|imported|address|road|street|line|lane|pincode|pin|regn|registration|gpcb|pwr|potential\s+issue|needs?\s+review|non[ -]?compliant|per\s+(?:lit|litre|kg|g|ml)|net\s*weight)\b", re.I)


def _center(line: dict[str, Any]) -> tuple[float, float]:
    box = line.get("bbox") or [0, 0, 0, 0]
    return (box[0] + box[2]) / 2, (box[1] + box[3]) / 2


def _near(anchor: dict[str, Any], lines: list[dict[str, Any]], limit: int = 7) -> list[dict[str, Any]]:
    ax, ay = _center(anchor)
    def distance(item: dict[str, Any]) -> float:
        x, y = _center(item)
        same_row_bonus = -160 if abs(y - ay) < max(35, (anchor["bbox"][3] - anchor["bbox"][1]) * 1.4) else 0
        return abs(x - ax) + abs(y - ay) * 1.6 + same_row_bonus
    nearby = sorted(lines, key=distance)
    return nearby[:limit]


def _candidate(field: str, value: str, source: list[dict[str, Any]], confidence_penalty: float = 0) -> dict[str, Any]:
    boxes = [line["bbox"] for line in source if line.get("bbox")]
    bbox = [min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)] if boxes else None
    confidence = max(0, sum(float(line.get("confidence", 0)) for line in source) / max(1, len(source)) - confidence_penalty)
    return {"field": field, "value": value.strip(" :-,;"), "raw_text": " ".join(line.get("text", "") for line in source).strip(), "confidence": round(confidence, 4), "image_id": source[0]["image_id"], "bbox": bbox, "source_type": "ocr"}


def _dedupe_rank(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    unique: dict[str, dict[str, Any]] = {}
    for item in candidates:
        key = re.sub(r"\s+", " ", item["value"].lower()).strip()
        if key and (key not in unique or item["confidence"] > unique[key]["confidence"]):
            unique[key] = item
    return sorted(unique.values(), key=lambda item: (item["confidence"], -len(item["value"])), reverse=True)


def _evidence_strength(field: str, item: dict[str, Any]) -> float:
    """Rank semantic completeness as well as OCR certainty.

    Camera OCR is often extremely confident about a clipped fragment.  Confidence
    alone must therefore not let a single digit/word beat a complete declaration.
    """
    value = str(item.get("value", ""))
    raw = str(item.get("raw_text", ""))
    confidence = float(item.get("confidence", 0))
    digits = len(re.findall(r"\d", value))
    words = len(re.findall(r"[A-Za-z]{2,}", value))
    score = confidence
    if field in {"mrp", "unit_sale_price"}:
        score += min(digits, 6) * .025
        score += .05 if re.search(r"\d[.,]\d{1,2}\b", raw) else 0
        score += .03 if re.search(r"₹|\brs\.?\b|\binr\b|/-", raw, re.I) else 0
    elif field == "net_quantity":
        score += min(digits, 7) * .03
    elif field in {"consumer_phone", "fssai_license", "barcode"}:
        score += min(digits, 14) * .012
    elif field in {"manufacture_pack_import_date", "best_before_or_use_by", "batch_number"}:
        score += min(len(re.sub(r"\s", "", value)), 14) * .008
    elif field in {"product_name", "commodity_name", "responsible_party_name", "responsible_party_address"}:
        score += min(words, 7) * .018 + min(len(value), 70) * .001
    return score


def _valid_product_text(text: str) -> bool:
    compact = re.sub(r"\s+", " ", text).strip(" .,:;|-")
    digits = re.sub(r"\D", "", compact)
    return bool(
        3 <= len(compact) <= 70
        and len(re.findall(r"[A-Za-z]", unicodedata.normalize("NFKD", compact))) >= 4
        and not URL.search(compact)
        and not EMAIL.search(compact)
        and not PHONE.search(compact)
        and not FSSAI.fullmatch(digits)
        and not BARCODE.fullmatch(digits)
        and not COMPANY.search(compact)
        and not ADDRESS_HINT.search(compact)
        and not GENERIC_LABEL.search(compact)
        and not PRODUCT_REJECT.search(compact)
        and not NUTRITION.search(compact)
        and not re.search(r"\b\d{6}\b", compact)
        and len(compact.split()) <= 6
        and not (len(compact.split()) >= 5 and len(re.findall(r"\b(?:and|or|the|this|that|is|are|true|name|other)\b", compact, re.I)) >= 2)
    )


def _clean_product_text(text: str) -> str:
    folded = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", folded).strip(" .,:;|-")


def _normalize_quantity(value: str) -> str:
    match = QUANTITY.search(value)
    if not match:
        return ""
    raw = match.group(0).replace(",", ".")
    number = re.search(r"\d+(?:\.\d+)?", raw).group(0)
    unit = re.sub(r"[\d.\s]", "", raw).lower().rstrip(".")
    unit = {"gm": "g", "gms": "g", "gram": "g", "grams": "g", "kgs": "kg", "litre": "L", "litres": "L", "liter": "L", "liters": "L", "ltr": "L", "lt": "L", "l": "L", "ℓ": "L", "nos": "units", "no": "units", "pc": "units", "pcs": "units", "piece": "units", "pieces": "units"}.get(unit, unit)
    return f"{number} {unit}"


MONTHS = {name: index for index, names in enumerate((("jan", "january"), ("feb", "february"), ("mar", "march"), ("apr", "april"), ("may",), ("jun", "june"), ("jul", "july"), ("aug", "august"), ("sep", "september"), ("oct", "october"), ("nov", "november"), ("dec", "december")), 1) for name in names}


def _normalize_date(value: str) -> str:
    match = DATE.search(value)
    if not match:
        duration = DURATION.search(value)
        return re.sub(r"\s+", " ", duration.group(0).lower()) if duration else ""
    raw = re.sub(r"\s+", " ", match.group(0).strip()).lower()
    month_name = next((name for name in MONTHS if re.search(rf"\b{name}\b", raw)), None)
    if month_name:
        numbers = [int(number) for number in re.findall(r"\d+", raw)]
        year = numbers[-1]; day = numbers[0] if len(numbers) > 1 else None; month = MONTHS[month_name]
    else:
        numbers = [int(number) for number in re.split(r"[./-]", raw)]
        if len(numbers) == 2:
            month, year = numbers; day = None
        else:
            day, month, year = numbers
    year = year + 2000 if year < 100 else year
    if not (2000 <= year <= 2099 and 1 <= month <= 12 and (day is None or 1 <= day <= 31)):
        return ""
    return f"{day:02d}/{month:02d}/{year:04d}" if day is not None else f"{month:02d}/{year:04d}"


def _normalize_price(value: str) -> str:
    matches = list(PRICE.finditer(value))
    retail_matches = [match for match in matches if not re.match(r"\s*(?:/|per\s+)(?:g|kg|ml|l|unit)\b", value[match.end():], re.I)]
    matches = retail_matches or matches
    substantial = [match for match in matches if float(match.group(1).replace(",", ".")) >= 1]
    matches = substantial or matches
    if not matches:
        return ""
    # A decimal amount is stronger than a batch-like integer accidentally read
    # beside the MRP label; currency markers and /- notation break remaining ties.
    best = max(matches, key=lambda match: (bool(re.search(r"[.,]\d{1,2}", match.group(0))), bool(re.search(r"₹|rs\.?|inr|/-", match.group(0), re.I)), -match.start()))
    amount = best.group(1).replace(",", ".")
    if "." in amount:
        whole, decimal = amount.split(".", 1); amount = f"{int(whole)}.{decimal.ljust(2, '0')[:2]}"
    else:
        amount = str(int(amount))
    return amount


def _extract_labeled(
    field: str,
    image_lines: list[dict[str, Any]],
    extractor: Callable[[str], str],
    penalty: float = 0,
) -> list[dict[str, Any]]:
    found = []
    for anchor in image_lines:
        if not ANCHORS[field].search(anchor["text"]):
            continue
        neighbors = _near(anchor, image_lines)
        anchor_x, anchor_y = _center(anchor)
        anchor_height = max(20, anchor["bbox"][3] - anchor["bbox"][1])
        anchor_width = max(40, anchor["bbox"][2] - anchor["bbox"][0])
        same_row = [
            item for item in neighbors
            if item is not anchor
            and abs(_center(item)[1] - anchor_y) <= max(24, anchor_height * 1.1)
            and (
                item.get("source_type") != "dot_matrix_ocr"
                or ANCHORS[field].search(item["text"])
            )
        ]
        # Camera OCR often splits a printed declaration into adjacent boxes or
        # a label/value pair on consecutive baselines. Evaluate the complete OCR
        # result first, then map only spatially close, compatible text. Excluding
        # competing labels prevents a nearby Use By value becoming the Mfg date.
        adjacent = []
        for item in neighbors:
            if item is anchor or item in same_row or NUTRITION.search(item["text"]):
                continue
            item_x, item_y = _center(item)
            other_anchor = any(pattern.search(item["text"]) for name, pattern in ANCHORS.items() if name != field)
            if other_anchor:
                continue
            close_vertical = -anchor_height * .5 <= item_y - anchor_y <= max(55, anchor_height * 2.2)
            close_horizontal = abs(item_x - anchor_x) <= max(320, anchor_width * 1.8)
            if close_vertical and close_horizontal:
                adjacent.append(item)

        variants = [(anchor["text"], [anchor])]
        variants.extend((f'{anchor["text"]} {item["text"]}', [anchor, item]) for item in same_row + adjacent)
        if same_row:
            variants.append((" ".join([anchor["text"], *(item["text"] for item in same_row[:3])]), [anchor, *same_row[:3]]))
        extracted = [(extractor(text), used) for text, used in variants]
        extracted = [(value, used) for value, used in extracted if value]
        if field == "mrp" and extracted:
            value, used = max(extracted, key=lambda candidate: (float(re.search(r"\d+(?:\.\d+)?", candidate[0]).group(0)) >= 1, bool(re.search(r"\.\d{2}\b", candidate[0])), -len(candidate[1])))
        elif extracted:
            value, used = extracted[0]
        else:
            value, used = "", []
        if value:
            found.append(_candidate(field, value, used, penalty))
    return found


def _after_anchor(pattern: re.Pattern, value: str) -> str:
    return pattern.sub("", value, count=1).strip(" :-,;")


def _batch_value(text: str) -> str:
    remainder = _after_anchor(ANCHORS["batch_number"], text)
    return next((
        match.group(0).upper()
        for match in BATCH.finditer(remainder)
        if re.search(r"\d", match.group(0))
        and not (match.group(0).isdigit() and 10 <= len(match.group(0)) <= 14)
    ), "")


def extract_declarations(lines: Iterable[dict[str, Any]]) -> dict[str, Any]:
    by_image: dict[str, list[dict[str, Any]]] = {}
    for line in lines:
        text = re.sub(r"\s+", " ", str(line.get("text", ""))).strip()
        if text:
            by_image.setdefault(line["image_id"], []).append({**line, "text": text})

    candidates: dict[str, list[dict[str, Any]]] = {field: [] for field in (*ANCHORS, "responsible_party_address", "consumer_phone", "consumer_email", "barcode", "product_name")}
    for image_lines in by_image.values():
        candidates["net_quantity"] += _extract_labeled("net_quantity", image_lines, _normalize_quantity)

        def mrp_value(text: str) -> str:
            remainder = _after_anchor(ANCHORS["mrp"], text)
            amount = _normalize_price(remainder)
            if not amount:
                return ""
            taxes = " inclusive of all taxes" if re.search(r"(?:incl|all\s+tax)", text, re.I) else ""
            return f"MRP ₹{amount}{taxes}"
        candidates["mrp"] += _extract_labeled("mrp", image_lines, mrp_value)
        for item in image_lines:
            if not ANCHORS["mrp"].search(item["text"]) and re.search(r"₹|\brs\.?\s|\binr\b", item["text"], re.I) and not re.search(r"\bper\b|/\s*(?:g|kg|ml|l)\b", item["text"], re.I):
                amount = _normalize_price(item["text"])
                if amount:
                    taxes = " inclusive of all taxes" if re.search(r"(?:incl|all\s+tax)", item["text"], re.I) else ""
                    candidates["mrp"].append(_candidate("mrp", f"MRP ₹{amount}{taxes}", [item], .08))

        def unit_price(text: str) -> str:
            price = _normalize_price(_after_anchor(ANCHORS["unit_sale_price"], text))
            per = re.search(r"(?:per|/)\s*(?:g|kg|ml|l|m|cm|unit|number)\b", text, re.I)
            return f"₹{price} {per.group(0)}" if price and per else ""
        candidates["unit_sale_price"] += _extract_labeled("unit_sale_price", image_lines, unit_price)

        for field in ("manufacture_pack_import_date", "best_before_or_use_by"):
            candidates[field] += _extract_labeled(field, image_lines, _normalize_date)

        candidates["batch_number"] += _extract_labeled("batch_number", image_lines, _batch_value)
        candidates["fssai_license"] += _extract_labeled("fssai_license", image_lines, lambda text: FSSAI.search(text).group(0) if FSSAI.search(text) else "")

        for anchor in image_lines:
            text = anchor["text"]
            if ANCHORS["country_of_origin"].search(text):
                value = _after_anchor(ANCHORS["country_of_origin"], text)
                if value: candidates["country_of_origin"].append(_candidate("country_of_origin", value.title(), [anchor]))
            if ANCHORS["commodity_name"].search(text):
                value = _after_anchor(ANCHORS["commodity_name"], text)
                if len(value) >= 3: candidates["commodity_name"].append(_candidate("commodity_name", value, [anchor]))
            if ANCHORS["responsible_party_name"].search(text):
                value = _after_anchor(ANCHORS["responsible_party_name"], text)
                nearby = _near(anchor, image_lines, 9)
                if not COMPANY.search(value):
                    company_line = next((item for item in nearby if COMPANY.search(item["text"])), None)
                    if company_line: value = company_line["text"]
                if COMPANY.search(value): candidates["responsible_party_name"].append(_candidate("responsible_party_name", value, [anchor]))
                address_lines = [item for item in nearby if ADDRESS_HINT.search(item["text"]) and not ANCHORS["responsible_party_name"].search(item["text"])]
                if address_lines:
                    address_lines.sort(key=lambda item: (_center(item)[1], _center(item)[0]))
                    candidates["responsible_party_address"].append(_candidate("responsible_party_address", " ".join(item["text"] for item in address_lines[:3]), address_lines[:3]))
            if ANCHORS["consumer_care"].search(text) or EMAIL.search(text) or PHONE.search(text):
                nearby_text = " ".join(item["text"] for item in _near(anchor, image_lines, 8))
                email = EMAIL.search(f"{text} {nearby_text}")
                phone = PHONE.search(f"{text} {nearby_text}")
                parts = [match.group(0) for match in (email, phone) if match]
                if parts: candidates["consumer_care"].append(_candidate("consumer_care", " · ".join(parts), [anchor]))
                if email: candidates["consumer_email"].append(_candidate("consumer_email", email.group(0), [anchor]))
                if phone: candidates["consumer_phone"].append(_candidate("consumer_phone", re.sub(r"[\s-]", "", phone.group(0)), [anchor]))
            fssai = FSSAI.search(text)
            if fssai and re.search(r"fssai|ssai|lic", text, re.I): candidates["fssai_license"].append(_candidate("fssai_license", fssai.group(0), [anchor]))
            barcode = BARCODE.fullmatch(re.sub(r"\s", "", text))
            if barcode and not FSSAI.fullmatch(barcode.group(0)) and not PHONE.fullmatch(barcode.group(0)): candidates["barcode"].append(_candidate("barcode", barcode.group(0), [anchor], .05))

        # Product display name: prominent non-legal, non-nutrition text. It is kept
        # separate from the statutory common/generic commodity declaration.
        display = []
        for item in image_lines:
            text = item["text"].strip()
            box = item.get("bbox") or [0, 0, 0, 0]
            height = box[3] - box[1]
            width = box[2] - box[0]
            heights = [max(1, (line.get("bbox") or [0, 0, 0, 0])[3] - (line.get("bbox") or [0, 0, 0, 0])[1]) for line in image_lines]
            median_height = sorted(heights)[len(heights) // 2] if heights else 1
            # A front panel often contains only a handful of large display lines;
            # using its own large median as a 1.25x threshold discarded every
            # valid name (for example, CHOCOLATE / Desire on two adjacent lines).
            prominence_ratio = .85 if len(image_lines) <= 8 else 1.25
            if _valid_product_text(text) and height >= max(24, median_height * prominence_ratio):
                # Display names tend to be large, wide text on a front panel.
                # Confidence breaks ties, but cannot make a URL or identifier a name.
                display.append((height * 2.2 + min(width, 900) * .03 + item["confidence"] * 20, item))
        if display:
            _, best = max(display, key=lambda pair: pair[0])
            _, best_y = _center(best)
            best_height = max(16, (best.get("bbox") or [0, 0, 0, 0])[3] - (best.get("bbox") or [0, 0, 0, 0])[1])
            best_key = re.sub(r"[^a-z0-9]", "", _clean_product_text(best["text"]).lower())
            companion = next((item for _, item in sorted(display, key=lambda pair: pair[0], reverse=True)
                              if item is not best and abs(_center(item)[1] - best_y) <= best_height * 2.8
                              and (candidate_key := re.sub(r"[^a-z0-9]", "", _clean_product_text(item["text"]).lower()))
                              and candidate_key not in best_key and best_key not in candidate_key
                              and not re.search(r"\b(?:ingredients?|nutrition|servings?)\b", item["text"], re.I)), None)
            parts = [best] + ([companion] if companion else [])
            parts.sort(key=lambda item: (_center(item)[1], _center(item)[0]))
            value = " ".join(_clean_product_text(item["text"]) for item in parts)
            # A lone prominent word is normally brand evidence, not sufficient
            # evidence of the full product identity. Keep it separate so a later
            # camera angle cannot replace a complete product name with one word.
            if companion or len(value.split()) >= 2:
                candidates["product_name"].append(_candidate("product_name", value.title(), parts, .05))

    fields: dict[str, dict[str, Any]] = {}
    for field, items in candidates.items():
        ranked = _dedupe_rank(items)
        if ranked:
            ranked.sort(key=lambda item: _evidence_strength(field, item), reverse=True)
            fields[field] = {**ranked[0], "alternatives": ranked[1:4]}
    return fields
