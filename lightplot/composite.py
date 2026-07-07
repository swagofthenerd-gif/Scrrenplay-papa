"""Side-by-side export: reference still + light plot in one image."""
from __future__ import annotations

import os

from PIL import Image
from PyQt6.QtCore import QByteArray
from PyQt6.QtGui import QImage, QPainter
from PyQt6.QtSvg import QSvgRenderer

from .diagram import render_plot_svg
from .plot import LightPlot

PANEL_H = 660 * 2  # 2x plot render for crispness
GAP = 24
BG = (20, 22, 28)


def _plot_png_bytes(plot: LightPlot) -> Image.Image:
    svg = render_plot_svg(plot)
    renderer = QSvgRenderer(QByteArray(svg.encode("utf-8")))
    size = renderer.defaultSize() * 2
    qimg = QImage(size, QImage.Format.Format_ARGB32)
    qimg.fill(0)
    p = QPainter(qimg)
    renderer.render(p)
    p.end()
    buf = qimg.constBits()
    buf.setsize(qimg.sizeInBytes())
    img = Image.frombuffer("RGBA", (qimg.width(), qimg.height()), bytes(buf),
                           "raw", "BGRA", qimg.bytesPerLine())
    return img.convert("RGB")


def side_by_side_png(plot: LightPlot, out_path: str,
                     ref_image_path: str = "") -> str:
    ref_path = ref_image_path or plot.ref_image
    if not ref_path or not os.path.isfile(ref_path):
        raise ValueError("plot has no reference image to composite")
    plot_img = _plot_png_bytes(plot)
    ref = Image.open(ref_path).convert("RGB")
    scale = plot_img.height / ref.height
    ref = ref.resize((max(1, int(ref.width * scale)), plot_img.height),
                     Image.LANCZOS)
    canvas = Image.new("RGB",
                       (ref.width + GAP + plot_img.width, plot_img.height), BG)
    canvas.paste(ref, (0, 0))
    canvas.paste(plot_img, (ref.width + GAP, 0))
    canvas.save(out_path)
    return out_path
