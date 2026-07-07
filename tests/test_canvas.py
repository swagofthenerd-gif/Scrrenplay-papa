import os
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

import pytest
from PyQt6.QtWidgets import QApplication

from lightplot.canvas import PlotScene
from lightplot.commands import (MoveItemCommand, AddObjectCommand,
                                RemoveObjectCommand, EditFieldCommand)
from lightplot.plot import LightPlot, PlotLight, Subject
from lightplot.templates import TEMPLATES


@pytest.fixture(scope="session")
def app():
    return QApplication.instance() or QApplication([])


def make_scene(app):
    scene = PlotScene()
    scene.set_plot(TEMPLATES["Three-Point"]())
    return scene


def test_scene_populates_items(app):
    scene = make_scene(app)
    kinds = {it.kind for it in scene.items() if hasattr(it, "kind")}
    assert {"light", "subject", "camera"} <= kinds


def test_move_command_updates_model_and_undoes(app):
    scene = make_scene(app)
    light = scene.plot.lights[0]
    old = (light.x, light.y)
    scene.undo_stack.push(MoveItemCommand(scene, "light", light.id, old, (-2.0, 0.5)))
    assert (light.x, light.y) == (-2.0, 0.5)
    scene.undo_stack.undo()
    assert (light.x, light.y) == old


def test_add_and_remove_commands(app):
    scene = make_scene(app)
    n = len(scene.plot.lights)
    new = PlotLight(x=1.0, y=-1.0)
    scene.undo_stack.push(AddObjectCommand(scene, "light", new))
    assert len(scene.plot.lights) == n + 1
    scene.undo_stack.push(RemoveObjectCommand(scene, "light", new.id))
    assert len(scene.plot.lights) == n
    scene.undo_stack.undo()
    assert len(scene.plot.lights) == n + 1


def test_edit_field_command(app):
    scene = make_scene(app)
    light = scene.plot.lights[0]
    scene.undo_stack.push(EditFieldCommand(scene, "light", light.id,
                                           "color_temp_k", light.color_temp_k, 3200))
    assert light.color_temp_k == 3200
    scene.undo_stack.undo()
    assert light.color_temp_k == 5600


def test_guard_cannot_remove_last_subject(app):
    scene = make_scene(app)
    subj = scene.plot.subjects[0]
    cmd = RemoveObjectCommand(scene, "subject", subj.id)
    scene.undo_stack.push(cmd)
    assert len(scene.plot.subjects) == 1        # guard: command was a no-op


def test_removing_subject_removes_its_moves(app):
    from lightplot.plot import Move
    scene = make_scene(app)
    extra = Subject(name="Tom", x=1, y=0)
    scene.undo_stack.push(AddObjectCommand(scene, "subject", extra))
    scene.plot.moves.append(Move(target_id=extra.id, waypoints=[[1, 0], [2, 0]]))
    scene.sync()
    scene.undo_stack.push(RemoveObjectCommand(scene, "subject", extra.id))
    assert all(m.target_id != extra.id for m in scene.plot.moves)
