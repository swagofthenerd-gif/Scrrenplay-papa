"""PyQt6 GUI for lightplot.

`LightingVisualizerWidget` is a plain QWidget so it can run standalone
today and later be embedded into ScrivenLight as one more tab:

    from lightplot.gui import LightingVisualizerWidget
    tabs.addTab(LightingVisualizerWidget(), "Light Plot")

`main()` wraps the same widget in a QMainWindow for standalone use.
"""
from __future__ import annotations

import os
import sys

from PyQt6.QtCore import Qt, QThread, pyqtSignal, QByteArray
from PyQt6.QtGui import QPixmap, QImage, QPainter, QAction
from PyQt6.QtSvg import QSvgRenderer
from PyQt6.QtWidgets import (QApplication, QComboBox, QFileDialog, QHBoxLayout,
                             QLabel, QMainWindow, QMessageBox, QPushButton,
                             QScrollArea, QSplitter, QToolBar, QVBoxLayout,
                             QWidget)

from .analyze import analyze
from .diagram import render_svg
from .rig import LightingRig

APP_NAME = "Papa Light Plot"

DARK_QSS = """
QWidget { background: #14161c; color: #e8e6df; font-size: 13px; }
QToolBar { background: #1b1e27; border: 0; spacing: 8px; padding: 6px; }
QPushButton, QComboBox {
    background: #2c313d; border: 1px solid #3a4150; border-radius: 5px;
    padding: 6px 14px; }
QPushButton:hover, QComboBox:hover { border-color: #e0a458; }
QLabel#hint { color: #9aa0ad; font-size: 15px; }
QScrollArea { border: 0; }
"""


class _AnalyzeWorker(QThread):
    done = pyqtSignal(object)     # LightingRig
    failed = pyqtSignal(str)

    def __init__(self, path: str, backend: str, parent=None):
        super().__init__(parent)
        self._path, self._backend = path, backend

    def run(self):
        try:
            self.done.emit(analyze(self._path, backend=self._backend))
        except Exception as e:  # surfaced in the UI
            self.failed.emit(str(e))


class _SvgView(QLabel):
    """Renders an SVG string to a pixmap at the widget's resolution."""

    def __init__(self):
        super().__init__()
        self._svg = ""
        self.setMinimumSize(480, 330)
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)

    def set_svg(self, svg: str):
        self._svg = svg
        self._render()

    def resizeEvent(self, ev):
        super().resizeEvent(ev)
        if self._svg:
            self._render()

    def _render(self):
        renderer = QSvgRenderer(QByteArray(self._svg.encode("utf-8")))
        size = renderer.defaultSize()
        size.scale(self.width(), self.height(), Qt.AspectRatioMode.KeepAspectRatio)
        img = QImage(size, QImage.Format.Format_ARGB32)
        img.fill(0)
        p = QPainter(img)
        renderer.render(p)
        p.end()
        self.setPixmap(QPixmap.fromImage(img))


