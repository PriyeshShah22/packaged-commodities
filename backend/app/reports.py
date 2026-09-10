import base64
import os
import re
from io import BytesIO
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import HRFlowable, Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

# Corporate Palette matching PackMetrix MNC standards
NAVY = colors.HexColor("#0B1224")
NAVY_LIGHT = colors.HexColor("#1E293B")
BLUE = colors.HexColor("#0284C7")
BLUE_LIGHT = colors.HexColor("#E0F2FE")
SLATE = colors.HexColor("#475569")
SLATE_MUTED = colors.HexColor("#64748B")
BORDER = colors.HexColor("#E2E8F0")
BORDER_STRONG = colors.HexColor("#CBD5E1")
PALE = colors.HexColor("#F8FAFC")
PALE_WARM = colors.HexColor("#FAF8F5")

GREEN = colors.HexColor("#059669")
GREEN_BG = colors.HexColor("#ECFDF5")
GREEN_BORDER = colors.HexColor("#A7F3D0")

AMBER = colors.HexColor("#D97706")
AMBER_BG = colors.HexColor("#FFFBEB")
AMBER_BORDER = colors.HexColor("#FDE68A")

RED = colors.HexColor("#DC2626")
RED_BG = colors.HexColor("#FEF2F2")
RED_BORDER = colors.HexColor("#FECACA")


def _register_fonts() -> tuple[str, str]:
    regular = r"C:\Windows\Fonts\arial.ttf"
    bold = r"C:\Windows\Fonts\arialbd.ttf"
    if os.path.exists(regular) and os.path.exists(bold):
        if "PMRegular" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont("PMRegular", regular))
            pdfmetrics.registerFont(TTFont("PMBold", bold))
        return "PMRegular", "PMBold"
    return "Helvetica", "Helvetica-Bold"


REGULAR_FONT, BOLD_FONT = _register_fonts()


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_header_footer(num_pages)
            super().showPage()
        super().save()

    def draw_header_footer(self, page_count):
        self.saveState()
        width, height = A4
        margin = 14 * mm

        # Running Header (Top)
        self.setStrokeColor(BORDER)
        self.setLineWidth(0.5)
        self.line(margin, height - 12 * mm, width - margin, height - 12 * mm)

        self.setFont(BOLD_FONT, 7)
        self.setFillColor(NAVY)
        self.drawString(margin, height - 10 * mm, "PACKMETRIX")
        self.setFont(REGULAR_FONT, 7)
        self.setFillColor(SLATE_MUTED)
        self.drawString(margin + 20 * mm, height - 10 * mm, "|   LEGAL METROLOGY STATUTORY INSPECTION DOSSIER")

        self.setFont(REGULAR_FONT, 6.5)
        self.drawRightString(width - margin, height - 10 * mm, "LM(PC) RULES, 2011 // GSR 226(E)")

        # Running Footer (Bottom)
        self.setStrokeColor(BORDER)
        self.setLineWidth(0.5)
        self.line(margin, 12 * mm, width - margin, 12 * mm)

        self.setFont(REGULAR_FONT, 6.5)
        self.setFillColor(SLATE_MUTED)
        self.drawString(
            margin,
            8 * mm,
            "CONFIDENTIAL & OFFICIAL RECORD  —  AI-assisted decision support. Final statutory determination remains with the designated enforcement officer."
        )

        self.setFont(BOLD_FONT, 7.5)
        self.setFillColor(NAVY)
        self.drawRightString(width - margin, 8 * mm, f"Page {self._pageNumber} of {page_count}")

        self.restoreState()


