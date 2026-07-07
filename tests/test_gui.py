import os
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

import pytest
from PyQt6.QtWidgets import QApplication

from lightplot.gui import LightingVisualizerWidget
from lightplot.plot import LightPlot
from tests.conftest import synthetic_portrait


@pytest.fixture(scope="session")
def app():
    return QApplication.instance() or QApplication([])


def test_new_from_template_and_save_load(app, tmp_path):
    w = LightingVisualizerWidget()
    w.new_from_template("Book Light")
    path = tmp_path / "setup.lightplot.json"
    w.save_file(str(path))
    w2 = LightingVisualizerWidget()
    w2.load_file(str(path))
    assert w2.editor.plot().name == "Book Light"


def test_analyze_file_lands_in_editor(app, tmp_path):
    img = tmp_path / "still.png"
    synthetic_portrait().save(img)
    w = LightingVisualizerWidget()
    w.analyze_file(str(img), backend="heuristic")
    w._worker.wait()
    QApplication.processEvents()
    assert w.editor.plot().analyzer == "heuristic"
    assert w.editor.plot().lights


def test_export_svg(app, tmp_path):
    w = LightingVisualizerWidget()
    w.new_from_template("Three-Point")
    out = tmp_path / "plot.svg"
    w.export_svg(str(out))
    assert out.read_text().startswith("<svg")


def test_load_malformed_file_does_not_crash(app, tmp_path):
    bad = tmp_path / "bad.lightplot.json"
    bad.write_text("{not json")
    w = LightingVisualizerWidget()
    w.load_file(str(bad))                    # shows error via status, no raise
    assert isinstance(w.editor.plot(), LightPlot)
