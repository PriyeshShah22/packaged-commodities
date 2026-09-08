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
ADDRESS_HINT = re.compile(r"\b(?:address|road|rd\.?|street|st\.?|line|lane|industrial|estate|district|dist\.?|post|p\.?o\.?|city|state|india|pincode|pin|plot|sector|chamber|village|taluka|nagar|colony|phase|block|building|floor|survey|unit)\b|\b\d{6}\b", re.I)
NUTRITION = re.compile(r"\b(?:nutrition|serving|protein|fat|sodium|sugar|carbohydrate|calories|kcal|fibre|cholesterol|rda|ingredients?|allergens?|contains?|traces?)\b", re.I)
INGREDIENTS_ANCHOR = re.compile(r"\bingredients?\b\s*[:.-]?", re.I)
NUTRITION_HEADER = re.compile(r"\b(?:nutrition(?:al)?\s+(?:facts?|information)|amount\s+per\s+serving)\b", re.I)
NUTRIENT_LINE = re.compile(r"\b(?:energy|calories?|kcal|protein|total\s+fat|saturated\s+fat|trans\s+fat|cholesterol|sod+i+um|carbohydrates?|dietary\s+fib(?:re|er)|total\s+sugars?|added\s+sugars?|serving\s+size)\b", re.I)
SECTION_BOUNDARY = re.compile(r"\b(?:allergen|storage|consumer\s+care|manufactured|marketed|packed|net\s+(?:quantity|weight)|m\s*\.?\s*r\s*\.?\s*p|batch|fssai)\b", re.I)
GENERIC_LABEL = re.compile(r"\b(?:net|mrp|batch|mfg|mfd|expiry|use by|consumer|manufactured|marketed|fssai|lic[\s.]*no|quantity|price|date|address|qr\s*code|follow\s+us|website|incl(?:usive)?|tax(?:es)?)\b", re.I)
PRODUCT_REJECT = re.compile(r"\b(?:www|https?|email|phone|mobile|contact|feedback|queries|customer|consumer|allergens?|contains?|traces?|facility|fssai|issai|licen[cs]e|barcode|gtin|batch|lot|manufactured|marketed|packed|imported|address|road|street|line|lane|pincode|pin|regn|registration|gpcb|pwr|preservatives?|permitted|emulsifiers?|stabili[sz]ers?|acidity\s+regulators?|starch|class\s+[ivx]+|ins\s*\(?\s*\d|e\s*\(?\s*\d{3}|potential\s+issue|needs?\s+review|non[ -]?compliant|per\s+(?:lit|litre|kg|g|ml)|net\s*weight|natural\s+feature\s+of\s+product|sourced\s+direct|premium\s+quality|wholesome\s+goodness)\b", re.I)


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
    elif field in {"brand_name", "product_name", "commodity_name", "responsible_party_name", "responsible_party_address", "ingredients", "nutrition_information"}:
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

        variants = [(anchor["text"], [anchor], 0.0)]
        # Evaluate every spatially close label/value pair. OCR commonly emits a
        # small "MRP" label and a larger price as separate boxes, sometimes on
        # slightly different baselines. Ranking all pairs is more reliable than
        # assuming the value is the first OCR line after the label.
        for item in same_row + adjacent:
            item_x, item_y = _center(item)
            row_delta = abs(item_y - anchor_y) / max(anchor_height, 1)
            horizontal_gap = max(0, item_x - anchor_x) / max(anchor_width, 1)
            spatial_penalty = min(.12, row_delta * .018 + horizontal_gap * .006)
            variants.append((f'{anchor["text"]} {item["text"]}', [anchor, item], spatial_penalty))
        if same_row:
            variants.append((" ".join([anchor["text"], *(item["text"] for item in same_row[:3])]), [anchor, *same_row[:3]], .015))
        for text, used, spatial_penalty in variants:
            value = extractor(text)
            if value:
                found.append(_candidate(field, value, used, penalty + spatial_penalty))
    return found


def _after_anchor(pattern: re.Pattern, value: str) -> str:
    return pattern.sub("", value, count=1).strip(" :-,;")