def _safe(value: Any, fallback: str = "Not reliably detected") -> str:
    val = str(value if value is not None and value != "" else fallback)
    return val.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="PMKicker", parent=styles["Normal"],
        fontName=BOLD_FONT, fontSize=7, leading=9, textColor=BLUE, spaceAfter=2
    ))
    styles.add(ParagraphStyle(
        name="PMTitle", parent=styles["Title"],
        fontName=BOLD_FONT, fontSize=17, leading=21, textColor=NAVY, alignment=TA_LEFT, spaceAfter=2
    ))
    styles.add(ParagraphStyle(
        name="PMSubtitle", parent=styles["Normal"],
        fontName=REGULAR_FONT, fontSize=8, leading=11, textColor=SLATE, spaceAfter=6
    ))
    styles.add(ParagraphStyle(
        name="PMSection", parent=styles["Heading2"],
        fontName=BOLD_FONT, fontSize=10, leading=13, textColor=NAVY, spaceBefore=4, spaceAfter=4
    ))
    styles.add(ParagraphStyle(
        name="PMBody", parent=styles["BodyText"],
        fontName=REGULAR_FONT, fontSize=8, leading=11.5, textColor=NAVY_LIGHT
    ))
    styles.add(ParagraphStyle(
        name="PMSmall", parent=styles["Normal"],
        fontName=REGULAR_FONT, fontSize=7, leading=9.5, textColor=SLATE
    ))
    styles.add(ParagraphStyle(
        name="PMLabel", parent=styles["Normal"],
        fontName=BOLD_FONT, fontSize=6.5, leading=8.5, textColor=SLATE_MUTED
    ))
    styles.add(ParagraphStyle(
        name="PMValue", parent=styles["Normal"],
        fontName=REGULAR_FONT, fontSize=8, leading=10.5, textColor=NAVY
    ))
    styles.add(ParagraphStyle(
        name="PMValueBold", parent=styles["Normal"],
        fontName=BOLD_FONT, fontSize=8, leading=10.5, textColor=NAVY
    ))
    styles.add(ParagraphStyle(
        name="PMStatus", parent=styles["Normal"],
        fontName=BOLD_FONT, fontSize=13, leading=16, textColor=NAVY
    ))
    styles.add(ParagraphStyle(
        name="PMTableHead", parent=styles["Normal"],
        fontName=BOLD_FONT, fontSize=7, leading=9.5, textColor=colors.white
    ))
    styles.add(ParagraphStyle(
        name="PMRight", parent=styles["Normal"],
        fontName=REGULAR_FONT, fontSize=7.5, leading=10.5, textColor=SLATE, alignment=TA_RIGHT
    ))
    styles.add(ParagraphStyle(
        name="PMCode", parent=styles["Normal"],
        fontName=REGULAR_FONT, fontSize=7, leading=9, textColor=NAVY_LIGHT
    ))
    return styles


def _status(report):
    if report.get("workflowStatus") == "RESOLVED":
        return "OFFICER VERIFIED / RESOLVED"
    return {"COMPLIANT": "PASS", "NON_COMPLIANT": "POTENTIAL ISSUE", "REVIEW": "REVIEW REQUIRED"}.get(
        report.get("status"), report.get("status") or "REVIEW REQUIRED"
    )


def _header_metadata(report, styles):
    rule_set = report.get("ruleSetAsOf") or report.get("ruleSetVersion") or "LM(PC) Rules, 2011"
    meta_data = [
        [
            Paragraph("<b>REPORT ID</b>", styles["PMLabel"]),
            Paragraph(_safe(report.get("id")), styles["PMValueBold"]),
            Paragraph("<b>BATCH / INTAKE ID</b>", styles["PMLabel"]),
            Paragraph(_safe(report.get("batchId"), "Single Intake"), styles["PMValue"]),
            Paragraph("<b>INSPECTING OFFICER</b>", styles["PMLabel"]),
            Paragraph(_safe(report.get("inspectorName")), styles["PMValueBold"]),
        ],
        [
            Paragraph("<b>INSPECTION ID</b>", styles["PMLabel"]),
            Paragraph(_safe(report.get("inspectionId") or report.get("id")), styles["PMCode"]),
            Paragraph("<b>INSPECTION DATE</b>", styles["PMLabel"]),
            Paragraph(_safe(report.get("date")), styles["PMValue"]),
            Paragraph("<b>STATUTORY RULESET</b>", styles["PMLabel"]),
            Paragraph(_safe(rule_set), styles["PMValue"]),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[24 * mm, 38 * mm, 26 * mm, 34 * mm, 26 * mm, 34 * mm])
    meta_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), PALE),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    return meta_table


