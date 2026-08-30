import base64
from io import BytesIO
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

NAVY, BLUE, SLATE = colors.HexColor("#020817"), colors.HexColor("#0284C7"), colors.HexColor("#475569")
PALE, BORDER = colors.HexColor("#F8FAFC"), colors.HexColor("#CBD5E1")
GREEN, AMBER, RED = colors.HexColor("#047857"), colors.HexColor("#B45309"), colors.HexColor("#BE123C")


def _safe(value: Any, fallback: str = "Not reliably detected") -> str:
    return str(value or fallback).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="PMKicker", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7.5, leading=10, textColor=BLUE, tracking=1.1))
    styles.add(ParagraphStyle(name="PMTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=22, leading=27, textColor=NAVY, alignment=0, spaceAfter=3))
    styles.add(ParagraphStyle(name="PMMeta", parent=styles["Normal"], fontSize=8, leading=11, textColor=SLATE))
    styles.add(ParagraphStyle(name="PMSection", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=NAVY, spaceAfter=7))
    styles.add(ParagraphStyle(name="PMBody", parent=styles["BodyText"], fontSize=8.5, leading=12.5, textColor=colors.HexColor("#334155")))
    styles.add(ParagraphStyle(name="PMSmall", parent=styles["Normal"], fontSize=7.5, leading=10.5, textColor=SLATE))
    styles.add(ParagraphStyle(name="PMLabel", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7, leading=9, textColor=SLATE))
    styles.add(ParagraphStyle(name="PMValue", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8.5, leading=12, textColor=NAVY))
    styles.add(ParagraphStyle(name="PMStatus", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=14, leading=18, textColor=NAVY))
    styles.add(ParagraphStyle(name="PMRight", parent=styles["PMMeta"], alignment=TA_RIGHT))
    return styles


def _page(canvas, document):
    canvas.saveState(); width, height = A4
    canvas.setFillColor(NAVY); canvas.rect(0, height - 8 * mm, width, 8 * mm, fill=1, stroke=0)
    canvas.setFont("Helvetica-Bold", 7); canvas.setFillColor(colors.white); canvas.drawString(16 * mm, height - 5.2 * mm, "PACKMETRIX  |  LEGAL METROLOGY INSPECTION")
    canvas.setStrokeColor(BORDER); canvas.line(16 * mm, 12 * mm, width - 16 * mm, 12 * mm)
    canvas.setFillColor(SLATE); canvas.setFont("Helvetica", 7); canvas.drawString(16 * mm, 7.5 * mm, "AI-assisted decision support - final determination remains with the authorized officer")
    canvas.drawRightString(width - 16 * mm, 7.5 * mm, f"Page {document.page}"); canvas.restoreState()


def _status(report):
    if report.get("workflowStatus") == "RESOLVED": return "OFFICER VERIFIED / RESOLVED"
    return {"COMPLIANT": "PASS", "NON_COMPLIANT": "POTENTIAL ISSUE", "REVIEW": "REVIEW REQUIRED"}.get(report.get("status"), report.get("status") or "REVIEW REQUIRED")


def _summary(report, styles):
    counts = report.get("counts") or {}; score = int(report.get("verificationScore", report.get("score") or 0))
    data = [[Paragraph("ASSESSMENT", styles["PMLabel"]), Paragraph("EVIDENCE VERIFICATION", styles["PMLabel"]), Paragraph("FINDINGS", styles["PMLabel"])], [Paragraph(_safe(_status(report)), styles["PMStatus"]), Paragraph(f"{score}% complete", styles["PMStatus"]), Paragraph(f"<b>{counts.get('PASS', 0)}</b> passed<br/><b>{counts.get('FAIL', 0)}</b> potential issues<br/><b>{counts.get('REVIEW', 0)}</b> need verification", styles["PMBody"])]]
    table = Table(data, colWidths=[58 * mm, 52 * mm, 60 * mm])
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F0F9FF")), ("BOX", (0, 0), (-1, -1), .6, colors.HexColor("#BAE6FD")), ("LINEBEFORE", (1, 0), (-1, -1), .4, colors.HexColor("#BAE6FD")), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("PADDING", (0, 0), (-1, -1), 8)]))
    return table


def _details(report, styles):
    d, f = report.get("details") or {}, report.get("declarations") or {}
    entries = [("Product name", d.get("productName")), ("GTIN / barcode", f.get("barcode") or d.get("productId")), ("Common name", f.get("commodity_name")), ("Net quantity", f.get("net_quantity")), ("Manufacturer / packer / importer", f.get("responsible_party_name")), ("MRP", f.get("mrp")), ("Responsible-party address", f.get("responsible_party_address")), ("Batch / lot", f.get("batch_number")), ("Manufacture / pack date", f.get("manufacture_pack_import_date")), ("Best before / use by", f.get("best_before_or_use_by")), ("Consumer-care phone", f.get("consumer_phone")), ("Consumer-care email", f.get("consumer_email")), ("Country of origin", f.get("country_of_origin")), ("FSSAI licence", f.get("fssai_license"))]
    rows = []
    for i in range(0, len(entries), 2):
        left, right = entries[i:i + 2]
        rows.append([Paragraph(_safe(left[0]), styles["PMLabel"]), Paragraph(_safe(left[1]), styles["PMValue"]), Paragraph(_safe(right[0]), styles["PMLabel"]), Paragraph(_safe(right[1]), styles["PMValue"])])
    table = Table(rows, colWidths=[34 * mm, 51 * mm, 34 * mm, 51 * mm])
    table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), .35, BORDER), ("BACKGROUND", (0, 0), (0, -1), PALE), ("BACKGROUND", (2, 0), (2, -1), PALE), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("PADDING", (0, 0), (-1, -1), 6)]))
    return table


