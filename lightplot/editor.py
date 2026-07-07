"""The embeddable light-plot editor: canvas + toolbar + properties + breakdown.

Standalone gui.py wraps this in a QMainWindow with file handling;
ScrivenLight embeds it in a dialog attached to a storyboard frame.
"""
from __future__ import annotations

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QAction, QKeySequence
from PyQt6.QtWidgets import (QMenu, QPlainTextEdit, QSplitter, QToolBar,
                             QToolButton, QVBoxLayout, QWidget)

from .canvas import PlotScene, PlotView
from .commands import AddObjectCommand, RemoveObjectCommand
from .plot import (LightPlot, Move, PlotLight, SetElement, Subject, CAMERA_ID,
                   KIND_DOOR, KIND_FLAG, KIND_FURNITURE, KIND_WALL, KIND_WINDOW)
from .props import PropertiesPanel
from .rig import ROLES, ROLE_KEY

_TWO_CLICK_TOOLS = {"wall": KIND_WALL, "door": KIND_DOOR, "window": KIND_WINDOW,
                    "flag": KIND_FLAG, "furniture": KIND_FURNITURE}


class _ToolScene(PlotScene):
    """PlotScene + click-placement tools driven by the editor."""

    def __init__(self, editor, parent=None):
        super().__init__(parent)
        self.editor = editor
        self.pending_tool = None
        self.pending_points = []

    def tool_click(self, x_m: float, y_m: float):
        """Programmatic click for tools (also used by tests)."""
        tool = self.pending_tool
        if tool in _TWO_CLICK_TOOLS:
            self.pending_points.append([x_m, y_m])
            if len(self.pending_points) == 2:
                el = SetElement(kind=_TWO_CLICK_TOOLS[tool],
                                points=list(self.pending_points))
                self.undo_stack.push(AddObjectCommand(self, "set", el))
                self.editor.end_tool()
        elif tool == "move":
            self.pending_points.append([x_m, y_m])
        elif tool == "light":
            light = PlotLight(x=x_m, y=y_m, role=self.editor.pending_role)
            self.undo_stack.push(AddObjectCommand(self, "light", light))
            self.editor.end_tool()
        elif tool == "subject":
            s = Subject(x=x_m, y=y_m, name=f"Subject {len(self.plot.subjects) + 1}")
            self.undo_stack.push(AddObjectCommand(self, "subject", s))
            self.editor.end_tool()

    def commit_move_tool(self):
        if self.pending_tool == "move" and len(self.pending_points) >= 2:
            target = self.editor.move_target_id or self.plot.primary_subject().id
            mv = Move(target_id=target, waypoints=list(self.pending_points))
            self.undo_stack.push(AddObjectCommand(self, "move", mv))
        self.editor.end_tool()

    def mousePressEvent(self, ev):
        if self.pending_tool:
            p = ev.scenePos()
            from .canvas import px2m
            self.tool_click(*px2m(p))
            ev.accept()
            return
        super().mousePressEvent(ev)

    def mouseDoubleClickEvent(self, ev):
        if self.pending_tool == "move":
            self.commit_move_tool()
            ev.accept()
            return
        super().mouseDoubleClickEvent(ev)