def _summary(report, styles):
    counts = report.get("counts") or {}
    score = int(report.get("verificationScore", report.get("score") or 0))
    verification = report.get("verification") or {}
    total = int(verification.get("total", sum(int(counts.get(key, 0)) for key in ("PASS", "FAIL", "REVIEW"))))
    verified = int(verification.get("verified", int(counts.get("PASS", 0)) + int(counts.get("FAIL", 0))))
    if report.get('captureMode') == 'listing':
        score = int(100 * verified / total + .5) if total else 0
    status_str = _status(report)

    if status_str in ("PASS", "COMPLIANT"):
        status_bg = GREEN_BG
        status_text = GREEN
        status_border = GREEN_BORDER
        badge_label = "COMPLIANT"
    elif status_str in ("POTENTIAL ISSUE", "NON_COMPLIANT", "FAIL"):
        status_bg = RED_BG
        status_text = RED
        status_border = RED_BORDER
        badge_label = "POTENTIAL ISSUE"
    else:
        status_bg = AMBER_BG
        status_text = AMBER
        status_border = AMBER_BORDER
        badge_label = "REVIEW REQUIRED"

    status_cell = [
        Paragraph("STATUTORY ASSESSMENT", styles["PMLabel"]),
        Spacer(1, 1.5 * mm),
        Paragraph(f"<font color='{status_text.hexval()}'><b>{badge_label}</b></font>", styles["PMStatus"]),
        Spacer(1, 1 * mm),
        Paragraph(
            "Screening of store-supplied inventory; physical package verification is pending." if report.get('captureMode') == 'listing' else "Evaluation based on photographic package evidence under Legal Metrology Rules.",
            styles["PMSmall"]
        ),
    ]

    verification_cell = [
        Paragraph("EVIDENCE VERIFICATION", styles["PMLabel"]),
        Spacer(1, 1.5 * mm),
        Paragraph(f"<b>{verified}/{total} checks verified</b>", styles["PMValueBold"]),
        Spacer(1, 1 * mm),
        Paragraph(f"{'Verification completeness' if report.get('captureMode') == 'listing' else 'Compliance Index'}: <b>{score}%</b>", styles["PMBody"]),
        Paragraph("Automated deterministic validation", styles["PMSmall"]),
    ]

    findings_cell = [
        Paragraph("FINDINGS BREAKDOWN", styles["PMLabel"]),
        Spacer(1, 1.5 * mm),
        Paragraph(f"<font color='{GREEN.hexval()}'><b>{counts.get('PASS', 0)}</b></font> passed checks", styles["PMBody"]),
        Paragraph(f"<font color='{RED.hexval()}'><b>{counts.get('FAIL', 0)}</b></font> potential violations", styles["PMBody"]),
        Paragraph(f"<font color='{AMBER.hexval()}'><b>{counts.get('REVIEW', 0)}</b></font> need officer verification", styles["PMBody"]),
    ]

    table = Table([[status_cell, verification_cell, findings_cell]], colWidths=[66 * mm, 56 * mm, 60 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), status_bg),
        ("BACKGROUND", (1, 0), (1, 0), PALE),
        ("BACKGROUND", (2, 0), (2, 0), PALE),
        ("BOX", (0, 0), (0, 0), 0.75, status_border),
        ("BOX", (1, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    return table


def _details(report, styles):
    d = report.get("details") or {}
    f = report.get("declarations") or {}

    product_name = d.get("productName") or f.get("commodity_name") or "Unidentified Product"
    barcode = f.get("barcode") or d.get("productId") or "Not detected"

    name_banner = Table(
        [[
            Paragraph("<b>COMMERCIAL PRODUCT IDENTIFIER:</b>", styles["PMLabel"]),
            Paragraph(f"<b>{_safe(product_name)}</b>", ParagraphStyle(
                name="PMProdHeader", parent=styles["PMValueBold"], fontSize=9.5, leading=12, textColor=NAVY
            )),
            Paragraph(f"GTIN / BARCODE: <b>{_safe(barcode)}</b>", styles["PMRight"]),
        ]],
        colWidths=[40 * mm, 96 * mm, 46 * mm]
    )
    name_banner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EFF6FF")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#BFDBFE")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))

    entries = [
        ("Common / generic name", f.get("commodity_name")),
        ("Net quantity (Rule 6(1)(c))", f.get("net_quantity")),
        ("Maximum retail price (MRP)", f.get("mrp")),
        ("Unit sale price (USP)", f.get("unit_sale_price")),
        ("Manufacturer / packer", f.get("responsible_party_name")),
        ("Registered address", f.get("responsible_party_address")),
        ("Mfg / pack / import date", f.get("manufacture_pack_import_date")),
        ("Best before / use by date", f.get("best_before_or_use_by")),
        ("Batch / lot number", f.get("batch_number")),
        ("Country of origin", f.get("country_of_origin")),
        ("Consumer care phone", f.get("consumer_phone")),
        ("Consumer care email", f.get("consumer_email")),
        ("FSSAI licence number", f.get("fssai_license")),
        ("Sales context / category", f"{d.get('salesContext', 'Retail').title()} / {d.get('category', 'General').title()}"),
    ]

    rows = []
    for i in range(0, len(entries), 2):
        left = entries[i]
        right = entries[i + 1] if i + 1 < len(entries) else ("", "")
        rows.append([
            Paragraph(_safe(left[0]), styles["PMLabel"]),
            Paragraph(_safe(left[1]), styles["PMValueBold"] if "mrp" in left[0].lower() or "net quantity" in left[0].lower() else styles["PMValue"]),
            Paragraph(_safe(right[0]), styles["PMLabel"]),
            Paragraph(_safe(right[1]), styles["PMValueBold"] if "mrp" in right[0].lower() or "net quantity" in right[0].lower() else styles["PMValue"]),
        ])

    table = Table(rows, colWidths=[33 * mm, 58 * mm, 33 * mm, 58 * mm])
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("BACKGROUND", (0, 0), (0, -1), PALE),
        ("BACKGROUND", (2, 0), (2, -1), PALE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))

    return [name_banner, Spacer(1, 1.5 * mm), table]