def _finding(item, styles):
    outcome = item.get("resolvedOutcome") or item.get("outcome") or "REVIEW"; color = GREEN if outcome in ("PASS", "COMPLIANT") else RED if outcome in ("FAIL", "VIOLATION") else AMBER
    evidence = "; ".join(f"{e.get('field', '').replace('_', ' ').title()}: {e.get('value', '')}" for e in (item.get("evidence") or []) if e.get("value"))
    body = [Paragraph(f"<font color='{color.hexval()}'><b>{_safe(item.get('requirement') or item.get('rule_id'))} - {_safe(outcome.replace('_', ' '))}</b></font>", styles["PMBody"])]
    if evidence: body.append(Paragraph(f"<b>Detected:</b> {_safe(evidence)}", styles["PMSmall"]))
    body += [Paragraph(f"<b>Reason:</b> {_safe(item.get('reason'))}", styles["PMSmall"]), Paragraph(f"<b>Legal reference:</b> {_safe(item.get('rule_reference') or item.get('rule_id'))}", styles["PMSmall"])]
    if item.get("officerRemark"): body.append(Paragraph(f"<b>Officer remark:</b> {_safe(item.get('officerRemark'))}", styles["PMSmall"]))
    table = Table([[Spacer(1, 1), body]], colWidths=[3 * mm, 164 * mm])
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, 0), color), ("BACKGROUND", (1, 0), (1, 0), PALE), ("BOX", (0, 0), (-1, -1), .35, BORDER), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (0, 0), 0), ("RIGHTPADDING", (0, 0), (0, 0), 0), ("TOPPADDING", (0, 0), (0, 0), 0), ("BOTTOMPADDING", (0, 0), (0, 0), 0), ("PADDING", (1, 0), (1, 0), 8)]))
    return KeepTogether([table])


def _evidence(report, styles):
    value = str(report.get("thumbnail") or "")
    try:
        if value.startswith("data:image") and "," in value:
            image = Image(BytesIO(base64.b64decode(value.split(",", 1)[1]))); image._restrictSize(165 * mm, 82 * mm); return image
    except Exception: pass
    return Paragraph("Evidence image preview was not retained in this browser report.", styles["PMSmall"])


