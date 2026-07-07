"""
PDF export for the production deliverables: call sheet, shot list, and
storyboard. Uses reportlab if installed; raises a clear error otherwise so the
UI can tell the user how to install it.

These layouts are intentionally clean and print-ready (US Letter), matching the
kind of one-page documents a 1st AD or DP hands to a crew.
"""

def _require_reportlab():
    try:
        import reportlab  # noqa: F401
        return True
    except ImportError:
        raise RuntimeError(
            "PDF export needs the 'reportlab' package.\n"
            "Install it with:  pip install --user reportlab\n"
            "or on Fedora:     sudo dnf install python3-reportlab")


def export_call_sheet_pdf(project, call_sheet, path):
    _require_reportlab()
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.platypus import (SimpleDocTemplate, Table, TableStyle,
                                    Paragraph, Spacer)
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    styles = getSampleStyleSheet()
    h = ParagraphStyle("h", parent=styles["Heading1"], fontSize=16, spaceAfter=2)
    sub = ParagraphStyle("sub", parent=styles["Normal"], fontSize=10,
                         textColor=colors.HexColor("#555555"))
    sec = ParagraphStyle("sec", parent=styles["Heading2"], fontSize=11,
                        spaceBefore=10, spaceAfter=4,
                        textColor=colors.HexColor("#222222"))
    cs = call_sheet
    doc = SimpleDocTemplate(path, pagesize=letter,
                            topMargin=0.6 * inch, bottomMargin=0.6 * inch,
                            leftMargin=0.7 * inch, rightMargin=0.7 * inch)
    story = []
    story.append(Paragraph(project.title or "Untitled Production", h))
    story.append(Paragraph(f"Call Sheet — {cs.title}", sub))
    story.append(Spacer(1, 8))

    info = [
        ["Date", cs.date, "Shoot Day", cs.shoot_day],
        ["General Call", cs.general_call, "Weather", cs.weather],
        ["Location", cs.location, "Sunrise / Sunset",
         f"{cs.sunrise} / {cs.sunset}"],
        ["Address", cs.address, "", ""],
        ["Nearest Hospital", cs.nearest_hospital, "", ""],
    ]
    t = Table(info, colWidths=[1.3*inch, 2.6*inch, 1.3*inch, 1.6*inch])
    t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#777777")),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#777777")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#dddddd")),
    ]))
    story.append(t)

    if cs.notes.strip():
        story.append(Paragraph("Notes", sec))
        story.append(Paragraph(cs.notes.replace("\n", "<br/>"), styles["Normal"]))
    if cs.bulletins.strip():
        story.append(Paragraph("Bulletins / Safety", sec))
        story.append(Paragraph(cs.bulletins.replace("\n", "<br/>"), styles["Normal"]))

    if cs.schedule:
        story.append(Paragraph("Schedule", sec))
        rows = [["Scene", "I/E", "Set / Location", "D/N", "Cast", "Pages"]]
        for s in cs.schedule:
            rows.append([s.get("Scene", ""), s.get("INT/EXT", ""),
                         s.get("Set / Location", ""), s.get("D/N", ""),
                         s.get("Cast", ""), s.get("Pages", "")])
        story.append(_grid(rows, [0.7, 0.5, 2.6, 0.5, 1.4, 0.7], inch, colors))

    if cs.crew:
        story.append(Paragraph("Crew Call", sec))
        rows = [["Call", "Name", "Role", "Department", "Phone"]]
        for c in cs.crew:
            rows.append([c.get("Call Time", ""), c.get("Name", ""),
                         c.get("Role", ""), c.get("Department", ""),
                         c.get("Phone", "")])
        story.append(_grid(rows, [0.7, 1.6, 1.4, 1.6, 1.1], inch, colors))

    doc.build(story)
    return path


