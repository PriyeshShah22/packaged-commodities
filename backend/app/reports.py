from io import BytesIO
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _safe(value: Any, fallback: str = "Not detected") -> str:
    text = str(value or fallback)
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build_report_pdf(report: dict[str, Any]) -> bytes:
    stream = BytesIO()
    document = SimpleDocTemplate(stream, pagesize=A4, rightMargin=16 * mm, leftMargin=16 * mm, topMargin=15 * mm, bottomMargin=15 * mm, title=f"PackMetrix {report.get('id', 'Compliance Report')}")
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="Hero", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=colors.HexColor("#0F172A"), spaceAfter=5))
    styles.add(ParagraphStyle(name="Kicker", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8, textColor=colors.HexColor("#0369A1"), spaceAfter=8))
    styles.add(ParagraphStyle(name="Score", parent=styles["Title"], alignment=TA_CENTER, fontSize=30, textColor=colors.HexColor("#0369A1")))
    styles.add(ParagraphStyle(name="Small", parent=styles["Normal"], fontSize=8, leading=11, textColor=colors.HexColor("#475569")))
    story = [Paragraph("PACKMETRIX • AI-ASSISTED LEGAL METROLOGY", styles["Kicker"]), Paragraph("Package Compliance Report", styles["Hero"])]
    story.append(Paragraph(f"Report {_safe(report.get('id'))} • {_safe(report.get('date'))}", styles["Small"]))
    story.append(Spacer(1, 8 * mm))

    score = int(report.get("score") or 0)
    status = _safe(report.get("status", "REVIEW"))
    summary = Table([[Paragraph(f"<b>{score}%</b>", styles["Score"]), Paragraph(f"<b>AI assessment: {status}</b><br/>This is decision support. REVIEW findings require an authorized inspector's determination.", styles["BodyText"])]], colWidths=[40 * mm, 130 * mm])
    summary.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F0F9FF")), ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#BAE6FD")), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10)]))
    story.extend([summary, Spacer(1, 7 * mm), Paragraph("Product and responsible-party details", styles["Heading2"])])
    details = report.get("details") or {}
    fields = report.get("declarations") or {}
    detail_rows = [
        ["Product ID", _safe(details.get("productId") or report.get("id"))], ["Product name", _safe(details.get("productName"))],
        ["Manufacturer / packer / importer", _safe(fields.get("responsible_party_name"))], ["Responsible party address", _safe(fields.get("responsible_party_address"))],
        ["Commodity", _safe(fields.get("commodity_name"))], ["Net quantity", _safe(fields.get("net_quantity"))], ["Maximum retail price", _safe(fields.get("mrp"))],
        ["FSSAI licence", _safe(fields.get("fssai_license"))], ["Batch / lot", _safe(fields.get("batch_number"))],
        ["Manufacture / pack date", _safe(fields.get("manufacture_pack_import_date"))], ["Use by / best before", _safe(fields.get("best_before_or_use_by"))],
        ["Consumer mobile", _safe(fields.get("consumer_phone"))], ["Consumer email", _safe(fields.get("consumer_email"))], ["Barcode / GTIN", _safe(fields.get("barcode"))],
    ]
    table = Table([[Paragraph(f"<b>{_safe(label)}</b>", styles["Small"]), Paragraph(value, styles["Small"])] for label, value in detail_rows], colWidths=[55 * mm, 115 * mm])
    table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")), ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8FAFC")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    story.extend([table, Spacer(1, 7 * mm), Paragraph("Violation and review list", styles["Heading2"])])
    violations = report.get("violations") or []
    if violations:
        rows = [["Outcome", "Rule", "Finding"]] + [[_safe(v.get("outcome")), _safe(v.get("rule_reference") or v.get("rule_id")), Paragraph(_safe(v.get("reason")), styles["Small"])] for v in violations]
        violation_table = Table(rows, colWidths=[22 * mm, 43 * mm, 105 * mm], repeatRows=1)
        violation_table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 8), ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
        story.append(violation_table)
    else:
        story.append(Paragraph("No FAIL or REVIEW findings were produced for the submitted evidence.", styles["BodyText"]))
    raw_lines = report.get("ocrLines") or []
    story.extend([PageBreak(), Paragraph("OCR extraction transcript", styles["Heading2"]), Paragraph("Text below is machine-extracted evidence and may require comparison with the submitted image.", styles["Small"]), Spacer(1, 3 * mm)])
    for line in raw_lines[:250]:
        text = line.get("text") if isinstance(line, dict) else line
        confidence = line.get("confidence") if isinstance(line, dict) else None
        suffix = f" ({round(float(confidence) * 100)}%)" if confidence is not None else ""
        story.append(Paragraph(f"• {_safe(text)}{suffix}", styles["Small"]))
    if not raw_lines:
        story.append(Paragraph("No OCR lines were retained for this report.", styles["Small"]))
    document.build(story)
    return stream.getvalue()