class PlotEditorWidget(QWidget):
    plotEdited = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.pending_role = ROLE_KEY
        self.move_target_id = ""
        self._build_ui()
        self.set_plot(LightPlot())

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        self.scene = _ToolScene(self)
        self.scene.plotChanged.connect(self._refresh_breakdown)
        self.scene.plotChanged.connect(self.plotEdited.emit)
        self.scene.selectionTarget.connect(self._track_move_target)

        bar = QToolBar()
        # Add Light with role menu
        light_btn = QToolButton()
        light_btn.setText("＋ Light")
        menu = QMenu(light_btn)
        for role in ROLES:
            menu.addAction(role.capitalize(),
                           lambda r=role: self._arm_light(r))
        light_btn.setMenu(menu)
        light_btn.setPopupMode(QToolButton.ToolButtonPopupMode.InstantPopup)
        bar.addWidget(light_btn)
        bar.addAction("＋ Subject", lambda: self.start_tool("subject"))
        for name in ("wall", "door", "window", "flag", "furniture"):
            bar.addAction(f"＋ {name.capitalize()}",
                          lambda n=name: self.start_tool(n))
        bar.addAction("＋ Move arrow", lambda: self.start_tool("move"))
        bar.addSeparator()
        dup = QAction("Duplicate", self)
        dup.setShortcut(QKeySequence("Ctrl+D"))
        dup.triggered.connect(self.duplicate_selection)
        bar.addAction(dup)
        delete = QAction("Delete", self)
        delete.setShortcut(QKeySequence.StandardKey.Delete)
        delete.triggered.connect(self.delete_selection)
        bar.addAction(delete)
        bar.addSeparator()
        undo = self.scene.undo_stack.createUndoAction(self, "Undo")
        undo.setShortcut(QKeySequence.StandardKey.Undo)
        redo = self.scene.undo_stack.createRedoAction(self, "Redo")
        redo.setShortcut(QKeySequence.StandardKey.Redo)
        bar.addAction(undo)
        bar.addAction(redo)
        bar.addSeparator()
        bar.addAction("Fit", lambda: self.view.fit())
        snap = QAction("Snap", self)
        snap.setCheckable(True)
        snap.setChecked(True)
        snap.toggled.connect(lambda v: setattr(self.scene, "snap_to_grid", v))
        bar.addAction(snap)
        layout.addWidget(bar)

        split = QSplitter(Qt.Orientation.Horizontal)
        self.view = PlotView(self.scene)
        split.addWidget(self.view)
        right = QSplitter(Qt.Orientation.Vertical)
        self.props = PropertiesPanel()
        self.props.set_scene(self.scene)
        right.addWidget(self.props)
        self.breakdown = QPlainTextEdit()
        self.breakdown.setReadOnly(True)
        right.addWidget(self.breakdown)
        split.addWidget(right)
        split.setStretchFactor(0, 3)
        split.setStretchFactor(1, 1)
        layout.addWidget(split, 1)

    # ---------------------------------------------------------- plot API
    def set_plot(self, plot: LightPlot):
        self.scene.set_plot(plot)
        self._refresh_breakdown()

    def plot(self) -> LightPlot:
        return self.scene.plot

    # ---------------------------------------------------------- actions
    def _arm_light(self, role: str):
        self.pending_role = role
        self.start_tool("light")

    def add_light(self, role: str = ROLE_KEY):
        """Immediate add near the subject (menu default / tests)."""
        s = self.plot().primary_subject()
        light = PlotLight(x=s.x - 1.2, y=s.y + 1.0, role=role)
        self.scene.undo_stack.push(AddObjectCommand(self.scene, "light", light))

    def add_subject(self):
        self.scene.tool_click(0.8, 0.0) if self.scene.pending_tool == "subject" \
            else self.scene.undo_stack.push(AddObjectCommand(
                self.scene, "subject",
                Subject(x=0.8, y=0.0,
                        name=f"Subject {len(self.plot().subjects) + 1}")))

    def start_tool(self, name: str):
        self.scene.pending_tool = name
        self.scene.pending_points = []

    def end_tool(self):
        self.scene.pending_tool = None
        self.scene.pending_points = []

    def keyPressEvent(self, ev):
        if ev.key() == Qt.Key.Key_Escape and self.scene.pending_tool:
            self.end_tool()
            return
        super().keyPressEvent(ev)

    def _selected(self):
        return [it for it in self.scene.selectedItems() if hasattr(it, "kind")]

    def delete_selection(self):
        for it in self._selected():
            self.scene.undo_stack.push(RemoveObjectCommand(
                self.scene, it.kind, it.obj_id))

    def duplicate_selection(self):
        import copy
        from .plot import _new_id
        for it in self._selected():
            if it.kind not in ("light", "subject", "set"):
                continue
            clone = copy.deepcopy(it.obj)
            clone.id = _new_id()
            clone.x += 0.5
            clone.y += 0.5
            if hasattr(clone, "points") and clone.points:
                clone.points = [[px + 0.5, py + 0.5] for px, py in clone.points]
            if hasattr(clone, "primary"):
                clone.primary = False
            self.scene.undo_stack.push(AddObjectCommand(
                self.scene, it.kind, clone))

    def _track_move_target(self, kind, obj_id):
        if kind in ("subject", "camera"):
            self.move_target_id = obj_id if kind == "subject" else CAMERA_ID

    # ---------------------------------------------------------- breakdown
    def _refresh_breakdown(self):
        plot = self.plot()
        rig = plot.to_rig()
        lines = [plot.name, ""]
        if plot.mood or plot.key_fill_ratio:
            lines.append(f"{plot.mood} · key/fill {plot.key_fill_ratio}".strip(" ·"))
        for src in rig.lights:
            lines.append(f"[{src.role.upper()}] {src.position_label()}")
            lines.append(f"   {src.softness_label()} · {src.modifier} · "
                         f"{src.ct_label()} · {src.intensity * 100:.0f}%")
        if plot.summary:
            lines += ["", plot.summary]
        self.breakdown.setPlainText("\n".join(lines))