def _batch_value(text: str) -> str:
    anchor = ANCHORS["batch_number"].search(text)
    if not anchor:
        return ""
    remainder = text[anchor.end():].strip(" :-,;")
    for match in BATCH.finditer(remainder):
        token = match.group(0)
        if not re.search(r"\d", token) or (token.isdigit() and 10 <= len(token) <= 14):
            continue
        # Legal/help prose can mention "batch no." and contain an unrelated
        # number later in the sentence. A declaration places its value directly
        # after the label, with at most a short connector such as "is".
        intervening_words = re.findall(r"[A-Za-z]{2,}", remainder[:match.start()])
        if len(intervening_words) > 1:
            continue
        return token.upper()
    return ""


def _inside_nutrition_table(item: dict[str, Any], image_lines: list[dict[str, Any]]) -> bool:
    """Identify quantities belonging to a nutrition row by spatial context."""
    item_box = item.get("bbox") or [0, 0, 0, 0]
    item_x, item_y = _center(item)
    item_height = max(12, item_box[3] - item_box[1])
    for label in image_lines:
        if label is item or not (NUTRIENT_LINE.search(label["text"]) or NUTRITION_HEADER.search(label["text"])):
            continue
        label_box = label.get("bbox") or [0, 0, 0, 0]
        _label_x, label_y = _center(label)
        same_row = abs(item_y - label_y) <= max(12, item_height * .8)
        follows_label = label_box[0] - 15 <= item_x and item_box[0] - label_box[2] <= 420
        if same_row and follows_label:
            return True
    return False


