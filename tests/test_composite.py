import os
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

import pytest
from PIL import Image

from lightplot.composite import side_by_side_png
from lightplot.plot import LightPlot
from lightplot.templates import TEMPLATES
from tests.conftest import synthetic_portrait


def test_side_by_side_composites(tmp_path):
    from PyQt6.QtWidgets import QApplication
    QApplication.instance() or QApplication([])
    ref = tmp_path / "ref.png"
    synthetic_portrait().save(ref)
    plot = TEMPLATES["Rembrandt"]()
    plot.ref_image = str(ref)
    out = tmp_path / "board.png"
    side_by_side_png(plot, str(out))
    img = Image.open(out)
    assert img.width > img.height          # two panels side by side


def test_missing_reference_raises(tmp_path):
    with pytest.raises(ValueError, match="reference image"):
        side_by_side_png(LightPlot(), str(tmp_path / "x.png"))
