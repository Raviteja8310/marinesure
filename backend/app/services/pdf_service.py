"""
ReportLab PDF Generation Service for Marine Cargo Insurance Certificates.
"""

import os
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

STORAGE_DIR = Path("storage/policies")


def generate_policy_certificate(policy, application, shipment, product, customer) -> str:
    """Generate professional PDF insurance certificate and return relative storage key."""
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"Policy_{policy.policy_number.replace('/', '_')}.pdf"
    filepath = STORAGE_DIR / filename

    doc = SimpleDocTemplate(
        str(filepath),
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CertTitle',
        parent=styles['Heading1'],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0b5074'),
        alignment=1, # Center
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        'CertSub',
        parent=styles['Normal'],
        fontSize=10,
        leading=12,
        textColor=colors.HexColor('#0776ad'),
        alignment=1,
        spaceAfter=15,
    )
    section_style = ParagraphStyle(
        'SectionHead',
        parent=styles['Heading2'],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#0b5074'),
        spaceBefore=12,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        'CertBody',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155'),
    )

    story = []

    # Header
    story.append(Paragraph("MARINESURE MARINE CARGO INSURANCE", subtitle_style))
    story.append(Paragraph("MARINE CARGO INSURANCE CERTIFICATE", title_style))
    story.append(Paragraph(f"Policy Number: <b>{policy.policy_number}</b>", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#0b5074'), spaceAfter=15))

    # Policy & Insured Summary Table
    summary_data = [
        [Paragraph("<b>Insured Name:</b>", body_style), Paragraph(customer.name, body_style), Paragraph("<b>Effective Date:</b>", body_style), Paragraph(str(policy.effective_date), body_style)],
        [Paragraph("<b>Customer Email:</b>", body_style), Paragraph(customer.email, body_style), Paragraph("<b>Expiry Date:</b>", body_style), Paragraph(str(policy.expiry_date), body_style)],
        [Paragraph("<b>Insurance Product:</b>", body_style), Paragraph(product.product_name, body_style), Paragraph("<b>Status:</b>", body_style), Paragraph(policy.status.upper(), body_style)],
    ]
    t1 = Table(summary_data, colWidths=[100, 170, 100, 170])
    t1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f0f7fc')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#b9e0f3')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e0eff9')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t1)
    story.append(Spacer(1, 10))

    # Shipment & Transit Details
    story.append(Paragraph("Shipment & Transit Particulars", section_style))
    ship_data = [
        [Paragraph("<b>Shipment Reference:</b>", body_style), Paragraph(shipment.shipment_number, body_style), Paragraph("<b>Transport Mode:</b>", body_style), Paragraph(shipment.transport_mode.upper(), body_style)],
        [Paragraph("<b>Origin:</b>", body_style), Paragraph(f"{shipment.origin_location}, {shipment.origin_country}", body_style), Paragraph("<b>Destination:</b>", body_style), Paragraph(f"{shipment.destination_location}, {shipment.destination_country}", body_style)],
        [Paragraph("<b>Insured Amount:</b>", body_style), Paragraph(f"₹ {Number_fmt(policy.insured_amount)}", body_style), Paragraph("<b>Policy Deductible:</b>", body_style), Paragraph(f"₹ {Number_fmt(policy.deductible_amount)}", body_style)],
    ]
    t2 = Table(ship_data, colWidths=[100, 170, 100, 170])
    t2.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t2)
    story.append(Spacer(1, 10))

    # Cargo Items Table
    story.append(Paragraph("Insured Cargo Items", section_style))
    cargo_rows = [[Paragraph("<b>Cargo Name</b>", body_style), Paragraph("<b>Category</b>", body_style), Paragraph("<b>Quantity</b>", body_style), Paragraph("<b>Declared Value</b>", body_style)]]
    for item in shipment.cargo_items:
        cargo_rows.append([
            Paragraph(item.cargo_name, body_style),
            Paragraph(item.category, body_style),
            Paragraph(f"{item.quantity} {item.unit}", body_style),
            Paragraph(f"₹ {Number_fmt(item.value)}", body_style),
        ])
    t3 = Table(cargo_rows, colWidths=[180, 110, 100, 150])
    t3.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0b5074')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#0b5074')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t3)
    story.append(Spacer(1, 10))

    # Terms & Conditions / Clauses
    story.append(Paragraph("Coverage Terms & Conditions", section_style))
    terms_text = f"""
    <b>Applicable Clauses:</b> {product.terms_and_conditions}<br/><br/>
    <b>Premium Paid:</b> ₹ {Number_fmt(policy.premium_paid)} (Inclusive of applicable taxes and fees).<br/><br/>
    This Certificate is issued in accordance with the authorization granted under MarineSure system and is subject to the Institute Cargo Clauses and standard underwriting warranties. In the event of loss or damage likely to give rise to a claim under this insurance, immediate notice must be given to MarineSure claims department.
    """
    story.append(Paragraph(terms_text, body_style))
    story.append(Spacer(1, 20))

    # Signatures
    sig_data = [
        [Paragraph("<b>Authorized Underwriter</b><br/>MarineSure Underwriting Division", body_style), Paragraph("<b>Insured Acceptance</b><br/>Authorized Signatory", body_style)],
        [Paragraph("<br/><br/>___________________________", body_style), Paragraph("<br/><br/>___________________________", body_style)]
    ]
    t4 = Table(sig_data, colWidths=[270, 270])
    t4.setStyle(TableStyle([
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(t4)

    doc.build(story)
    return str(filepath)


def Number_fmt(val) -> str:
    try:
        return f"{float(val):,.2f}"
    except Exception:
        return str(val)
