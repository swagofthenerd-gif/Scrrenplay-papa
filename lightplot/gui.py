"""Standalone app shell around PlotEditorWidget.

`LightingVisualizerWidget` keeps its name and embed contract (plain
QWidget) so ScrivenLight can add it as a tab. It adds file handling,
starting points (blank / template / analyze / describe), and exports.
"""
from __future__ import annotations

import os
import sys

from PyQt6.QtCore import Qt, QByteArray, QThread, pyqtSignal
from PyQt6.QtGui import QAction, QImage, QPainter, QPixmap
from PyQt6.QtSvg import QSvgRenderer
from PyQt6.QtWidgets import (QApplication, QFileDialog, QInputDialog, QLabel,
                             QMainWindow, QMenu, QMessageBox, QToolBar,
                             QToolButton, QVBoxLayout, QWidget)

from .diagram import render_plot_svg
from .editor import PlotEditorWidget
from .plot import LightPlot
from .templates import TEMPLATES

APP_NAME = "Papa Light Plot"

DARK_QSS = """
QWidget { background: #14161c; color: #e8e6df; font-size: 13px; }
QToolBar { background: #1b1e27; border: 0; spacing: 8px; padding: 6px; }
QPushButton, QComboBox, QToolButton {
    background: #2c313d; border: 1px solid #3a4150; border-radius: 5px;
    padding: 6px 14px; }
QPushButton:hover, QComboBox:hover, QToolButton:hover { border-color: #e0a458; }
QLabel#hint { color: #9aa0ad; font-size: 15px; }
QScrollArea { border: 0; }
QPlainTextEdit { background: #1b1e27; border: 0; }
"""

FILE_FILTER = "Light plot (*.lightplot.json *.json)"


class _AnalyzeWorker(QThread):
    done = pyqtSignal(object)
    failed = pyqtSignal(str)

    def __init__(self, path, backend, parent=None):
        super().__init__(parent)
        self._path, self._backend = path, backend

    def run(self):
        try:
            from .analyze import analyze
            self.done.emit(analyze(self._path, backend=self._backend))
        except Exception as e:
            self.failed.emit(str(e))


