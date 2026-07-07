import os
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

import pytest
from PyQt6.QtWidgets import QApplication

from lightplot.editor import PlotEditorWidget
from lightplot.plot import LightPlot, KIND_WALL
from lightplot.rig import ROLE_FILL
from lightplot.templates import TEMPLATES


@pytest.fixture(scope="session")
def app():
    return QApplication.instance() or QApplication([])


def test_editor_constructs_and_loads_template(app):
    ed = PlotEditorWidget()
    ed.set_plot(TEMPLATES["Rembrandt"]())
    assert ed.plot().name == "Rembrandt"
    assert "KEY" in ed.breakdown.toPlainText().upper()


def test_add_light_is_undoable(app):
    ed = PlotEditorWidget()
    ed.set_plot(LightPlot())
    n = len(ed.plot().lights)
    ed.add_light(ROLE_FILL)
    assert len(ed.plot().lights) == n + 1
    ed.scene.undo_stack.undo()
    assert len(ed.plot().lights) == n


def test_delete_selection_respects_guards(app):
    ed = PlotEditorWidget()
    ed.set_plot(TEMPLATES["Three-Point"]())
    # select the only subject via the scene item
    for it in ed.scene.items():
        if getattr(it, "kind", "") == "subject":
            it.setSelected(True)
    ed.delete_selection()
    assert len(ed.plot().subjects) == 1     # guard held


def test_duplicate_light(app):
    ed = PlotEditorWidget()
    ed.set_plot(TEMPLATES["Three-Point"]())
    n = len(ed.plot().lights)
    for it in ed.scene.items():
        if getattr(it, "kind", "") == "light":
            it.setSelected(True)
            break
    ed.duplicate_selection()
    assert len(ed.plot().lights) == n + 1


def test_wall_tool_two_clicks(app):
    ed = PlotEditorWidget()
    ed.set_plot(LightPlot())
    ed.start_tool("wall")
    ed.scene.tool_click(-2.0, -1.5)
    ed.scene.tool_click(2.0, -1.5)
    walls = [e for e in ed.plot().set_elements if e.kind == KIND_WALL]
    assert len(walls) == 1
    assert walls[0].points == [[-2.0, -1.5], [2.0, -1.5]]


def test_breakdown_updates_after_edit(app):
    ed = PlotEditorWidget()
    ed.set_plot(TEMPLATES["Three-Point"]())
    before = ed.breakdown.toPlainText()
    light = ed.plot().lights[0]
    from lightplot.commands import EditFieldCommand
    ed.scene.undo_stack.push(EditFieldCommand(
        ed.scene, "light", light.id, "color_temp_k", 5600, 3200))
    assert ed.breakdown.toPlainText() != before
    assert "3200" in ed.breakdown.toPlainText()