def _evidence(report, styles):
    if report.get("captureMode") == "live":
        return []
    values = report.get("evidenceImages") or []
    if not values and report.get("thumbnail"):
        values = [{"imageId": "IMG-001", "fileName": "Submitted package evidence", "thumbnail": report["thumbnail"]}]

    cells = []
    for index, item in enumerate(values):
        value = str(item.get("thumbnail") if isinstance(item, dict) else item or "")
        try:
            if not value.startswith("data:image") or "," not in value:
                continue
            image = Image(BytesIO(base64.b64decode(value.split(",", 1)[1])))
            image._restrictSize(82 * mm, 42 * mm)
            image.hAlign = "CENTER"
            label = item.get("fileName") or item.get("imageId") or f"Package surface {index + 1}"
            img_id = item.get("imageId") or f"IMG-{index + 1:03d}"
            caption = [
                image,
                Spacer(1, 1 * mm),
                Paragraph(f"<b>{_safe(img_id)}</b>: {_safe(label)}", styles["PMSmall"])
            ]
            cells.append(caption)
        except Exception:
            continue

    if not cells:
        return []

    rows = [cells[i:i + 2] for i in range(0, len(cells), 2)]
    if len(rows[-1]) == 1:
        rows[-1].append(Spacer(1, 1))

    gallery = Table(rows, colWidths=[90 * mm, 90 * mm])
    gallery.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.35, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("BACKGROUND", (0, 0), (-1, -1), PALE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("PADDING", (0, 0), (-1, -1), 3),
    ]))

    return [
        gallery,
        Spacer(1, 1 * mm),
        Paragraph(f"{len(cells)} uploaded package surface image(s) retained for this product.", styles["PMSmall"])
    ]