class LightingVisualizerWidget(QWidget):
    """Analyze an image's lighting and show the god's-eye light plot."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.rig: LightingRig | None = None
        self._image_path = ""
        self._worker: _AnalyzeWorker | None = None
        self._build_ui()

    # ------------------------------------------------------------- UI
    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        bar = QToolBar()
        open_act = QAction("Open Image…", self)
        open_act.triggered.connect(self.open_image)
        bar.addAction(open_act)

        self.backend_box = QComboBox()
        self.backend_box.addItems(["auto", "heuristic", "claude"])
        self.backend_box.setToolTip(
            "heuristic: offline CV analysis.\n"
            "claude: Claude vision (needs the anthropic package + API access).\n"
            "auto: claude when available, else heuristic.")
        bar.addWidget(QLabel(" Analyzer: "))
        bar.addWidget(self.backend_box)

        self.reanalyze_btn = QPushButton("Re-analyze")
        self.reanalyze_btn.clicked.connect(self._start_analysis)
        self.reanalyze_btn.setEnabled(False)
        bar.addWidget(self.reanalyze_btn)

        self.export_btn = QPushButton("Export…")
        self.export_btn.clicked.connect(self.export)
        self.export_btn.setEnabled(False)
        bar.addWidget(self.export_btn)

        self.status = QLabel("")
        bar.addWidget(self.status)
        layout.addWidget(bar)

        split = QSplitter(Qt.Orientation.Horizontal)

        self.image_view = QLabel(
            "Open a reference image\nto visualize its lighting setup")
        self.image_view.setObjectName("hint")
        self.image_view.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.image_view.setMinimumWidth(280)
        img_scroll = QScrollArea()
        img_scroll.setWidget(self.image_view)
        img_scroll.setWidgetResizable(True)
        split.addWidget(img_scroll)

        self.svg_view = _SvgView()
        split.addWidget(self.svg_view)
        split.setStretchFactor(0, 2)
        split.setStretchFactor(1, 3)
        layout.addWidget(split, 1)

    # -------------------------------------------------------- actions
    def open_image(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "Open reference image", "",
            "Images (*.png *.jpg *.jpeg *.webp *.bmp *.tif *.tiff)")
        if not path:
            return
        self._image_path = path
        pix = QPixmap(path)
        self.image_view.setPixmap(pix.scaled(
            520, 640, Qt.AspectRatioMode.KeepAspectRatio,
            Qt.TransformationMode.SmoothTransformation))
        self.reanalyze_btn.setEnabled(True)
        self._start_analysis()

    def _start_analysis(self):
        if not self._image_path or (self._worker and self._worker.isRunning()):
            return
        self.status.setText("  analyzing…")
        self._worker = _AnalyzeWorker(self._image_path,
                                      self.backend_box.currentText(), self)
        self._worker.done.connect(self._on_rig)
        self._worker.failed.connect(self._on_error)
        self._worker.start()

    def _on_rig(self, rig: LightingRig):
        self.rig = rig
        self.svg_view.set_svg(render_svg(rig))
        self.status.setText(f"  {rig.analyzer} · {rig.mood}")
        self.export_btn.setEnabled(True)

    def _on_error(self, msg: str):
        self.status.setText("")
        QMessageBox.warning(self, APP_NAME, f"Analysis failed:\n{msg}")

    def export(self):
        if not self.rig:
            return
        base = os.path.splitext(os.path.basename(self._image_path))[0]
        path, chosen = QFileDialog.getSaveFileName(
            self, "Export light plot", f"{base}-lightplot.svg",
            "SVG diagram (*.svg);;PNG image (*.png);;Rig JSON (*.json)")
        if not path:
            return
        if chosen.startswith("Rig JSON") or path.endswith(".json"):
            with open(path, "w", encoding="utf-8") as f:
                f.write(self.rig.to_json())
        elif chosen.startswith("PNG") or path.endswith(".png"):
            svg = render_svg(self.rig)
            renderer = QSvgRenderer(QByteArray(svg.encode("utf-8")))
            size = renderer.defaultSize() * 2  # 2x for crispness
            img = QImage(size, QImage.Format.Format_ARGB32)
            img.fill(0)
            p = QPainter(img)
            renderer.render(p)
            p.end()
            img.save(path)
        else:
            with open(path, "w", encoding="utf-8") as f:
                f.write(render_svg(self.rig))
        self.status.setText(f"  exported {os.path.basename(path)}")


def main(argv=None):
    app = QApplication(argv or sys.argv)
    app.setApplicationName(APP_NAME)
    app.setStyleSheet(DARK_QSS)
    win = QMainWindow()
    win.setWindowTitle(APP_NAME)
    widget = LightingVisualizerWidget()
    win.setCentralWidget(widget)
    win.resize(1240, 720)
    win.show()
    # allow `python -m lightplot --gui image.jpg`
    args = [a for a in (argv or sys.argv)[1:] if not a.startswith("-")]
    if args and os.path.isfile(args[0]):
        widget._image_path = args[0]
        widget.image_view.setPixmap(QPixmap(args[0]).scaled(
            520, 640, Qt.AspectRatioMode.KeepAspectRatio,
            Qt.TransformationMode.SmoothTransformation))
        widget.reanalyze_btn.setEnabled(True)
        widget._start_analysis()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