def extract_declarations(lines: Iterable[dict[str, Any]]) -> dict[str, Any]:
    by_image: dict[str, list[dict[str, Any]]] = {}
    for line in lines:
        text = re.sub(r"\s+", " ", str(line.get("text", ""))).strip()
        if text:
            by_image.setdefault(line["image_id"], []).append({**line, "text": text})

    candidates: dict[str, list[dict[str, Any]]] = {field: [] for field in (*ANCHORS, "responsible_party_address", "consumer_phone", "consumer_email", "barcode", "brand_name", "product_name", "ingredients", "nutrition_information")}
    for image_lines in by_image.values():
        candidates["net_quantity"] += _extract_labeled("net_quantity", image_lines, _normalize_quantity)
        heights = [max(1, item["bbox"][3] - item["bbox"][1]) for item in image_lines if item.get("bbox")]
        median_height = sorted(heights)[len(heights) // 2] if heights else 1
        for item in image_lines:
            quantity = _normalize_quantity(item["text"])
            box = item.get("bbox") or [0, 0, 0, 0]
            if (
                quantity
                and QUANTITY.fullmatch(item["text"].strip())
                and box[3] - box[1] >= median_height
                and not _inside_nutrition_table(item, image_lines)
            ):
                # A standalone, visually prominent quantity is common on the
                # white stamp panel even when its faint "Net Weight" caption is
                # missed. Keep a modest penalty so an explicit label wins.
                candidates["net_quantity"].append(_candidate("net_quantity", quantity, [item], .12))

        def mrp_value(text: str) -> str:
            remainder = _after_anchor(ANCHORS["mrp"], text)
            if re.search(r"(?:[0-3]?\d[./-]){2}\d{2,4}|(?:19|20)\d{2}", remainder):
                return ""
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
            remainder = _after_anchor(ANCHORS["unit_sale_price"], text)
            if re.search(r"(?:[0-3]?\d[./-]){2}\d{2,4}|(?:19|20)\d{2}", remainder):
                return ""
            price = _normalize_price(remainder)
            per = re.search(r"(?:per|/)\s*(g|kg|ml|l|m|cm|unit|number)\b", text, re.I)
            return f"₹{price} per {per.group(1)}" if price and per else ""
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
                company_line = None
                if not COMPANY.search(value):
                    company_line = next((item for item in nearby if COMPANY.search(item["text"])), None)
                    if company_line: value = company_line["text"]
                party_source = company_line or anchor
                if COMPANY.search(value): candidates["responsible_party_name"].append(_candidate("responsible_party_name", value, [party_source]))
                # Postal addresses are commonly split into several OCR boxes and
                # only one line contains an obvious word such as "Road" or a PIN.
                # Start with a genuine address signal, then retain adjacent lines
                # in the same printed block instead of requiring every line to
                # contain a location keyword.
                address_seeds = [item for item in nearby if item is not party_source and ADDRESS_HINT.search(item["text"]) and not ANCHORS["responsible_party_name"].search(item["text"])]
                address_lines = []
                if address_seeds:
                    seed = min(address_seeds, key=lambda item: abs(_center(item)[1] - _center(party_source)[1]))
                    seed_x, seed_y = _center(seed)
                    seed_height = max(16, seed["bbox"][3] - seed["bbox"][1])
                    for item in image_lines:
                        item_x, item_y = _center(item)
                        words = re.findall(r"[A-Za-z]{2,}", item["text"])
                        competing_label = any(pattern.search(item["text"]) for name, pattern in ANCHORS.items() if name != "responsible_party_name")
                        if (item not in (anchor, party_source) and not competing_label and not NUTRITION.search(item["text"])
                                and abs(item_y - seed_y) <= max(90, seed_height * 4.5)
                                and abs(item_x - seed_x) <= 480 and words):
                            address_lines.append(item)
                if address_lines:
                    address_lines.sort(key=lambda item: (_center(item)[1], _center(item)[0]))
                    address_lines = address_lines[:4]
                    candidates["responsible_party_address"].append(_candidate("responsible_party_address", " ".join(item["text"] for item in address_lines), address_lines, .02))
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

        # Ingredient text is a content block, not a single label/value line.
        # Collect nearby following lines until another package section begins.
        ordered_lines = sorted(image_lines, key=lambda item: (_center(item)[1], _center(item)[0]))
        for anchor in ordered_lines:
            if not INGREDIENTS_ANCHOR.search(anchor["text"]):
                continue
            anchor_x, anchor_y = _center(anchor)
            anchor_height = max(16, anchor["bbox"][3] - anchor["bbox"][1])
            parts = []
            remainder = INGREDIENTS_ANCHOR.sub("", anchor["text"], count=1).strip(" :-,.;")
            ingredient_remainder = re.split(
                r"\b(?:allergens?|may\s+contain|facility|traces?|for\s+feedback)\b",
                remainder,
                maxsplit=1,
                flags=re.I,
            )[0].strip(" :-,.;")
            if len(re.findall(r"[A-Za-z]", ingredient_remainder)) >= 3:
                parts.append({**anchor, "text": ingredient_remainder})
            for item in ordered_lines:
                if item is anchor:
                    continue
                item_x, item_y = _center(item)
                if item_y <= anchor_y or item_y - anchor_y > max(300, anchor_height * 10):
                    continue
                item_box = item.get("bbox") or [0, 0, 0, 0]
                anchor_box = anchor.get("bbox") or [0, 0, 0, 0]
                same_column = item_box[0] <= anchor_box[2] + 80 and item_box[2] >= anchor_box[0] - 80
                if not same_column or abs(item_x - anchor_x) > 420:
                    continue
                if NUTRITION_HEADER.search(item["text"]) or SECTION_BOUNDARY.search(item["text"]):
                    break
                if float(item.get("confidence", 0)) >= .6 and len(re.findall(r"[A-Za-z]", item["text"])) >= 3:
                    parts.append(item)
                if len(parts) >= 6:
                    break
            if parts:
                value = re.sub(r"\s+", " ", " ".join(item["text"].strip(" ,;") for item in parts)).strip(" ,;")
                candidates["ingredients"].append(_candidate("ingredients", value, [anchor, *parts], .03))
                # A single-ingredient package often declares its commodity only
                # in the Ingredients line (for example, "Cashew Kernels"). This
                # is stronger product identity evidence than nearby slogans.
                identity = ingredient_remainder
                if 1 <= len(identity.split()) <= 5 and len(re.findall(r"[A-Za-z]", identity)) >= 4:
                    identity_source = {**anchor, "text": identity}
                    commodity = _candidate("commodity_name", identity.title(), [identity_source], .1)
                    product = _candidate("product_name", identity.title(), [identity_source], .1)
                    commodity["source_type"] = "ingredient_identity"
                    product["source_type"] = "ingredient_identity"
                    candidates["commodity_name"].append(commodity)
                    candidates["product_name"].append(product)

        nutrition_rows = []
        nutrition_sources = []
        for label in ordered_lines:
            if not NUTRIENT_LINE.search(label["text"]) or INGREDIENTS_ANCHOR.search(label["text"]):
                continue
            if re.match(r"\s*\d", label["text"]):
                continue
            if len(label["text"]) > 45 and not re.match(r"\s*(?:serving\s+size|total\s+carbohydrate)", label["text"], re.I):
                continue
            label_x, label_y = _center(label)
            label_height = max(16, label["bbox"][3] - label["bbox"][1])
            values = [item for item in ordered_lines if item is not label
                      and (item.get("bbox") or [0, 0, 0, 0])[0] >= label["bbox"][2] - 5
                      and abs(_center(item)[1] - label_y) <= max(8, label_height * .4)
                      and _center(item)[0] - label_x <= 360
                      and re.search(r"\d", item["text"])]
            values.sort(key=lambda item: _center(item)[0])
            row_sources = [label, *values[:2]]
            nutrition_rows.append(" ".join(item["text"].strip(" ;") for item in row_sources))
            nutrition_sources.extend(row_sources)
        if nutrition_rows:
            value = "; ".join(dict.fromkeys(nutrition_rows))
            candidates["nutrition_information"].append(_candidate("nutrition_information", value, nutrition_sources, .04))

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
                if float(item.get("confidence", 0)) >= .65:
                    display.append((height * 1.2 + min(width, 900) * .12 + item["confidence"] * 20, item))
        if display:
            _, best = max(display, key=lambda pair: pair[0])
            _, best_y = _center(best)
            best_height = max(16, (best.get("bbox") or [0, 0, 0, 0])[3] - (best.get("bbox") or [0, 0, 0, 0])[1])
            best_key = re.sub(r"[^a-z0-9]", "", _clean_product_text(best["text"]).lower())
            # A product descriptor is normally the dominant display line. A
            # smaller line directly beneath it may be a variant; a distinct line
            # above it is retained separately as brand evidence.
            companion = next((item for _, item in sorted(display, key=lambda pair: pair[0], reverse=True)
                              if item is not best and 0 < _center(item)[1] - best_y <= best_height * 2.8
                              and ((item.get("bbox") or [0, 0, 0, 0])[3] - (item.get("bbox") or [0, 0, 0, 0])[1]) >= best_height * .35
                              and (candidate_key := re.sub(r"[^a-z0-9]", "", _clean_product_text(item["text"]).lower()))
                              and candidate_key not in best_key and best_key not in candidate_key), None)
            brand = next((item for _, item in sorted(display, key=lambda pair: _center(pair[1])[1])
                          if item is not best and item is not companion and _center(item)[1] < best_y
                          and best_y - _center(item)[1] <= best_height * 5), None)
            if brand:
                brand_x, brand_y = _center(brand)
                brand_height = max(14, brand["bbox"][3] - brand["bbox"][1])
                brand_companion = next((item for item in ordered_lines
                                        if item not in (best, companion, brand)
                                        and 0 < _center(item)[1] - brand_y <= brand_height * 1.8
                                        and abs(_center(item)[0] - brand_x) <= max(120, brand["bbox"][2] - brand["bbox"][0])
                                        and float(item.get("confidence", 0)) >= .65
                                        and 2 <= len(re.findall(r"[A-Za-z]", item["text"])) <= 20
                                        and not GENERIC_LABEL.search(item["text"])
                                        and not NUTRITION.search(item["text"])), None)
                brand_parts = [brand] + ([brand_companion] if brand_companion else [])
                brand_parts.sort(key=lambda item: (_center(item)[1], _center(item)[0]))
                brand_value = " ".join(_clean_product_text(item["text"]) for item in brand_parts)
                candidates["brand_name"].append(_candidate("brand_name", brand_value.title(), brand_parts, .04))
            elif not companion:
                candidates["brand_name"].append(_candidate("brand_name", _clean_product_text(best["text"]).title(), [best], .07))
            parts = [best] + ([companion] if companion else [])
            parts.sort(key=lambda item: (_center(item)[1], _center(item)[0]))
            value = " ".join(_clean_product_text(item["text"]) for item in parts)
            # A lone prominent word is normally brand evidence, not sufficient
            # evidence of the full product identity. Keep it separate so a later
            # camera angle cannot replace a complete product name with one word.
            if brand or companion or len(value.split()) >= 2:
                candidates["product_name"].append(_candidate("product_name", value.title(), parts, .05 if companion else .08))

    fields: dict[str, dict[str, Any]] = {}
    for field, items in candidates.items():
        ranked = _dedupe_rank(items)
        if field == "brand_name":
            ranked = [item for item in ranked if _valid_product_text(item["value"])]
        if ranked:
            ranked.sort(key=lambda item: _evidence_strength(field, item), reverse=True)
            fields[field] = {**ranked[0], "alternatives": ranked[1:4]}

    def price_amount(field: str) -> float | None:
        match = re.search(r"\d+(?:\.\d+)?", str(fields.get(field, {}).get("value", "")))
        return float(match.group(0)) if match else None

    mrp_amount = price_amount("mrp")
    unit_amount = price_amount("unit_sale_price")
    quantity_match = re.search(r"(\d+(?:\.\d+)?)\s*(kg|g|ml|L)\b", str(fields.get("net_quantity", {}).get("value", "")), re.I)
    if mrp_amount and not unit_amount and quantity_match and float(quantity_match.group(1)) == 1:
        unit_labels = [
            line for image_lines in by_image.values() for line in image_lines
            if ANCHORS["unit_sale_price"].search(line["text"])
        ]
        if unit_labels:
            unit = quantity_match.group(2)
            amount = f"{mrp_amount:.2f}" if "." in fields["mrp"]["value"] else f"{mrp_amount:g}"
            source = [unit_labels[0]]
            fields["unit_sale_price"] = {
                **_candidate("unit_sale_price", f"₹{amount} per {unit}", source, .2),
                "confidence": min(.69, fields["mrp"]["confidence"], fields["net_quantity"]["confidence"]),
                "alternatives": [],
                "inference": "Calculated from a visible unit-sale-price label, MRP, and net quantity of one base unit",
            }
            unit_amount = mrp_amount
    unit_match = re.search(r"per\s*(kg|g|ml|L)\b", str(fields.get("unit_sale_price", {}).get("value", "")), re.I)
    if mrp_amount and unit_amount and quantity_match and unit_match:
        quantity = float(quantity_match.group(1))
        quantity_unit = quantity_match.group(2).lower()
        unit = unit_match.group(1).lower()
        if quantity_unit == unit:
            expected = quantity * unit_amount
        elif quantity_unit == "kg" and unit == "g":
            expected = quantity * 1000 * unit_amount
        elif quantity_unit == "l" and unit == "ml":
            expected = quantity * 1000 * unit_amount
        else:
            expected = 0
        if expected > 0 and abs(mrp_amount - expected) / expected > .25:
            raw_digits = re.sub(r"\D", "", fields["mrp"].get("raw_text", ""))
            bases = [mrp_amount]
            if "." not in fields["mrp"].get("raw_text", "") and len(raw_digits) >= 3:
                bases.append(int(raw_digits) / 100)
            repairs = []
            for base in bases:
                rendered = f"{base:.2f}"
                tail = rendered[1:] if len(rendered.split(".", 1)[0]) >= 2 else rendered
                for leading in range(1, 10):
                    candidate = float(f"{leading}{tail}")
                    repairs.append(candidate)
            repaired = min(repairs, key=lambda value: abs(value - expected), default=mrp_amount)
            if abs(repaired - expected) / expected <= .05:
                taxes = " inclusive of all taxes" if "inclusive" in fields["mrp"]["value"].lower() else ""
                fields["mrp"] = {
                    **fields["mrp"],
                    "value": f"MRP ₹{repaired:.2f}{taxes}",
                    "confidence": round(max(.5, min(
                        fields["mrp"]["confidence"],
                        fields["net_quantity"]["confidence"],
                        fields["unit_sale_price"]["confidence"],
                    ) - .08), 4),
                    "inference": "Cross-checked against net quantity and declared unit sale price",
                }
                mrp_amount = repaired
    if mrp_amount and mrp_amount >= 1000 and "." not in fields["mrp"]["value"]:
        # A long integer MRP is frequently a dropped decimal or joined OCR row.
        # Keep it visible for review, but never present it as high-confidence.
        fields["mrp"]["confidence"] = min(fields["mrp"]["confidence"], .69)
    if mrp_amount and unit_amount and unit_amount > max(100000, mrp_amount * 10):
        alternatives = [item for item in fields["unit_sale_price"].get("alternatives", [])
                        if (match := re.search(r"\d+(?:\.\d+)?", item["value"]))
                        and float(match.group(0)) <= max(100000, mrp_amount * 10)]
        if alternatives:
            fields["unit_sale_price"] = {**alternatives[0], "alternatives": alternatives[1:4]}
        else:
            fields.pop("unit_sale_price", None)
    return fields