def export_shot_list_pdf(project, path):
    _require_reportlab()
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    styles = getSampleStyleSheet()
    h = ParagraphStyle("h", parent=styles["Heading1"], fontSize=15)
    doc = SimpleDocTemplate(path, pagesize=landscape(letter),
                            topMargin=0.5*inch, bottomMargin=0.5*inch,
                            leftMargin=0.5*inch, rightMargin=0.5*inch)
    story = [Paragraph(f"{project.title} — Shot List", h), Spacer(1, 8)]
    cols = ["Scene", "Shot #", "Subject", "Shot Size", "Camera Angle",
            "Movement", "Lens", "Location", "Done"]
    rows = [cols]
    for s in project.shots:
        rows.append([s.get(c, "") for c in cols])
    widths = [0.6, 0.6, 2.2, 0.9, 1.1, 1.0, 0.9, 1.8, 0.5]
    story.append(_grid(rows, widths, inch, colors))
    doc.build(story)
    return path


def export_storyboard_pdf(project, path):
    _require_reportlab()
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer,
                                    Table, TableStyle, Image)
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    import os

    styles = getSampleStyleSheet()
    h = ParagraphStyle("h", parent=styles["Heading1"], fontSize=15)
    lab = ParagraphStyle("lab", parent=styles["Normal"], fontSize=8,
                        textColor=colors.HexColor("#888888"))
    val = ParagraphStyle("val", parent=styles["Normal"], fontSize=9)
    title = ParagraphStyle("t", parent=styles["Heading2"], fontSize=11)

    doc = SimpleDocTemplate(path, pagesize=letter,
                            topMargin=0.6*inch, bottomMargin=0.6*inch,
                            leftMargin=0.7*inch, rightMargin=0.7*inch)
    story = [Paragraph(f"{project.title} — Storyboard", h), Spacer(1, 10)]

    def cell(label, key, fr):
        return [Paragraph(label, lab), Paragraph(fr.get(key, "") or "—", val)]

    for fr in project.storyboard:
        head = f"Scene {fr.get('scene','?')} · Shot {fr.get('shot','?')} — {fr.get('subject','')}"
        story.append(Paragraph(head, title))

        # image (if present and readable) next to key specs
        img_flowable = None
        ip = fr.get("frame_image", "")
        if ip and os.path.exists(ip):
            try:
                img_flowable = Image(ip, width=2.4*inch, height=1.35*inch)
            except Exception:
                img_flowable = None

        specs = [
            cell("Shot Size", "shot_size", fr) + cell("Angle", "camera_angle", fr),
            cell("Movement", "movement", fr) + cell("Support", "support", fr),
            cell("Camera", "camera_body", fr) + cell("Lens", "lens", fr),
            cell("Focal", "focal_length", fr) + cell("Aperture", "aperture", fr),
            cell("Filter", "filter", fr) + cell("Frame Rate", "frame_rate", fr),
            cell("Lighting", "lighting_setup", fr) + cell("Key Light", "key_light", fr),
            cell("VFX", "vfx", fr) + cell("Location", "location", fr),
        ]
        spec_tbl = Table(specs, colWidths=[0.8*inch, 1.5*inch, 0.8*inch, 1.5*inch])
        spec_tbl.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
        ]))

        if img_flowable is not None:
            combo = Table([[img_flowable, spec_tbl]],
                          colWidths=[2.6*inch, 4.7*inch])
            combo.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
            story.append(combo)
        else:
            story.append(spec_tbl)

        if fr.get("description", "").strip():
            story.append(Paragraph(fr["description"], styles["Normal"]))
        story.append(Spacer(1, 14))

    doc.build(story)
    return path


