"""Undoable operations on a PlotScene's LightPlot model.

Every command mutates the MODEL only, then calls scene.sync() so the
QGraphicsScene rebuilds/repositions items. Simple and reliable: the scene
is always a pure function of the model.
"""
from __future__ import annotations

from PyQt6.QtGui import QUndoCommand

from .plot import CAMERA_ID

_LISTS = {"light": "lights", "subject": "subjects",
          "set": "set_elements", "move": "moves"}


def model_list(plot, kind):
    return getattr(plot, _LISTS[kind])


def find_obj(plot, kind, obj_id):
    if kind == "camera":
        return plot.camera
    for o in model_list(plot, kind):
        if o.id == obj_id:
            return o
    return None


class MoveItemCommand(QUndoCommand):
    def __init__(self, scene, kind, obj_id, old_xy, new_xy):
        super().__init__(f"move {kind}")
        self.scene, self.kind, self.obj_id = scene, kind, obj_id
        self.old_xy, self.new_xy = tuple(old_xy), tuple(new_xy)

    def _apply(self, xy):
        obj = find_obj(self.scene.plot, self.kind, self.obj_id)
        if obj is not None:
            dx, dy = xy[0] - obj.x, xy[1] - obj.y
            obj.x, obj.y = xy
            # set elements / moves carry their geometry in absolute points:
            # translate them together with the anchor
            if hasattr(obj, "points") and obj.points:
                obj.points = [[px + dx, py + dy] for px, py in obj.points]
            if hasattr(obj, "waypoints") and obj.waypoints:
                obj.waypoints = [[px + dx, py + dy] for px, py in obj.waypoints]
        self.scene.sync()

    def redo(self):
        self._apply(self.new_xy)

    def undo(self):
        self._apply(self.old_xy)


class AddObjectCommand(QUndoCommand):
    def __init__(self, scene, kind, obj):
        super().__init__(f"add {kind}")
        self.scene, self.kind, self.obj = scene, kind, obj

    def redo(self):
        model_list(self.scene.plot, self.kind).append(self.obj)
        self.scene.sync()

    def undo(self):
        model_list(self.scene.plot, self.kind).remove(self.obj)
        self.scene.sync()


class RemoveObjectCommand(QUndoCommand):
    """Remove an object. Guards: never removes the camera or the last
    subject; removing a subject removes its moves and reassigns primary."""

    def __init__(self, scene, kind, obj_id):
        super().__init__(f"remove {kind}")
        self.scene, self.kind, self.obj_id = scene, kind, obj_id
        self.obj = None
        self.removed_moves = []
        self.was_primary = False

    def redo(self):
        plot = self.scene.plot
        if self.kind == "camera":
            self.setObsolete(True)
            return
        if self.kind == "subject" and len(plot.subjects) <= 1:
            self.setObsolete(True)
            return
        self.obj = find_obj(plot, self.kind, self.obj_id)
        if self.obj is None:
            self.setObsolete(True)
            return
        model_list(plot, self.kind).remove(self.obj)
        if self.kind == "subject":
            self.removed_moves = [m for m in plot.moves
                                  if m.target_id == self.obj_id]
            for m in self.removed_moves:
                plot.moves.remove(m)
            self.was_primary = self.obj.primary
            if self.was_primary and plot.subjects:
                plot.subjects[0].primary = True
        self.scene.sync()

    def undo(self):
        plot = self.scene.plot
        if self.obj is None:
            return
        model_list(plot, self.kind).append(self.obj)
        plot.moves.extend(self.removed_moves)
        if self.was_primary:
            for s in plot.subjects:
                s.primary = s.id == self.obj_id
        self.scene.sync()


class EditFieldCommand(QUndoCommand):
    def __init__(self, scene, kind, obj_id, field, old, new):
        super().__init__(f"edit {field}")
        self.scene, self.kind, self.obj_id = scene, kind, obj_id
        self.field, self.old, self.new = field, old, new

    def _apply(self, value):
        target = (self.scene.plot if self.kind == "plot"
                  else find_obj(self.scene.plot, self.kind, self.obj_id))
        if target is not None:
            setattr(target, self.field, value)
        self.scene.sync()

    def redo(self):
        self._apply(self.new)

    def undo(self):
        self._apply(self.old)