class LightingVisualizerWidget(QWidget):
    """Editor + file/new/export toolbar. Embeddable (plain QWidget)."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._path = ""
        self._worker = None
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        bar = QToolBar()
        new_btn = QToolButton()
        new_btn.setText("New ▾")
        new_menu = QMenu(new_btn)
        new_menu.addAction("Blank", self.new_blank)
        tmpl = new_menu.addMenu("From template")
        for name in TEMPLATES:
            tmpl.addAction(name, lambda n=name: self.new_from_template(n))
        new_menu.addAction("Describe the look… (Claude)", self._describe_dialog)
        new_menu.addAction("Analyze image…", self._analyze_dialog)
        new_btn.setMenu(new_menu)
        new_btn.setPopupMode(QToolButton.ToolButtonPopupMode.InstantPopup)
        bar.addWidget(new_btn)
        bar.addAction("Open…", self._open_dialog)
        bar.addAction("Save", self._save)
        bar.addAction("Save As…", self._save_as_dialog)
        export_btn = QToolButton()
        export_btn.setText("Export ▾")
        exp_menu = QMenu(export_btn)
        exp_menu.addAction("SVG…", self._export_svg_dialog)
        exp_menu.addAction("PNG…", self._export_png_dialog)
        exp_menu.addAction("Side-by-side PNG…", self._export_side_by_side_dialog)
        export_btn.setMenu(exp_menu)
        export_btn.setPopupMode(QToolButton.ToolButtonPopupMode.InstantPopup)
        bar.addWidget(export_btn)
        self._exp_menu = exp_menu
        self.status = QLabel("")
        bar.addWidget(self.status)
        layout.addWidget(bar)

        self.editor = PlotEditorWidget()
        layout.addWidget(self.editor, 1)

    # ------------------------------------------------------ starting points
    def new_blank(self):
        self.editor.set_plot(LightPlot())
        self._path = ""

    def new_from_template(self, name: str):
        self.editor.set_plot(TEMPLATES[name]())
        self._path = ""

    def analyze_file(self, path: str, backend: str = "auto"):
        self.status.setText("  analyzing…")
        self._worker = _AnalyzeWorker(path, backend, self)
        self._worker.done.connect(
            lambda rig: (self.editor.set_plot(
                LightPlot.from_rig(rig, ref_image=path)),
                self.status.setText(f"  {rig.analyzer} · {rig.mood}")))
        self._worker.failed.connect(self._error)
        self._worker.start()

    def _analyze_dialog(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "Analyze reference image", "",
            "Images (*.png *.jpg *.jpeg *.webp *.bmp *.tif *.tiff)")
        if path:
            self.analyze_file(path)

    def _describe_dialog(self):
        from .claude_backend import claude_available
        if not claude_available():
            QMessageBox.information(
                self, APP_NAME,
                "Describe-to-setup needs the 'anthropic' package and an API "
                "credential.\nMeanwhile, start from a template instead.")
            return
        text, ok = QInputDialog.getMultiLineText(
            self, "Describe the look",
            "Describe the lighting you want, in DOP language:")
        if not ok or not text.strip():
            return
        self.status.setText("  drafting setup…")
        try:
            from .claude_backend import describe_to_rig
            rig = describe_to_rig(text.strip())
            plot = LightPlot.from_rig(rig)
            plot.name = text.strip().splitlines()[0][:60]
            self.editor.set_plot(plot)
            self.status.setText(f"  {rig.analyzer}")
        except Exception as e:
            self._error(str(e))

    # ------------------------------------------------------ file handling
    def load_file(self, path: str):
        try:
            with open(path, "r", encoding="utf-8") as f:
                self.editor.set_plot(LightPlot.from_json(f.read()))
            self._path = path
            self.status.setText(f"  {os.path.basename(path)}")
        except Exception as e:
            self._error(f"Could not open {os.path.basename(path)}: {e}")

    def save_file(self, path: str):
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(self.editor.plot().to_json())
            self._path = path
            self.status.setText(f"  saved {os.path.basename(path)}")
        except Exception as e:
            self._error(str(e))

    def _open_dialog(self):
        path, _ = QFileDialog.getOpenFileName(self, "Open light plot", "",
                                              FILE_FILTER)
        if path:
            self.load_file(path)

    def _save(self):
        if self._path:
            self.save_file(self._path)
        else:
            self._save_as_dialog()

    def _save_as_dialog(self):
        base = self.editor.plot().name.replace("/", "-") or "setup"
        path, _ = QFileDialog.getSaveFileName(
            self, "Save light plot", f"{base}.lightplot.json", FILE_FILTER)
        if path:
            self.save_file(path)

    # ------------------------------------------------------ exports
    def export_svg(self, path: str):
        with open(path, "w", encoding="utf-8") as f:
            f.write(render_plot_svg(self.editor.plot()))
        self.status.setText(f"  exported {os.path.basename(path)}")

    def export_png(self, path: str, scale: int = 2):
        svg = render_plot_svg(self.editor.plot())
        renderer = QSvgRenderer(QByteArray(svg.encode("utf-8")))
        size = renderer.defaultSize() * scale
        img = QImage(size, QImage.Format.Format_ARGB32)
        img.fill(0)
        p = QPainter(img)
        renderer.render(p)
        p.end()
        img.save(path)
        self.status.setText(f"  exported {os.path.basename(path)}")

    def _export_svg_dialog(self):
        path, _ = QFileDialog.getSaveFileName(
            self, "Export SVG", "lightplot.svg", "SVG (*.svg)")
        if path:
            self.export_svg(path)

    def _export_png_dialog(self):
        path, _ = QFileDialog.getSaveFileName(
            self, "Export PNG", "lightplot.png", "PNG (*.png)")
        if path:
            self.export_png(path)

    def _export_side_by_side_dialog(self):
        from .composite import side_by_side_png
        path, _ = QFileDialog.getSaveFileName(
            self, "Export side-by-side", "lightplot-board.png", "PNG (*.png)")
        if not path:
            return
        try:
            side_by_side_png(self.editor.plot(), path)
            self.status.setText(f"  exported {os.path.basename(path)}")
        except ValueError as e:
            self._error(str(e))

    def _error(self, msg: str):
        # Always surface in the status bar; only raise a modal box when the
        # widget is actually on screen (a modal in headless tests would hang).
        self.status.setText(f"  ⚠ {msg}")
        if self.isVisible():
            QMessageBox.warning(self, APP_NAME, msg)


def main(argv=None):
    app = QApplication(argv or sys.argv)
    app.setApplicationName(APP_NAME)
    app.setStyleSheet(DARK_QSS)
    win = QMainWindow()
    win.setWindowTitle(APP_NAME)
    widget = LightingVisualizerWidget()
    win.setCentralWidget(widget)
    win.resize(1320, 800)
    win.show()
    args = [a for a in (argv or sys.argv)[1:] if not a.startswith("-")]
    if args and os.path.isfile(args[0]):
        if args[0].endswith(".json"):
            widget.load_file(args[0])
        else:
            widget.analyze_file(args[0])
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