def export_lightplan_pdf(project, lightplan, diagram_png, path):
    """One-page lighting breakdown: reference frame + top-down diagram, a
    numbered legend, camera/lens, and set notes — the deliverable a DP hands
    to the gaffer. `diagram_png` is a pre-rendered image of the plan (may be
    None)."""
    _require_reportlab()
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer,
                                    Table, TableStyle, Image)
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from .project import FIXTURE_TYPES
    import os

    lp = lightplan
    styles = getSampleStyleSheet()
    h = ParagraphStyle("h", parent=styles["Heading1"], fontSize=15, spaceAfter=2)
    sub = ParagraphStyle("sub", parent=styles["Normal"], fontSize=10,
                         textColor=colors.HexColor("#555555"))
    sec = ParagraphStyle("sec", parent=styles["Heading2"], fontSize=11,
                         spaceBefore=10, spaceAfter=4,
                         textColor=colors.HexColor("#222222"))
    lab = ParagraphStyle("lab", parent=styles["Normal"], fontSize=8,
                         textColor=colors.HexColor("#888888"))
    val = ParagraphStyle("val", parent=styles["Normal"], fontSize=9)
    leg = ParagraphStyle("leg", parent=styles["Normal"], fontSize=9, leading=12)

    doc = SimpleDocTemplate(path, pagesize=letter,
                            topMargin=0.6 * inch, bottomMargin=0.6 * inch,
                            leftMargin=0.7 * inch, rightMargin=0.7 * inch)
    story = [Paragraph(project.title or "Untitled Production", h),
             Paragraph(f"Lighting Breakdown — {lp.get('name', 'Setup')}", sub),
             Spacer(1, 8)]

    # reference frame beside the diagram
    ref = lp.get("reference_image", "")
    ref_img = None
    if ref and os.path.exists(ref):
        try:
            ref_img = Image(ref, width=3.0 * inch, height=1.7 * inch)
        except Exception:
            ref_img = None
    diagram = None
    if diagram_png and os.path.exists(diagram_png):
        try:
            diagram = Image(diagram_png, width=3.4 * inch, height=2.36 * inch)
        except Exception:
            diagram = None
    if ref_img or diagram:
        top = Table([[ref_img or Paragraph("No reference frame", lab),
                      diagram or Paragraph("No diagram", lab)]],
                    colWidths=[3.2 * inch, 3.6 * inch])
        top.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        story.append(top)
        story.append(Spacer(1, 6))

    # legend
    story.append(Paragraph("Light Legend", sec))
    rows = [["#", "Fixture", "Modifier", "Level", "Gel", "Notes"]]
    for i, fx in enumerate(lp.get("fixtures", [])):
        title = fx.get("label") or FIXTURE_TYPES.get(
            fx.get("type", ""), {}).get("label", "Light")
        unit = fx.get("unit", "")
        name = f"{title}" + (f" — {unit}" if unit else "")
        rows.append([str(i + 1), name, fx.get("modifier", ""),
                     fx.get("intensity", ""), fx.get("gel", ""),
                     fx.get("notes", "")])
    if len(rows) > 1:
        story.append(_grid(rows, [0.3, 1.9, 1.3, 0.8, 0.9, 1.8], inch, colors))
    else:
        story.append(Paragraph("No fixtures placed.", val))

    # camera & lens
    story.append(Paragraph("Camera & Lens", sec))
    cam = [
        [Paragraph("Camera", lab), Paragraph(lp.get("camera_body", "") or "—", val),
         Paragraph("Lens", lab), Paragraph(lp.get("lens", "") or "—", val)],
        [Paragraph("Focal", lab), Paragraph(lp.get("focal_length", "") or "—", val),
         Paragraph("Aperture", lab), Paragraph(lp.get("aperture", "") or "—", val)],
        [Paragraph("Height", lab), Paragraph(lp.get("camera_height", "") or "—", val),
         Paragraph("Angle", lab), Paragraph(lp.get("camera_angle", "") or "—", val)],
    ]
    ct = Table(cam, colWidths=[0.8 * inch, 2.0 * inch, 0.8 * inch, 2.0 * inch])
    ct.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
    story.append(ct)

    if lp.get("set_notes", "").strip():
        story.append(Paragraph("Set Notes", sec))
        story.append(Paragraph(lp["set_notes"].replace("\n", "<br/>"),
                               styles["Normal"]))
    doc.build(story)
    return path


def _grid(rows, rel_widths, inch, colors):
    from reportlab.platypus import Table, TableStyle
    widths = [w * inch for w in rel_widths]
    t = Table(rows, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2b2e38")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#f4f4f6")]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cccccc")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t
