"""Interactive god's-eye canvas: QGraphicsScene items for every plot entity.

The scene is a pure function of the LightPlot model: sync() rebuilds all
items from the model. Dragging moves the item live; on release a single
MoveItemCommand is pushed so undo restores the pre-drag position.
"""
from __future__ import annotations

import math

from PyQt6.QtCore import Qt, QPointF, QRectF, pyqtSignal
from PyQt6.QtGui import (QBrush, QColor, QPainter, QPainterPath, QPen,
                         QPolygonF, QUndoStack)
from PyQt6.QtWidgets import (QGraphicsItem, QGraphicsScene, QGraphicsView)

from .commands import MoveItemCommand
from .diagram import kelvin_to_hex
from .plot import (LightPlot, CAMERA_ID, KIND_FURNITURE, KIND_FLAG,
                   KIND_WINDOW, KIND_WALL, KIND_DOOR)

METER_PX = 78.0
BG = QColor("#14161c")
GRID = QColor("#242833")
INK = QColor("#e8e6df")
DIM = QColor("#9aa0ad")
ACCENT = QColor("#e0a458")


def m2px(x_m, y_m) -> QPointF:
    return QPointF(x_m * METER_PX, y_m * METER_PX)


def px2m(pos: QPointF):
    return pos.x() / METER_PX, pos.y() / METER_PX


class _PlotItem(QGraphicsItem):
    """Base: draggable, reports kind + model id, pushes undo on drag end."""
    kind = ""

    def __init__(self, scene: "PlotScene", obj):
        super().__init__()
        self._scene = scene
        self.obj = obj
        self.setFlag(QGraphicsItem.GraphicsItemFlag.ItemIsMovable, True)
        self.setFlag(QGraphicsItem.GraphicsItemFlag.ItemIsSelectable, True)
        self.setFlag(QGraphicsItem.GraphicsItemFlag.ItemSendsGeometryChanges, True)
        self.setPos(m2px(obj.x, obj.y))
        self._drag_start = None

    @property
    def obj_id(self):
        return getattr(self.obj, "id", CAMERA_ID)

    def mousePressEvent(self, ev):
        self._drag_start = (self.obj.x, self.obj.y)
        super().mousePressEvent(ev)

    def mouseReleaseEvent(self, ev):
        super().mouseReleaseEvent(ev)
        new = px2m(self.pos())
        if self._scene.snap_to_grid:
            new = (round(new[0] * 4) / 4, round(new[1] * 4) / 4)  # 25 cm grid
        if self._drag_start and (abs(new[0] - self._drag_start[0]) > 1e-6
                                 or abs(new[1] - self._drag_start[1]) > 1e-6):
            self._scene.undo_stack.push(MoveItemCommand(
                self._scene, self.kind, self.obj_id, self._drag_start, new))
        self._drag_start = None

    def itemChange(self, change, value):
        if change == QGraphicsItem.GraphicsItemChange.ItemPositionHasChanged:
            self._scene.live_moved(self)
        return super().itemChange(change, value)


class LightItem(_PlotItem):
    kind = "light"

    def boundingRect(self):
        return QRectF(-24, -24, 48, 60)

    def paint(self, p: QPainter, opt, widget=None):
        color = QColor(kelvin_to_hex(self.obj.color_temp_k))
        size = 11 + 13 * self.obj.softness
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        pen = QPen(ACCENT if self.isSelected() else BG, 1.5)
        p.setPen(pen)
        p.setBrush(QBrush(color))
        # aim toward the primary subject (live)
        s = self._scene.plot.primary_subject()
        tgt = m2px(s.x, s.y) - self.pos()
        ang = math.degrees(math.atan2(tgt.y(), tgt.x()))
        p.save()
        p.rotate(ang + 90)
        if self.obj.softness >= 0.4:
            p.drawRoundedRect(QRectF(-size / 2, -5, size, 10), 3, 3)
        else:
            p.drawEllipse(QRectF(-8, -8, 16, 16))
        p.restore()
        p.setPen(QPen(INK))
        p.drawText(QRectF(-24, 14, 48, 16), Qt.AlignmentFlag.AlignHCenter,
                   self.obj.role.upper())