def _story(report, styles, title=True):
    reviewer = report.get("reviewedBy") or {}; result = []
    if title: result += [Paragraph("OFFICIAL INSPECTION RECORD", styles["PMKicker"]), Paragraph("Packaged Commodity Inspection Report", styles["PMTitle"])]
    meta = Table([[Paragraph(f"<b>Report ID</b><br/>{_safe(report.get('id'))}", styles["PMMeta"]), Paragraph(f"<b>Inspection date and time</b><br/>{_safe(report.get('date'))}", styles["PMMeta"]), Paragraph(f"<b>Inspector</b><br/>{_safe(report.get('inspectorName'))}", styles["PMRight"])]], colWidths=[57 * mm, 60 * mm, 53 * mm])
    meta.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("PADDING", (0, 0), (-1, -1), 0)]))
    result += [meta, Spacer(1, 5 * mm), _summary(report, styles), Spacer(1, 6 * mm), Paragraph("Product information and extracted declarations", styles["PMSection"]), _details(report, styles), Spacer(1, 6 * mm), Paragraph("Compliance findings", styles["PMSection"])]
    findings = [x for x in (report.get("results") or []) if x.get("outcome") != "NOT_APPLICABLE"]
    for item in findings: result += [_finding(item, styles), Spacer(1, 2.3 * mm)]
    if not findings: result.append(Paragraph("No applicable findings were recorded.", styles["PMBody"]))
    result += [Spacer(1, 4 * mm), Paragraph("Submitted evidence", styles["PMSection"]), _evidence(report, styles), Paragraph(f"{int(report.get('imageCount') or 0)} package surface image(s) submitted. Raw OCR transcripts and debug confidence dumps are excluded from this officer-facing report.", styles["PMSmall"]), Spacer(1, 5 * mm), Paragraph("Officer determination", styles["PMSection"])]
    decisions = [("Report status", _status(report)), ("Final decision", report.get("finalDecision") or "Pending officer review"), ("Officer remarks", report.get("officerRemarks") or "No final officer remark recorded"), ("Reviewed by", reviewer.get("name") or report.get("inspectorName") or "Pending"), ("Reviewed at", report.get("reviewedAt") or "Pending")]
    table = Table([[Paragraph(f"<b>{_safe(k)}</b>", styles["PMSmall"]), Paragraph(_safe(v), styles["PMBody"])] for k, v in decisions], colWidths=[42 * mm, 128 * mm])
    table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), .35, BORDER), ("BACKGROUND", (0, 0), (0, -1), PALE), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("PADDING", (0, 0), (-1, -1), 7)]))
    result += [table, Spacer(1, 6 * mm), HRFlowable(width="100%", thickness=.5, color=BORDER), Spacer(1, 2 * mm), Paragraph("This report records machine-assisted extraction and deterministic rule screening. REVIEW is not a final finding of non-compliance. Officer-verified outcomes reflect the recorded authorized-officer decision.", styles["PMSmall"])]
    return result


def build_report_pdf(report: dict[str, Any]) -> bytes:
    stream = BytesIO(); doc = SimpleDocTemplate(stream, pagesize=A4, rightMargin=16 * mm, leftMargin=16 * mm, topMargin=15 * mm, bottomMargin=17 * mm, title=f"PackMetrix {report.get('id', 'Inspection Report')}", author="PackMetrix")
    doc.build(_story(report, _styles()), onFirstPage=_page, onLaterPages=_page); return stream.getvalue()


def build_bulk_report_pdf(batch: dict[str, Any]) -> bytes:
    reports = batch.get("reports") or []; stream = BytesIO(); styles = _styles()
    doc = SimpleDocTemplate(stream, pagesize=A4, rightMargin=16 * mm, leftMargin=16 * mm, topMargin=15 * mm, bottomMargin=17 * mm, title=f"PackMetrix consolidated batch {batch.get('id', '')}", author="PackMetrix")
    story = [Paragraph("CONSOLIDATED INSPECTION BATCH", styles["PMKicker"]), Paragraph("Multi-product Inspection Report", styles["PMTitle"]), Paragraph(f"Batch {_safe(batch.get('id'))} | {len(reports)} isolated product report(s)", styles["PMMeta"]), Spacer(1, 7 * mm)]
    rows = [["Product", "GTIN / barcode", "Assessment", "Report ID"]] + [[_safe((r.get("details") or {}).get("productName")), _safe((r.get("declarations") or {}).get("barcode") or (r.get("details") or {}).get("productId")), _safe(_status(r)), _safe(r.get("id"))] for r in reports]
    summary = Table([[Paragraph(f"<b>{c}</b>" if i == 0 else c, styles["PMSmall"]) for c in row] for i, row in enumerate(rows)], colWidths=[52 * mm, 38 * mm, 40 * mm, 40 * mm], repeatRows=1)
    summary.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("GRID", (0, 0), (-1, -1), .35, BORDER), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("PADDING", (0, 0), (-1, -1), 6)])); story.append(summary)
    for i, report in enumerate(reports): story += [PageBreak(), Paragraph(f"PRODUCT {i + 1} OF {len(reports)}", styles["PMKicker"]), Paragraph(_safe((report.get("details") or {}).get("productName")), styles["PMTitle"])] + _story(report, styles, title=False)
    doc.build(story, onFirstPage=_page, onLaterPages=_page); return stream.getvalue()
