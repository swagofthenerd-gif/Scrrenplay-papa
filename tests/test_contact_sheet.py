import os
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

import pytest
from PyQt6.QtWidgets import QApplication

from lightplot.contact_sheet import write_pdf
from lightplot.templates import TEMPLATES


@pytest.fixture(scope="session")
def app():
    return QApplication.instance() or QApplication([])


def test_writes_valid_pdf_for_multiple_plots(app, tmp_path):
    plots = [f() for f in TEMPLATES.values()]      # 7 plots -> 4 pages
    out = tmp_path / "board.pdf"
    write_pdf(plots, str(out), title="Sc 12 lighting")
    data = out.read_bytes()
    assert data.startswith(b"%PDF")
    assert len(data) > 5000


def test_empty_list_raises(app, tmp_path):
    with pytest.raises(ValueError, match="no plots"):
        write_pdf([], str(tmp_path / "x.pdf"))