class SubjectItem(_PlotItem):
    kind = "subject"

    def boundingRect(self):
        return QRectF(-34, -30, 68, 48)

    def paint(self, p, opt, widget=None):
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        ring = ACCENT if (self.obj.primary or self.isSelected()) else INK
        p.setPen(QPen(ring, 1.5))
        p.setBrush(QBrush(QColor("#3a4150")))
        p.save()
        p.rotate(self.obj.facing_deg)
        p.drawEllipse(QRectF(-30, -12, 60, 24))
        p.setBrush(QBrush(QColor("#535d70")))
        p.drawEllipse(QRectF(-10, -10, 20, 20))
        p.setBrush(QBrush(INK))
        p.drawEllipse(QRectF(-3, 5, 6, 6))   # nose dot = facing
        p.restore()
        p.setPen(QPen(DIM))
        p.drawText(QRectF(-34, -30, 68, 12), Qt.AlignmentFlag.AlignHCenter,
                   self.obj.name.upper())


class CameraItem(_PlotItem):
    kind = "camera"

    def boundingRect(self):
        return QRectF(-20, -22, 40, 56)

    def paint(self, p, opt, widget=None):
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.setPen(QPen(ACCENT if self.isSelected() else INK, 1.5))
        p.setBrush(QBrush(QColor("#2c313d")))
        p.save()
        p.rotate(self.obj.aim_deg)
        p.drawRoundedRect(QRectF(-16, -10, 32, 22), 4, 4)
        p.drawRoundedRect(QRectF(-6, -16, 12, 8), 2, 2)
        p.restore()
        p.setPen(QPen(DIM))
        p.drawText(QRectF(-20, 18, 40, 14), Qt.AlignmentFlag.AlignHCenter,
                   (self.obj.label or "CAM").upper())


class SetElementItem(_PlotItem):
    """Set elements store absolute points; the item sits at points[0] and
    drags translate ALL points (handled in the move command by the scene)."""
    kind = "set"

    _COLORS = {KIND_WALL: INK, KIND_DOOR: DIM, KIND_WINDOW: QColor("#7fb4ff"),
               KIND_FLAG: QColor("#000000"), KIND_FURNITURE: DIM}

    def __init__(self, scene, obj):
        # anchor at first point; expose obj.x/obj.y virtually for _PlotItem
        obj.x, obj.y = obj.points[0][0], obj.points[0][1]
        super().__init__(scene, obj)

    def boundingRect(self):
        xs = [p[0] for p in self.obj.points]
        ys = [p[1] for p in self.obj.points]
        w = (max(xs) - min(xs)) * METER_PX + 20
        h = (max(ys) - min(ys)) * METER_PX + 20
        return QRectF(-10, -10, max(w, 20), max(h, 20))

    def paint(self, p, opt, widget=None):
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        color = self._COLORS.get(self.obj.kind, DIM)
        pen = QPen(ACCENT if self.isSelected() else color,
                   5 if self.obj.kind in (KIND_WALL, KIND_WINDOW) else 3)
        if self.obj.kind == KIND_WINDOW:
            pen.setStyle(Qt.PenStyle.DashLine)
        p.setPen(pen)
        ox, oy = self.obj.points[0]
        pts = [QPointF((x - ox) * METER_PX, (y - oy) * METER_PX)
               for x, y in self.obj.points]
        if self.obj.kind == KIND_FURNITURE and len(pts) >= 2:
            p.setBrush(Qt.BrushStyle.NoBrush)
            p.drawRect(QRectF(pts[0], pts[-1]).normalized())
        else:
            for a, b in zip(pts, pts[1:]):
                p.drawLine(a, b)
        if self.obj.label:
            p.setPen(QPen(DIM))
            p.drawText(QPointF(0, -8), self.obj.label)


class MoveArrowItem(_PlotItem):
    kind = "move"

    def __init__(self, scene, obj):
        obj.x, obj.y = obj.waypoints[0][0], obj.waypoints[0][1]
        super().__init__(scene, obj)
        self.setFlag(QGraphicsItem.GraphicsItemFlag.ItemIsMovable, False)

    def boundingRect(self):
        xs = [p[0] for p in self.obj.waypoints]
        ys = [p[1] for p in self.obj.waypoints]
        return QRectF(-10, -10, (max(xs) - min(xs)) * METER_PX + 20,
                      (max(ys) - min(ys)) * METER_PX + 20)

    def paint(self, p, opt, widget=None):
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        pen = QPen(ACCENT, 2, Qt.PenStyle.DashLine)
        p.setPen(pen)
        ox, oy = self.obj.waypoints[0]
        pts = [QPointF((x - ox) * METER_PX, (y - oy) * METER_PX)
               for x, y in self.obj.waypoints]
        for a, b in zip(pts, pts[1:]):
            p.drawLine(a, b)
        if len(pts) >= 2:  # arrowhead
            a, b = pts[-2], pts[-1]
            ang = math.atan2(b.y() - a.y(), b.x() - a.x())
            for da in (math.radians(150), -math.radians(150)):
                p.drawLine(b, b + QPointF(10 * math.cos(ang + da),
                                          10 * math.sin(ang + da)))
        if self.obj.label:
            p.drawText(pts[-1] + QPointF(8, -6), self.obj.label)