def build_bulk_report_pdf(batch: dict[str, Any]) -> bytes:
    reports = batch.get("reports") or []
    stream = BytesIO()
    document = SimpleDocTemplate(stream, pagesize=A4, rightMargin=16 * mm, leftMargin=16 * mm, topMargin=15 * mm, bottomMargin=15 * mm, title=f"PackMetrix bulk report {batch.get('id', '')}")
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="BulkHero", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=22, textColor=colors.HexColor("#0F172A"), spaceAfter=7))
    styles.add(ParagraphStyle(name="BulkSmall", parent=styles["Normal"], fontSize=8, leading=11, textColor=colors.HexColor("#475569")))
    story = [Paragraph("PACKMETRIX • CONSOLIDATED INSPECTION BATCH", styles["BulkSmall"]), Paragraph("Multi-product Compliance Report", styles["BulkHero"]), Paragraph(f"Batch {_safe(batch.get('id'))} • {len(reports)} product report(s)", styles["BulkSmall"]), Spacer(1, 7 * mm)]
    summary_rows = [["Product", "Report ID", "Assessment", "Score"]]
    for report in reports:
        summary_rows.append([_safe((report.get("details") or {}).get("productName")), _safe(report.get("id")), _safe(report.get("status")), f"{int(report.get('score') or 0)}%"])
    summary = Table(summary_rows, colWidths=[62 * mm, 48 * mm, 36 * mm, 24 * mm], repeatRows=1)
    summary.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 8), ("GRID", (0, 0), (-1, -1), .4, colors.HexColor("#CBD5E1")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("PADDING", (0, 0), (-1, -1), 6)]))
    story.append(summary)
    for index, report in enumerate(reports):
        story.append(PageBreak())
        details = report.get("details") or {}; declarations = report.get("declarations") or {}; violations = report.get("violations") or []
        story.extend([Paragraph(f"Product {index + 1}: {_safe(details.get('productName'))}", styles["Heading1"]), Paragraph(f"{_safe(report.get('id'))} • {_safe(report.get('status'))} • {int(report.get('score') or 0)}%", styles["BulkSmall"]), Spacer(1, 4 * mm)])
        rows = [["Product ID", _safe(details.get("productId"))], ["Commodity", _safe(declarations.get("commodity_name"))], ["Responsible party", _safe(declarations.get("responsible_party_name"))], ["Address", _safe(declarations.get("responsible_party_address"))], ["Net quantity", _safe(declarations.get("net_quantity"))], ["MRP", _safe(declarations.get("mrp"))], ["FSSAI", _safe(declarations.get("fssai_license"))], ["Batch", _safe(declarations.get("batch_number"))], ["Manufacture date", _safe(declarations.get("manufacture_pack_import_date"))], ["Use by / best before", _safe(declarations.get("best_before_or_use_by"))], ["Consumer contact", _safe(declarations.get("consumer_care") or declarations.get("consumer_phone") or declarations.get("consumer_email"))]]
        table = Table([[Paragraph(f"<b>{label}</b>", styles["BulkSmall"]), Paragraph(value, styles["BulkSmall"])] for label, value in rows], colWidths=[48 * mm, 122 * mm])
        table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), .4, colors.HexColor("#CBD5E1")), ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8FAFC")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("PADDING", (0, 0), (-1, -1), 6)]))
        story.extend([table, Spacer(1, 5 * mm), Paragraph(f"Violations and review findings ({len(violations)})", styles["Heading2"])])
        if violations:
            for item in violations:
                story.append(Paragraph(f"<b>{_safe(item.get('outcome'))} • {_safe(item.get('rule_reference') or item.get('rule_id'))}</b><br/>{_safe(item.get('reason'))}", styles["BulkSmall"]))
                story.append(Spacer(1, 2 * mm))
        else:
            story.append(Paragraph("No FAIL or REVIEW findings.", styles["BulkSmall"]))
        lines = report.get("ocrLines") or []
        story.extend([Spacer(1, 3 * mm), Paragraph(f"OCR transcript ({len(lines)} lines)", styles["Heading2"])])
        for line in lines[:80]:
            story.append(Paragraph(f"• {_safe(line.get('text') if isinstance(line, dict) else line)}", styles["BulkSmall"]))
    document.build(story)
    return stream.getvalue()