def _composition(report, styles):
    fields = report.get("declarations") or {}
    ingredients = str(fields.get("ingredients") or "").strip()
    ingredient_letters = len(re.findall(r"[A-Za-z]", ingredients))
    ingredient_valid = ingredient_letters >= 3 and not re.search(r"@|https?://|www\.|\b(?:mrp|batch|consumer care)\b", ingredients, re.I)
    data = []
    if ingredient_valid:
        data.append([Paragraph("INGREDIENTS", styles["PMLabel"]), Paragraph(_safe(ingredients), styles["PMBody"])])
    if fields.get("nutrition_information"):
        data.append([Paragraph("NUTRITION INFORMATION", styles["PMLabel"]), Paragraph(_safe(fields.get("nutrition_information")), styles["PMBody"])])
    if not data:
        return Paragraph("No reliable ingredients or nutrition declaration was extracted.", styles["PMSmall"])
    table = Table(data, colWidths=[38 * mm, 144 * mm])
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("BACKGROUND", (0, 0), (0, -1), PALE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


def _transcript(report, styles):
    lines = report.get("ocrLines") or []
    if not lines:
        return [Paragraph("No OCR transcript was retained for this report.", styles["PMSmall"])]

    table_rows = []
    for i in range(0, len(lines), 2):
        left = lines[i]
        right = lines[i + 1] if i + 1 < len(lines) else None

        left_idx = i + 1
        left_conf = round(float(left.get("confidence") or 0) * 100)
        left_p = Paragraph(f"<b>{left_idx:02d}</b> &nbsp; {_safe(left.get('text'))} &nbsp; <font color='{GREEN.hexval()}'>{left_conf}%</font>", styles["PMCode"])

        if right:
            right_idx = i + 2
            right_conf = round(float(right.get("confidence") or 0) * 100)
            right_p = Paragraph(f"<b>{right_idx:02d}</b> &nbsp; {_safe(right.get('text'))} &nbsp; <font color='{GREEN.hexval()}'>{right_conf}%</font>", styles["PMCode"])
        else:
            right_p = Paragraph("", styles["PMCode"])

        table_rows.append([left_p, right_p])

    table = Table(table_rows, colWidths=[90 * mm, 90 * mm])
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.25, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ]))
    return [table]


def _finding(item, styles):
    outcome = item.get("resolvedOutcome") or item.get("outcome") or "REVIEW"
    if outcome in ("PASS", "COMPLIANT"):
        color = GREEN
        badge_bg = GREEN_BG
        badge_border = GREEN_BORDER
        badge_text = "PASS"
    elif outcome in ("FAIL", "VIOLATION"):
        color = RED
        badge_bg = RED_BG
        badge_border = RED_BORDER
        badge_text = "POTENTIAL ISSUE"
    else:
        color = AMBER
        badge_bg = AMBER_BG
        badge_border = AMBER_BORDER
        badge_text = "REVIEW REQUIRED"

    evidence = "; ".join(f"{e.get('field', '').replace('_', ' ').title()}: {e.get('value', '')}" for e in (item.get("evidence") or []) if e.get("value"))
    rule_ref = item.get("rule_reference") or item.get("rule_id")

    header_row = Table(
        [[
            Paragraph(f"<b>{_safe(item.get('requirement') or item.get('rule_id'))}</b>", styles["PMValueBold"]),
            Paragraph(f"<font color='{color.hexval()}'><b>{badge_text}</b></font>", styles["PMRight"]),
        ]],
        colWidths=[124 * mm, 46 * mm]
    )
    header_row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 0),
    ]))

    body = [header_row, Spacer(1, 1 * mm)]
    if evidence:
        body.append(Paragraph(f"<b>Detected Evidence:</b> {_safe(evidence)}", styles["PMSmall"]))
    body.append(Paragraph(f"<b>Reason:</b> {_safe(item.get('reason'))}", styles["PMSmall"]))
    body.append(Paragraph(f"<b>Legal reference:</b> {_safe(rule_ref)}", styles["PMSmall"]))
    if item.get("officerRemark"):
        body.append(Paragraph(f"<b>Officer remark:</b> {_safe(item.get('officerRemark'))}", styles["PMSmall"]))

    card = Table([[Spacer(1, 1), body]], colWidths=[2.5 * mm, 177.5 * mm])
    card.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), color),
        ("BACKGROUND", (1, 0), (1, 0), PALE),
        ("BOX", (0, 0), (-1, -1), 0.35, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 0),
        ("TOPPADDING", (0, 0), (0, 0), 0),
        ("BOTTOMPADDING", (0, 0), (0, 0), 0),
        ("LEFTPADDING", (1, 0), (1, 0), 5),
        ("RIGHTPADDING", (1, 0), (1, 0), 5),
        ("TOPPADDING", (1, 0), (1, 0), 4),
        ("BOTTOMPADDING", (1, 0), (1, 0), 4),
    ]))
    return KeepTogether([card])