class PlotScene(QGraphicsScene):
    plotChanged = pyqtSignal()
    selectionTarget = pyqtSignal(str, str)      # kind, obj_id

    def __init__(self, parent=None):
        super().__init__(parent)
        self.plot = LightPlot()
        self.undo_stack = QUndoStack(self)
        self.snap_to_grid = True
        self.setSceneRect(-5 * METER_PX, -5 * METER_PX,
                          10 * METER_PX, 10 * METER_PX)
        self.setBackgroundBrush(QBrush(BG))
        self.selectionChanged.connect(self._on_selection)
        # Connect a bound method (not a lambda) so Qt uses `self` as the
        # receiver context and auto-disconnects when the scene is destroyed;
        # a lambda would fire during teardown against a deleted C++ object.
        self.undo_stack.indexChanged.connect(self._reemit_changed)

    # ---- model <-> scene -------------------------------------------
    def set_plot(self, plot: LightPlot):
        self.plot = plot
        self.undo_stack.clear()
        self.sync()

    def sync(self):
        """Rebuild all items from the model."""
        self.blockSignals(True)
        self.clear()
        for e in self.plot.set_elements:
            if e.points:
                self.addItem(SetElementItem(self, e))
        for m in self.plot.moves:
            if len(m.waypoints) >= 2:
                self.addItem(MoveArrowItem(self, m))
        for s in self.plot.subjects:
            self.addItem(SubjectItem(self, s))
        self.addItem(CameraItem(self, self.plot.camera))
        for l in self.plot.lights:
            self.addItem(LightItem(self, l))
        self.blockSignals(False)
        self.update()
        self.plotChanged.emit()

    def _reemit_changed(self, _index):
        self.plotChanged.emit()

    def find_model(self, kind, obj_id):
        from .commands import find_obj
        return find_obj(self.plot, kind, obj_id)

    def live_moved(self, item):
        """During drag: update model transiently so beams/labels track."""
        x, y = px2m(item.pos())
        item.obj.x, item.obj.y = x, y
        if item.kind == "set":
            ox, oy = item.obj.points[0]
            dx, dy = x - ox, y - oy
            item.obj.points = [[px + dx, py + dy] for px, py in item.obj.points]
        self.update()

    def drawBackground(self, p: QPainter, rect: QRectF):
        super().drawBackground(p, rect)
        p.setPen(QPen(GRID, 0))
        step = METER_PX / 2
        x = math.floor(rect.left() / step) * step
        while x < rect.right():
            p.drawLine(QPointF(x, rect.top()), QPointF(x, rect.bottom()))
            x += step
        y = math.floor(rect.top() / step) * step
        while y < rect.bottom():
            p.drawLine(QPointF(rect.left(), y), QPointF(rect.right(), y))
            y += step
        # meter rings around primary subject
        s = self.plot.primary_subject()
        c = m2px(s.x, s.y)
        pen = QPen(GRID, 1, Qt.PenStyle.DashLine)
        p.setPen(pen)
        for m in (1, 2, 3):
            r = m * METER_PX
            p.drawEllipse(c, r, r)

    def _on_selection(self):
        sel = self.selectedItems()
        if sel and hasattr(sel[0], "kind"):
            self.selectionTarget.emit(sel[0].kind, sel[0].obj_id)
        else:
            self.selectionTarget.emit("plot", "")


class PlotView(QGraphicsView):
    def __init__(self, scene, parent=None):
        super().__init__(scene, parent)
        self.setRenderHint(QPainter.RenderHint.Antialiasing)
        self.setDragMode(QGraphicsView.DragMode.RubberBandDrag)
        self.setTransformationAnchor(
            QGraphicsView.ViewportAnchor.AnchorUnderMouse)

    def wheelEvent(self, ev):
        factor = 1.15 if ev.angleDelta().y() > 0 else 1 / 1.15
        self.scale(factor, factor)

    def fit(self):
        rect = self.scene().itemsBoundingRect().adjusted(-60, -60, 60, 60)
        self.fitInView(rect, Qt.AspectRatioMode.KeepAspectRatio)
