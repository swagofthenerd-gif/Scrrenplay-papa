"""PDF contact sheet: all shots' light plots, two per A4 page.

The 'send to gaffer/AD' artifact: name + diagram + summary per shot.
"""
from __future__ import annotations

from typing import List

from PyQt6.QtCore import QByteArray, QMarginsF, QRectF, Qt
from PyQt6.QtGui import QFont, QPageLayout, QPageSize, QPainter, QPdfWriter
from PyQt6.QtSvg import QSvgRenderer

from .diagram import render_plot_svg
from .plot import LightPlot

PER_PAGE = 2


def write_pdf(plots: List[LightPlot], out_path: str,
              title: str = "Light Plots") -> str:
    if not plots:
        raise ValueError("no plots to export")
    writer = QPdfWriter(out_path)
    writer.setPageSize(QPageSize(QPageSize.PageSizeId.A4))
    writer.setPageMargins(QMarginsF(12, 12, 12, 12),
                          QPageLayout.Unit.Millimeter)
    writer.setResolution(150)
    writer.setTitle(title)

    p = QPainter(writer)
    page_w = writer.width()
    page_h = writer.height()
    slot_h = page_h // PER_PAGE

    header = QFont("Helvetica", 11, QFont.Weight.Bold)
    body = QFont("Helvetica", 8)

    for i, plot in enumerate(plots):
        if i and i % PER_PAGE == 0:
            writer.newPage()
        top = (i % PER_PAGE) * slot_h
        p.setFont(header)
        p.drawText(QRectF(0, top, page_w, 40), 0, plot.name)
        svg = render_plot_svg(plot)
        renderer = QSvgRenderer(QByteArray(svg.encode("utf-8")))
        avail = QRectF(0, top + 46, page_w, slot_h - 110)
        size = renderer.defaultSize()
        scale = min(avail.width() / size.width(),
                    avail.height() / size.height())
        target = QRectF(avail.x(), avail.y(),
                        size.width() * scale, size.height() * scale)
        renderer.render(p, target)
        p.setFont(body)
        flags = int(Qt.TextFlag.TextWordWrap.value) | \
            int(Qt.AlignmentFlag.AlignLeft.value)
        p.drawText(QRectF(0, target.bottom() + 6, page_w, 52), flags,
                   plot.summary or plot.mood)
    p.end()
    return out_path