def _officer_determination(report, styles):
    reviewer = report.get("reviewedBy") or {}
    decisions = [
        ("AI screening result", report.get("aiStatus") or report.get("status") or "Needs review"),
        ("Report status", _status(report)),
        ("Final officer determination", report.get("finalDecision") or "Pending officer review"),
        ("Officer remarks", report.get("officerRemarks") or "No final officer remark recorded"),
        ("Reviewed by", reviewer.get("name") or ("Pending" if report.get('captureMode') == 'listing' else report.get("inspectorName") or "Pending")),
        ("Final review timestamp", report.get("reviewedAt") or ("Pending" if report.get('captureMode') == 'listing' else report.get("date") or "Pending")),
        ("Evidence references", f"{(report.get('listingSource') or {}).get('fileName', '')}, CSV row {(report.get('listingSource') or {}).get('rowNumber', '')}" if report.get('captureMode') == 'listing' else f"{int(report.get('imageCount') or 0)} submitted package surface image(s)"),
    ]
    table = Table(
        [[Paragraph(f"<b>{_safe(k)}</b>", styles["PMLabel"]), Paragraph(_safe(v), styles["PMBody"])] for k, v in decisions],
        colWidths=[42 * mm, 140 * mm]
    )
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("BACKGROUND", (0, 0), (0, -1), PALE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))

    sig_block = Table(
        [
            [
                Paragraph("<b>AUTHORIZED INSPECTING OFFICER SIGNATURE</b>", styles["PMLabel"]),
                Paragraph("<b>OFFICIAL SEAL & DATE</b>", styles["PMLabel"]),
            ],
            [
                Paragraph(f"<br/><br/>________________________________________<br/><b>{_safe(report.get('inspectorName'))}</b><br/><font color='#64748B'>Legal Metrology Enforcement Officer</font>", styles["PMBody"]),
                Paragraph("<br/><br/>________________________________________<br/>Date: ____________________", styles["PMBody"]),
            ]
        ],
        colWidths=[110 * mm, 72 * mm]
    )
    sig_block.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("GRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("BACKGROUND", (0, 0), (-1, 0), PALE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))

    disclaimer = Paragraph(
        "This report records machine-assisted extraction and deterministic rule screening. REVIEW is not a final finding of non-compliance. Officer-verified outcomes reflect the recorded authorized-officer decision.",
        styles["PMSmall"]
    )

    return [table, Spacer(1, 4 * mm), sig_block, Spacer(1, 3 * mm), disclaimer]


def _story(report, styles, title=True):
    result = []

    # PAGE 1 — REPORT OVERVIEW
    # 1. Branding & Header
    if title:
        result += [
            Paragraph("OFFICIAL INSPECTION RECORD", styles["PMKicker"]),
            Paragraph("Packaged Commodity Inspection Report", styles["PMTitle"]),
            Paragraph("Ministry of Consumer Affairs, Food & Public Distribution | Department of Legal Metrology", styles["PMSubtitle"]),
        ]
    result.append(_header_metadata(report, styles))
    if report.get('captureMode') == 'listing':
        source = report.get('listingSource') or {}
        result.append(Paragraph(f"Store inventory screening | Source: {_safe(source.get('fileName'))}, row {_safe(source.get('rowNumber'))}. Supplied values have not been verified against physical packaging. Missing inventory data requires review, not an automatic finding of absence.", styles['PMSmall']))
    result.append(Spacer(1, 3 * mm))

    # 2. Review Required / Assessment Summary (Visual focus near top)
    result.append(_summary(report, styles))
    result.append(Spacer(1, 3.5 * mm))

    # 3. Product & Declaration Details (Immediately after Assessment Summary)
    result.append(Paragraph("Product information and extracted declarations", styles["PMSection"]))
    result.extend(_details(report, styles))
    result.append(Spacer(1, 3.5 * mm))

    # 4. Submitted Evidence (Directly AFTER Assessment and Product Details!)
    evidence_flowables = _evidence(report, styles)
    if evidence_flowables:
        result.append(Paragraph("Submitted evidence", styles["PMSection"]))
        result.extend(evidence_flowables)

    # Clean PageBreak after Page 1 Overview!
    result.append(PageBreak())

    # PAGE 2 — COMPLIANCE FINDINGS
    result.append(Paragraph("Compliance findings", styles["PMSection"]))
    result.append(Paragraph("Evaluation against mandatory and conditional requirements under Legal Metrology Rules, 2011.", styles["PMSmall"]))
    result.append(Spacer(1, 2 * mm))

    findings = [x for x in (report.get("results") or []) if x.get("outcome") != "NOT_APPLICABLE"]
    for item in findings:
        result.append(_finding(item, styles))
        result.append(Spacer(1, 1.8 * mm))
    if not findings:
        result.append(Paragraph("No applicable findings were recorded.", styles["PMBody"]))

    # Clean PageBreak for Transcripts & Determination
    result.append(PageBreak())

    # PAGE 3 — COMPOSITION, TRANSCRIPTS & DETERMINATION
    if report.get('captureMode') != 'listing':
        result.append(Paragraph("Ingredients and nutrition", styles["PMSection"]))
        result.append(_composition(report, styles))
        result.append(Spacer(1, 3.5 * mm))
        result.append(Paragraph("Complete extracted text", styles["PMSection"]))
        result.extend(_transcript(report, styles))
        result.append(Spacer(1, 3.5 * mm))

    result.append(Paragraph("Officer determination", styles["PMSection"]))
    result.extend(_officer_determination(report, styles))

    return result


def build_report_pdf(report: dict[str, Any]) -> bytes:
    stream = BytesIO()
    doc = SimpleDocTemplate(
        stream,
        pagesize=A4,
        rightMargin=14 * mm,
        leftMargin=14 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        title=f"PackMetrix {report.get('id', 'Inspection Report')}",
        author="PackMetrix"
    )
    doc.build(_story(report, _styles()), canvasmaker=NumberedCanvas)
    return stream.getvalue()


def build_bulk_report_pdf(batch: dict[str, Any]) -> bytes:
    reports = batch.get("reports") or []
    stream = BytesIO()
    styles = _styles()
    doc = SimpleDocTemplate(
        stream,
        pagesize=A4,
        rightMargin=14 * mm,
        leftMargin=14 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        title=f"PackMetrix Consolidated Batch {batch.get('id', '')}",
        author="PackMetrix"
    )
    clear = sum(r.get("status") == "COMPLIANT" for r in reports)
    issues = sum(r.get("status") == "NON_COMPLIANT" for r in reports)
    review = sum(r.get("status") == "REVIEW" for r in reports)

    story = [
        Paragraph("PRODUCT LISTING SUMMARY" if batch.get('mode') == 'listing' else "BULK INSPECTION SUMMARY", styles["PMKicker"]),
        Paragraph("Multi-Product Compliance Inspection Report", styles["PMTitle"]),
        Paragraph("Ministry of Consumer Affairs, Food & Public Distribution | Department of Legal Metrology", styles["PMSubtitle"]),
        Table(
            [
                [
                    Paragraph("<b>BATCH / INTAKE ID</b>", styles["PMLabel"]),
                    Paragraph(_safe(batch.get("id")), styles["PMValueBold"]),
                    Paragraph("<b>INSPECTION TIMESTAMP</b>", styles["PMLabel"]),
                    Paragraph(_safe(batch.get("date")), styles["PMValue"]),
                    Paragraph("<b>INSPECTING OFFICER</b>", styles["PMLabel"]),
                    Paragraph(_safe(batch.get("inspectorName")), styles["PMValueBold"]),
                ]
            ],
            colWidths=[28 * mm, 42 * mm, 32 * mm, 34 * mm, 26 * mm, 20 * mm],
            style=TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BACKGROUND", (0, 0), (-1, -1), PALE),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ])
        ),
        Spacer(1, 4 * mm),
    ]

    kpis = [
        [
            Paragraph("PRODUCTS ANALYZED", styles["PMLabel"]),
            Paragraph("COMPLIANT (PASS)", styles["PMLabel"]),
            Paragraph("POTENTIAL ISSUES", styles["PMLabel"]),
            Paragraph("NEED VERIFICATION", styles["PMLabel"]),
        ],
        [
            Paragraph(f"<b>{len(reports)}</b>", styles["PMStatus"]),
            Paragraph(f"<font color='{GREEN.hexval()}'><b>{clear}</b></font>", styles["PMStatus"]),
            Paragraph(f"<font color='{RED.hexval()}'><b>{issues}</b></font>", styles["PMStatus"]),
            Paragraph(f"<font color='{AMBER.hexval()}'><b>{review}</b></font>", styles["PMStatus"]),
        ]
    ]
    counts_table = Table(kpis, colWidths=[45.5 * mm] * 4)
    counts_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), PALE),
        ("BACKGROUND", (1, 0), (1, -1), GREEN_BG),
        ("BACKGROUND", (2, 0), (2, -1), RED_BG),
        ("BACKGROUND", (3, 0), (3, -1), AMBER_BG),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story += [counts_table, Spacer(1, 5 * mm), Paragraph("Product-wise Statutory Summary", styles["PMSection"])]

    def main_finding(r):
        findings = [item for item in (r.get("results") or []) if item.get("outcome") in ("FAIL", "REVIEW")]
        return (findings[0].get("requirement") if findings else "No issue detected") or "No issue detected"

    ordered = sorted(reports, key=lambda r: {"NON_COMPLIANT": 0, "REVIEW": 1, "COMPLIANT": 2}.get(r.get("status"), 3))
    header_cols = ["Product / Identifier", "CSV row" if batch.get('mode') == 'listing' else "Panels", "Assessment", "Primary Finding", "Report Dossier ID"]
    rows = [[Paragraph(f"<b>{c}</b>", styles["PMTableHead"]) for c in header_cols]]
    for r in ordered:
        p_name = (r.get("details") or {}).get("productName") or "Unidentified product"
        barcode = (r.get("declarations") or {}).get("barcode") or (r.get("details") or {}).get("productId") or "GTIN not detected"
        img_count = str((r.get('listingSource') or {}).get('rowNumber', '') if batch.get('mode') == 'listing' else r.get("imageCount") or 0)
        st = _safe(_status(r))
        mf = _safe(main_finding(r))
        rid = _safe(r.get("id"))
        prod_cell = Paragraph(f"<b>{_safe(p_name)}</b><br/><font color='#64748B'>{_safe(barcode)}</font>", styles["PMSmall"])
        rows.append([prod_cell, Paragraph(img_count, styles["PMSmall"]), Paragraph(st, styles["PMSmall"]), Paragraph(mf, styles["PMSmall"]), Paragraph(rid, styles["PMSmall"])])

    summary_table = Table(
        rows,
        colWidths=[42 * mm, 16 * mm, 32 * mm, 54 * mm, 38 * mm],
        repeatRows=1
    )
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story += [
        summary_table,
        Spacer(1, 5 * mm),
        Paragraph(
            "Store-supplied inventory screening, not physical package verification. Missing data requires officer review. Each report ID references the separately saved product report." if batch.get('mode') == 'listing' else "Each report ID references a separate product inspection record. The complete retained OCR transcript for every product follows for audit and comparison.",
            styles["PMSmall"]
        )
    ]
    for report in ([] if batch.get('mode') == 'listing' else ordered):
        product_name = (report.get("details") or {}).get("productName") or "Unidentified product"
        story += [
            PageBreak(),
            Paragraph(f"OCR Transcript — {_safe(product_name)}", styles["PMSection"]),
            Paragraph(f"Report dossier: {_safe(report.get('id'))}", styles["PMSmall"]),
            Spacer(1, 2 * mm),
            *_transcript(report, styles),
        ]
    doc.build(story, canvasmaker=NumberedCanvas)
    return stream.getvalue()

