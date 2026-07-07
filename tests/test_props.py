import os
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

import pytest
from PyQt6.QtWidgets import QApplication

from lightplot.canvas import PlotScene
from lightplot.props import PropertiesPanel
from lightplot.templates import TEMPLATES


@pytest.fixture(scope="session")
def app():
    return QApplication.instance() or QApplication([])


def make(app):
    scene = PlotScene()
    scene.set_plot(TEMPLATES["Three-Point"]())
    panel = PropertiesPanel()
    panel.set_scene(scene)
    return scene, panel


def test_panel_shows_light_form_on_selection(app):
    scene, panel = make(app)
    light = scene.plot.lights[0]
    scene.selectionTarget.emit("light", light.id)
    assert panel.current_kind == "light"
    assert panel.fields["intensity"].value() == pytest.approx(light.intensity)


def test_editing_field_pushes_undoable_command(app):
    scene, panel = make(app)
    light = scene.plot.lights[0]
    scene.selectionTarget.emit("light", light.id)
    panel.fields["color_temp_k"].setValue(3200)
    panel.commit_field("color_temp_k")
    assert light.color_temp_k == 3200
    scene.undo_stack.undo()
    assert light.color_temp_k == 5600


def test_plot_level_form_edits_name(app):
    scene, panel = make(app)
    scene.selectionTarget.emit("plot", "")
    panel.fields["name"].setText("Sc 4 — WS kitchen")
    panel.commit_field("name")
    assert scene.plot.name == "Sc 4 — WS kitchen"


def test_subject_primary_toggle(app):
    scene, panel = make(app)
    subj = scene.plot.subjects[0]
    scene.selectionTarget.emit("subject", subj.id)
    assert panel.fields["name"].text() == subj.name
