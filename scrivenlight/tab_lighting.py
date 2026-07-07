"""
Lighting tab — a schematic "lighting breakdown" / lighting-diagram editor.

This is the DP's tool: a top-down plan of one setup where you drop numbered
fixtures (key / fill / back / practical / diffusion / negative-fill flags /
ambient spill) around a subject and camera, dial each fixture's modifier,
intensity and gel, and get a numbered legend + set notes that read straight
off the diagram — the same deliverable as a printed lighting breakdown.

Layout:
  Left   — list of lighting plans (+ add / delete / generate from storyboard)
  Centre — draggable top-down diagram (room, camera, subject, fixtures) with a
           fixture toolbar
  Right  — selected-fixture editor, an auto-generated legend, and the plan's
           camera / lens / set-notes fields

Plans bind to project.lightplans (list of dicts). Positions are normalized
(0..1) so the diagram is resolution-independent and the .slt stays portable.
"""

import os

from PyQt6.QtWidgets import (
    QWidget, QHBoxLayout, QVBoxLayout, QListWidget, QListWidgetItem,
    QLineEdit, QPlainTextEdit, QComboBox, QLabel, QToolButton, QFrame,
    QScrollArea, QFileDialog, QGridLayout, QGraphicsView, QGraphicsScene,
    QGraphicsItem, QMessageBox, QMenu)
from PyQt6.QtGui import (QPixmap, QPainter, QPen, QBrush, QColor, QFont,
                         QPolygonF)
from PyQt6.QtCore import Qt, pyqtSignal, QRectF, QPointF, QTimer

from .project import (Project, FIXTURE_TYPES, FIXTURE_ORDER, FIXTURE_MODIFIERS,
                      FIXTURE_INTENSITIES, GELS, LIGHTPLAN_DROPDOWNS,
                      LIGHT_UNITS, new_fixture, new_lightplan)


# ---- canvas geometry (scene units) ----
CANVAS_W, CANVAS_H = 720, 500
PAD = 48
NODE_R = 15


# --- plan projection (flat top-down) ---
def _plan_proj(nx, ny):
    return QPointF(PAD + nx * (CANVAS_W - 2 * PAD),
                   PAD + ny * (CANVAS_H - 2 * PAD))


def _plan_unproj(pt):
    nx = (pt.x() - PAD) / (CANVAS_W - 2 * PAD)
    ny = (pt.y() - PAD) / (CANVAS_H - 2 * PAD)
    return nx, ny


# --- room projection (one-point perspective: a receding floor) ---
# ny is depth (0 = far / background wall, 1 = near / camera side); the far edge
# is higher on screen and inset horizontally, so the floor reads as a room seen
# from the front. Forward and inverse are exact inverses, so drag round-trips.
ISO_TOP = 132.0
ISO_BOTTOM = 448.0
ISO_INSET = 148.0
ISO_LEFT = 74.0
ISO_RIGHT = CANVAS_W - 74.0
WALL_H = 118.0


def _room_edges(depth):
    inset = (1.0 - depth) * ISO_INSET
    return ISO_LEFT + inset, ISO_RIGHT - inset


def _room_proj(nx, ny):
    y = ISO_TOP + ny * (ISO_BOTTOM - ISO_TOP)
    left, right = _room_edges(ny)
    return QPointF(left + nx * (right - left), y)


def _room_unproj(pt):
    depth = (pt.y() - ISO_TOP) / (ISO_BOTTOM - ISO_TOP)
    left, right = _room_edges(depth)
    nx = (pt.x() - left) / (right - left) if right != left else 0.5
    return nx, depth


def _clamp01(v):
    return max(0.0, min(1.0, v))


# ============================================================= draggable nodes

class _Draggable(QGraphicsItem):
    """Base for the movable diagram nodes. Reports drag as it happens (to
    refresh beams) and on release (to commit normalized coords + full redraw)."""

    def __init__(self, canvas, on_select):
        super().__init__()
        self._canvas = canvas
        self._on_select = on_select
        self.setFlags(
            QGraphicsItem.GraphicsItemFlag.ItemIsMovable |
            QGraphicsItem.GraphicsItemFlag.ItemIsSelectable |
            QGraphicsItem.GraphicsItemFlag.ItemSendsGeometryChanges)
        self.setZValue(10)

    def itemChange(self, change, value):
        if change == QGraphicsItem.GraphicsItemChange.ItemPositionChange \
                and self.scene() is not None:
            # snap onto the valid surface by clamping in normalized space and
            # re-projecting — keeps items inside the room/plan in either view
            nx, ny = self._canvas.unproj(value)
            nx = min(max(nx, 0.0), 1.0)
            ny = min(max(ny, 0.0), 1.0)
            value = self._canvas.proj(nx, ny)
        if change == QGraphicsItem.GraphicsItemChange.ItemPositionHasChanged:
            self._canvas._on_node_dragged()
        return super().itemChange(change, value)

    def mousePressEvent(self, e):
        if self._on_select:
            self._on_select()
        super().mousePressEvent(e)

    def mouseReleaseEvent(self, e):
        super().mouseReleaseEvent(e)
        self._canvas._on_node_released()


class FixtureItem(_Draggable):
    def __init__(self, canvas, number, fixture, on_select):
        super().__init__(canvas, on_select)
        self.number = number
        self.fixture = fixture
        self.color = QColor(FIXTURE_TYPES.get(
            fixture.get("type", "key"), {}).get("color", "#888888"))

    def boundingRect(self):
        r = NODE_R + 3
        # room view raises the head on a stand, so extend the bounds upward
        top = -r - (28 if self._canvas._mode == "room" else 0)
        return QRectF(-r, top, 2 * r, (NODE_R + 3) - top)

    def paint(self, p, opt, w=None):
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        sel = self.isSelected()
        room = self._canvas._mode == "room"
        if room:
            # floor shadow + a little stand so fixtures stand up in the room
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(QBrush(QColor(0, 0, 0, 55)))
            p.drawEllipse(QPointF(0, 2), NODE_R * 0.9, NODE_R * 0.4)
            p.setPen(QPen(QColor(0, 0, 0, 110), 2))
            p.drawLine(QPointF(0, 0), QPointF(0, -26))
        cy = -26 if room else 0
        pen = QPen(QColor("#ffffff") if sel else QColor(0, 0, 0, 90),
                   2.5 if sel else 1.2)
        p.setPen(pen)
        p.setBrush(QBrush(self.color))
        p.drawEllipse(QPointF(0, cy), NODE_R, NODE_R)
        # number badge, centred on the disc
        p.setPen(QPen(QColor("#101010")
                      if self.color.lightnessF() > 0.5 else QColor("#ffffff")))
        f = QFont(); f.setBold(True); f.setPointSize(10); p.setFont(f)
        p.drawText(QRectF(-NODE_R, cy - NODE_R, 2 * NODE_R, 2 * NODE_R),
                   Qt.AlignmentFlag.AlignCenter, str(self.number))


class CameraItem(_Draggable):
    def boundingRect(self):
        return QRectF(-18, -14, 36, 30)

    def paint(self, p, opt, w=None):
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.setPen(QPen(QColor("#ffffff"), 1.5))
        p.setBrush(QBrush(QColor("#20222c")))
        p.drawRoundedRect(QRectF(-14, -9, 22, 16), 3, 3)
        # lens nub pointing up-plane (toward subject/background)
        lens = QPolygonF([QPointF(8, -5), QPointF(16, -2),
                          QPointF(16, 2), QPointF(8, 5)])
        p.drawPolygon(lens)
        p.setPen(QPen(QColor("#cfd1d8")))
        f = QFont(); f.setPointSize(7); f.setBold(True); p.setFont(f)
        p.drawText(QRectF(-20, 8, 40, 12), Qt.AlignmentFlag.AlignCenter, "CAM")


class SubjectItem(_Draggable):
    def boundingRect(self):
        return QRectF(-14, -14, 28, 34)

    def paint(self, p, opt, w=None):
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.setPen(QPen(QColor("#ffffff"), 1.8))
        p.setBrush(QBrush(QColor("#e6533b")))
        p.drawEllipse(QPointF(0, 0), 9, 9)
        p.setPen(QPen(QColor("#cfd1d8")))
        f = QFont(); f.setPointSize(7); f.setBold(True); p.setFont(f)
        p.drawText(QRectF(-22, 11, 44, 12),
                   Qt.AlignmentFlag.AlignCenter, "SUBJECT")


# ===================================================================== canvas

class LightCanvas(QGraphicsView):
    fixtureSelected = pyqtSignal(int)   # index, or -1 for none
    changed = pyqtSignal()

    def __init__(self, parent=None):
        self._scene = QGraphicsScene(0, 0, CANVAS_W, CANVAS_H)
        super().__init__(self._scene, parent)
        self.setObjectName("lightCanvas")
        self.setRenderHint(QPainter.RenderHint.Antialiasing)
        self.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.setMinimumHeight(360)
        self._lp = None
        self._fx_items = []
        self._cam_item = None
        self._subj_item = None
        self._beam_items = []
        self._dark = True
        self._mode = "plan"          # "plan" (top-down) or "room" (isometric)
        self._beam_timer = QTimer(self)
        self._beam_timer.setSingleShot(True)
        self._beam_timer.setInterval(30)
        self._beam_timer.timeout.connect(self._refresh_beams)

    # -------- projection (mode-aware) --------
    def proj(self, nx, ny):
        return _room_proj(nx, ny) if self._mode == "room" else _plan_proj(nx, ny)

    def unproj(self, pt):
        return _room_unproj(pt) if self._mode == "room" else _plan_unproj(pt)

    def resizeEvent(self, e):
        super().resizeEvent(e)
        self.fitInView(self._scene.sceneRect(), Qt.AspectRatioMode.KeepAspectRatio)

    def set_dark(self, dark):
        self._dark = dark
        self.rebuild()

    def set_mode(self, mode):
        if mode != self._mode:
            self._mode = mode
            self.rebuild()

    def set_plan(self, lp):
        self._lp = lp
        self.rebuild()

    # -------- drag plumbing --------
    def _on_node_dragged(self):
        # cheap live update: write coords, redraw beams only (keep nodes)
        self._commit_positions()
        self._beam_timer.start()

    def _on_node_released(self):
        self._commit_positions()
        self.changed.emit()
        QTimer.singleShot(0, self.rebuild)

    def _commit_positions(self):
        if self._lp is None:
            return
        if self._cam_item is not None:
            x, y = self.unproj(self._cam_item.pos())
            self._lp["camera"] = {"x": _clamp01(x), "y": _clamp01(y)}
        if self._subj_item is not None:
            x, y = self.unproj(self._subj_item.pos())
            self._lp["subject"] = {"x": _clamp01(x), "y": _clamp01(y)}
        for it in self._fx_items:
            x, y = self.unproj(it.pos())
            it.fixture["x"] = _clamp01(x)
            it.fixture["y"] = _clamp01(y)

    # -------- drawing --------
    def rebuild(self):
        self._scene.clear()
        self._fx_items = []
        self._beam_items = []
        self._cam_item = self._subj_item = None
        if self._lp is None:
            return
        if self._mode == "room":
            self._draw_room_iso()
        else:
            self._draw_plan()
        subj = self._lp.get("subject", {"x": 0.5, "y": 0.5})
        cam = self._lp.get("camera", {"x": 0.5, "y": 0.86})

        for i, fx in enumerate(self._lp.get("fixtures", [])):
            self._draw_beam(fx, subj)

        self._subj_item = SubjectItem(self, lambda: self.fixtureSelected.emit(-1))
        self._subj_item.setPos(self.proj(subj.get("x", 0.5), subj.get("y", 0.5)))
        self._scene.addItem(self._subj_item)

        self._cam_item = CameraItem(self, lambda: self.fixtureSelected.emit(-1))
        self._cam_item.setPos(self.proj(cam.get("x", 0.5), cam.get("y", 0.86)))
        self._scene.addItem(self._cam_item)

        for i, fx in enumerate(self._lp.get("fixtures", [])):
            it = FixtureItem(self, i + 1, fx,
                             on_select=lambda i=i: self.fixtureSelected.emit(i))
            it.setPos(self.proj(fx.get("x", 0.3), fx.get("y", 0.3)))
            self._scene.addItem(it)
            self._fx_items.append(it)
        self.fitInView(self._scene.sceneRect(), Qt.AspectRatioMode.KeepAspectRatio)

    def select_fixture(self, idx):
        for i, it in enumerate(self._fx_items):
            it.setSelected(i == idx)

    def _bg(self):
        self._scene.setBackgroundBrush(
            QBrush(QColor("#101116") if self._dark else QColor("#e8e8e5")))

    def _draw_plan(self):
        dark = self._dark
        wall = QColor("#2a2d38") if dark else QColor("#c9cbc8")
        floor = QColor("#181a20") if dark else QColor("#f0f0ee")
        grid = QColor(255, 255, 255, 12) if dark else QColor(0, 0, 0, 12)
        txt = QColor("#6b6e78") if dark else QColor("#9a9c9f")

        self._bg()
        room = QRectF(PAD * 0.6, PAD * 0.6,
                      CANVAS_W - PAD * 1.2, CANVAS_H - PAD * 1.2)
        self._scene.addRect(room, QPen(wall, 3), QBrush(floor))
        # faint grid
        step = (CANVAS_W - PAD * 1.2) / 8.0
        x = room.left() + step
        while x < room.right():
            self._scene.addLine(x, room.top(), x, room.bottom(), QPen(grid, 1))
            x += step
        y = room.top() + step
        while y < room.bottom():
            self._scene.addLine(room.left(), y, room.right(), y, QPen(grid, 1))
            y += step
        # orientation labels
        t1 = self._scene.addText("BACKGROUND / TOP OF FRAME", QFont("Inter", 7))
        t1.setDefaultTextColor(txt)
        t1.setPos(room.left() + 6, room.top() + 2)
        t2 = self._scene.addText("CAMERA SIDE", QFont("Inter", 7))
        t2.setDefaultTextColor(txt)
        t2.setPos(room.left() + 6, room.bottom() - 18)

    def _draw_room_iso(self):
        """A one-point-perspective open room: receding floor + back and side
        walls, with a window on the back wall to motivate the key. Purely a
        backdrop — the same fixtures/camera/subject sit on top."""
        dark = self._dark
        self._bg()
        floor_c = QColor("#20222c") if dark else QColor("#ecece9")
        back_c = QColor("#2b2e39") if dark else QColor("#dcdcd8")
        left_c = QColor("#23252f") if dark else QColor("#d2d2ce")
        right_c = QColor("#191b22") if dark else QColor("#c6c6c2")
        edge = QColor("#3a3e4b") if dark else QColor("#b8b9b5")
        grid = QColor(255, 255, 255, 12) if dark else QColor(0, 0, 0, 10)
        txt = QColor("#6b6e78") if dark else QColor("#9a9c9f")

        # floor corners (in scene space)
        fl = _room_proj(0, 0); fr = _room_proj(1, 0)      # far left/right
        nl = _room_proj(0, 1); nr = _room_proj(1, 1)      # near left/right

        def poly(pts):
            return QPolygonF([QPointF(*p) if not isinstance(p, QPointF) else p
                              for p in pts])

        def up(pt, h):
            return QPointF(pt.x(), pt.y() - h)

        # side + back walls first (behind floor grid)
        self._scene.addPolygon(poly([nl, fl, up(fl, WALL_H), up(nl, WALL_H)]),
                               QPen(edge, 1.5), QBrush(left_c))
        self._scene.addPolygon(poly([nr, fr, up(fr, WALL_H), up(nr, WALL_H)]),
                               QPen(edge, 1.5), QBrush(right_c))
        self._scene.addPolygon(poly([fl, fr, up(fr, WALL_H), up(fl, WALL_H)]),
                               QPen(edge, 1.5), QBrush(back_c))
        # window on the back wall (motivated key source)
        w0 = _room_proj(0.55, 0); w1 = _room_proj(0.88, 0)
        win = QColor("#3d5170") if dark else QColor("#cfe0f2")
        self._scene.addPolygon(
            poly([up(w0, WALL_H * 0.28), up(w1, WALL_H * 0.28),
                  up(w1, WALL_H * 0.82), up(w0, WALL_H * 0.82)]),
            QPen(edge, 1.2), QBrush(win))
        wlbl = self._scene.addText("WINDOW", QFont("Inter", 6))
        wlbl.setDefaultTextColor(txt)
        wlbl.setPos(up(w0, WALL_H * 0.86))

        # floor
        self._scene.addPolygon(poly([fl, fr, nr, nl]),
                               QPen(edge, 1.5), QBrush(floor_c))
        # floor depth grid
        for t in (0.25, 0.5, 0.75):
            a = _room_proj(0, t); b = _room_proj(1, t)
            self._scene.addLine(a.x(), a.y(), b.x(), b.y(), QPen(grid, 1))
        for t in (0.25, 0.5, 0.75):
            a = _room_proj(t, 0); b = _room_proj(t, 1)
            self._scene.addLine(a.x(), a.y(), b.x(), b.y(), QPen(grid, 1))

        t2 = self._scene.addText("CAMERA SIDE", QFont("Inter", 7))
        t2.setDefaultTextColor(txt)
        t2.setPos(nl.x(), nl.y() + 2)

    def _draw_beam(self, fx, subj):
        ftype = fx.get("type", "key")
        meta = FIXTURE_TYPES.get(ftype, {})
        col = QColor(meta.get("color", "#888888"))
        fp = self.proj(fx.get("x", 0.3), fx.get("y", 0.3))
        sp = self.proj(subj.get("x", 0.5), subj.get("y", 0.5))
        if meta.get("aims"):
            # translucent throw toward the subject
            beam = QColor(col); beam.setAlpha(70)
            pen = QPen(beam, 6)
            pen.setCapStyle(Qt.PenCapStyle.RoundCap)
            line = self._scene.addLine(fp.x(), fp.y(), sp.x(), sp.y(), pen)
            line.setZValue(1)
            self._beam_items.append(line)
        elif ftype == "flag":
            # negative fill: a short black bar perpendicular to the subject line
            dx, dy = sp.x() - fp.x(), sp.y() - fp.y()
            import math
            d = math.hypot(dx, dy) or 1
            nx, ny = -dy / d, dx / d
            bar = self._scene.addLine(fp.x() - nx * 16, fp.y() - ny * 16,
                                      fp.x() + nx * 16, fp.y() + ny * 16,
                                      QPen(QColor("#111111"), 5))
            bar.setZValue(1)
            self._beam_items.append(bar)
        else:
            # practical / diffusion / ambient: dashed influence line
            dash = QColor(col); dash.setAlpha(120)
            pen = QPen(dash, 1.6, Qt.PenStyle.DashLine)
            line = self._scene.addLine(fp.x(), fp.y(), sp.x(), sp.y(), pen)
            line.setZValue(1)
            self._beam_items.append(line)

    def _refresh_beams(self):
        for it in self._beam_items:
            self._scene.removeItem(it)
        self._beam_items = []
        if self._lp is None or self._subj_item is None:
            return
        subj = {}
        subj["x"], subj["y"] = self.unproj(self._subj_item.pos())
        for it in self._fx_items:
            fx = dict(it.fixture)
            fx["x"], fx["y"] = self.unproj(it.pos())
            self._draw_beam(fx, subj)


# ================================================================= the tab

FIELD_LABELS = {
    "name": "Plan Name", "scene": "Scene", "shot": "Shot #",
    "camera_body": "Camera Body", "lens": "Lens Series",
    "focal_length": "Focal Length", "aperture": "Aperture (T-stop)",
    "camera_height": "Camera Height", "camera_angle": "Camera Angle",
}
CAMERA_FIELDS = ["camera_body", "lens", "focal_length", "aperture",
                 "camera_height", "camera_angle"]


class LightingTab(QWidget):
    changed = pyqtSignal()

    def __init__(self, project: Project, parent=None):
        super().__init__(parent)
        self.project = project
        self._current = None       # current light plan dict
        self._fx_idx = -1          # selected fixture index
        self._loading = False
        self.meta_widgets = {}
        self.fx_widgets = {}

        root = QHBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        root.addWidget(self._build_list())
        root.addWidget(self._build_centre(), 1)
        root.addWidget(self._build_side())

        self.reload()

    # ---------- left: plan list ----------
    def _build_list(self):
        left = QFrame(); left.setObjectName("sbList"); left.setFixedWidth(210)
        ll = QVBoxLayout(left)
        ll.setContentsMargins(12, 14, 10, 12); ll.setSpacing(8)
        cap = QLabel("LIGHTING PLANS"); cap.setObjectName("caption")
        ll.addWidget(cap)
        self.listw = QListWidget(); self.listw.setObjectName("nav")
        self.listw.setFrameShape(QFrame.Shape.NoFrame)
        self.listw.currentRowChanged.connect(self._select_plan)
        ll.addWidget(self.listw, 1)
        rowb = QHBoxLayout()
        addb = QToolButton(); addb.setObjectName("gridBtn"); addb.setText("+ Plan")
        addb.clicked.connect(self._add_plan)
        delb = QToolButton(); delb.setObjectName("gridBtn"); delb.setText("Delete")
        delb.clicked.connect(self._delete_plan)
        rowb.addWidget(addb); rowb.addWidget(delb)
        ll.addLayout(rowb)
        genb = QToolButton(); genb.setObjectName("gridBtn")
        genb.setText("⟳ Generate from Storyboard")
        genb.clicked.connect(self._generate)
        ll.addWidget(genb)
        return left

    # ---------- centre: canvas + toolbar ----------
    def _build_centre(self):
        mid = QFrame(); mid.setObjectName("lightMid")
        v = QVBoxLayout(mid)
        v.setContentsMargins(16, 14, 16, 14); v.setSpacing(10)

        head = QHBoxLayout()
        self.plan_title = QLabel("Lighting Plan")
        self.plan_title.setObjectName("tabHeading")
        head.addWidget(self.plan_title); head.addStretch(1)
        v.addLayout(head)

        # fixture toolbar
        bar = QHBoxLayout(); bar.setSpacing(6)
        add_lbl = QLabel("ADD:"); add_lbl.setObjectName("sbFieldLabel")
        bar.addWidget(add_lbl)
        for ftype in FIXTURE_ORDER:
            meta = FIXTURE_TYPES[ftype]
            b = QToolButton(); b.setObjectName("fxBtn")
            b.setText(meta["label"])
            b.setStyleSheet(
                f"#fxBtn {{ border-left: 10px solid {meta['color']}; }}")
            b.clicked.connect(lambda _=False, t=ftype: self._add_fixture(t))
            bar.addWidget(b)
        bar.addStretch(1)
        view_lbl = QLabel("VIEW:"); view_lbl.setObjectName("sbFieldLabel")
        bar.addWidget(view_lbl)
        self.plan_btn = QToolButton(); self.plan_btn.setObjectName("viewBtn")
        self.plan_btn.setText("Plan"); self.plan_btn.setCheckable(True)
        self.plan_btn.setChecked(True)
        self.room_btn = QToolButton(); self.room_btn.setObjectName("viewBtn")
        self.room_btn.setText("Room"); self.room_btn.setCheckable(True)
        self.plan_btn.clicked.connect(lambda: self._set_view("plan"))
        self.room_btn.clicked.connect(lambda: self._set_view("room"))
        bar.addWidget(self.plan_btn); bar.addWidget(self.room_btn)
        v.addLayout(bar)

        self.canvas = LightCanvas()
        self.canvas.fixtureSelected.connect(self._on_canvas_select)
        self.canvas.changed.connect(self._on_canvas_changed)
        v.addWidget(self.canvas, 1)

        hint = QLabel("Drag the camera, subject, and fixtures. "
                      "Beams show throw toward the subject.")
        hint.setObjectName("hint")
        v.addWidget(hint)
        return mid

    # ---------- right: fixture editor + legend + camera ----------
    def _build_side(self):
        self.scroll = QScrollArea(); self.scroll.setObjectName("sbScroll")
        self.scroll.setWidgetResizable(True)
        self.scroll.setFrameShape(QFrame.Shape.NoFrame)
        self.scroll.setFixedWidth(320)
        host = QWidget(); self.scroll.setWidget(host)
        v = QVBoxLayout(host)
        v.setContentsMargins(16, 16, 16, 22); v.setSpacing(10)

        # reference frame
        ref = QLabel("REFERENCE FRAME"); ref.setObjectName("sbSection")
        v.addWidget(ref)
        self.ref_image = QLabel("No reference")
        self.ref_image.setObjectName("sbImage")
        self.ref_image.setFixedSize(288, 162)
        self.ref_image.setAlignment(Qt.AlignmentFlag.AlignCenter)
        v.addWidget(self.ref_image)
        refrow = QHBoxLayout()
        rb = QToolButton(); rb.setObjectName("gridBtn"); rb.setText("Set…")
        rb.clicked.connect(self._set_ref_image)
        rc = QToolButton(); rc.setObjectName("gridBtn"); rc.setText("Clear")
        rc.clicked.connect(self._clear_ref_image)
        self.draft_btn = QToolButton(); self.draft_btn.setObjectName("gridBtn")
        self.draft_btn.setText("✨ Draft from Frame")
        self.draft_btn.clicked.connect(self._draft_from_frame)
        refrow.addWidget(rb); refrow.addWidget(rc); refrow.addWidget(self.draft_btn)
        refrow.addStretch(1)
        v.addLayout(refrow)

        # fixture editor
        fxs = QLabel("SELECTED FIXTURE"); fxs.setObjectName("sbSection")
        v.addWidget(fxs)
        self.fx_hint = QLabel("Select a fixture on the plan.")
        self.fx_hint.setObjectName("hint")
        v.addWidget(self.fx_hint)
        self.fx_form = QWidget()
        fg = QGridLayout(self.fx_form)
        fg.setContentsMargins(0, 0, 0, 0)
        fg.setHorizontalSpacing(10); fg.setVerticalSpacing(7)
        self._add_fx_row(fg, 0, "type", "Type",
                         [FIXTURE_TYPES[t]["label"] for t in FIXTURE_ORDER],
                         values=FIXTURE_ORDER)
        self._add_fx_row(fg, 1, "unit", "Fixture", LIGHT_UNITS)
        self._add_fx_row(fg, 2, "modifier", "Modifier", FIXTURE_MODIFIERS)
        self._add_fx_row(fg, 3, "intensity", "Intensity", FIXTURE_INTENSITIES)
        self._add_fx_row(fg, 4, "gel", "Gel / Temp", GELS)
        lbl = QLabel("Notes"); lbl.setObjectName("sbFieldLabel")
        fg.addWidget(lbl, 5, 0)
        self.fx_notes = QPlainTextEdit(); self.fx_notes.setObjectName("csField")
        self.fx_notes.setFixedHeight(46)
        self.fx_notes.textChanged.connect(
            lambda: self._commit_fixture("notes", self.fx_notes.toPlainText()))
        self.fx_widgets["notes"] = self.fx_notes
        fg.addWidget(self.fx_notes, 5, 1)
        delrow = QHBoxLayout()
        delb = QToolButton(); delb.setObjectName("gridBtn")
        delb.setText("Delete Fixture")
        delb.clicked.connect(self._delete_fixture)
        delrow.addStretch(1); delrow.addWidget(delb)
        fg.addLayout(delrow, 6, 0, 1, 2)
        v.addWidget(self.fx_form)

        # legend
        leg = QLabel("LIGHT LEGEND"); leg.setObjectName("sbSection")
        v.addWidget(leg)
        self.legend = QLabel("—"); self.legend.setObjectName("legend")
        self.legend.setWordWrap(True)
        self.legend.setTextFormat(Qt.TextFormat.RichText)
        v.addWidget(self.legend)

        # camera & lens + set notes
        cam = QLabel("CAMERA & LENS"); cam.setObjectName("sbSection")
        v.addWidget(cam)
        cg = QGridLayout(); cg.setHorizontalSpacing(10); cg.setVerticalSpacing(7)
        for i, f in enumerate(CAMERA_FIELDS):
            lbl = QLabel(FIELD_LABELS[f]); lbl.setObjectName("sbFieldLabel")
            cg.addWidget(lbl, i, 0)
            cg.addWidget(self._make_meta_input(f), i, 1)
        v.addLayout(cg)

        note = QLabel("SET NOTES"); note.setObjectName("sbSection")
        v.addWidget(note)
        self.set_notes = QPlainTextEdit(); self.set_notes.setObjectName("csField")
        self.set_notes.setFixedHeight(70)
        self.set_notes.textChanged.connect(
            lambda: self._commit_meta("set_notes", self.set_notes.toPlainText()))
        self.meta_widgets["set_notes"] = self.set_notes
        v.addWidget(self.set_notes)
        v.addStretch(1)
        return self.scroll

    def _add_fx_row(self, grid, row, key, label, items, values=None):
        lbl = QLabel(label); lbl.setObjectName("sbFieldLabel")
        grid.addWidget(lbl, row, 0)
        w = QComboBox(); w.setEditable(key not in ("type",))
        if key == "type":
            for it, val in zip(items, values):
                w.addItem(it, val)
            w.currentIndexChanged.connect(
                lambda idx, k=key: self._commit_fixture(k, w.itemData(idx)))
        else:
            w.addItem("")
            w.addItems(items)
            w.currentTextChanged.connect(
                lambda t, k=key: self._commit_fixture(k, t))
        self.fx_widgets[key] = w
        grid.addWidget(w, row, 1)

    def _make_meta_input(self, f):
        if f in LIGHTPLAN_DROPDOWNS:
            w = QComboBox(); w.setEditable(True)
            w.addItem(""); w.addItems(LIGHTPLAN_DROPDOWNS[f])
            w.currentTextChanged.connect(lambda t, k=f: self._commit_meta(k, t))
        else:
            w = QLineEdit(); w.setObjectName("csField")
            w.textChanged.connect(lambda t, k=f: self._commit_meta(k, t))
        self.meta_widgets[f] = w
        return w

    # ---------- plan list ops ----------
    def reload(self):
        self.listw.blockSignals(True)
        self.listw.clear()
        for lp in self.project.lightplans:
            self.listw.addItem(QListWidgetItem(lp.get("name") or "Lighting Setup"))
        self.listw.blockSignals(False)
        if self.project.lightplans:
            self.listw.setCurrentRow(0)
        else:
            self._show_plan(None)

    def _add_plan(self):
        lp = new_lightplan(f"Lighting Setup {len(self.project.lightplans) + 1}")
        self.project.lightplans.append(lp)
        self.reload()
        self.listw.setCurrentRow(len(self.project.lightplans) - 1)
        self.changed.emit()

    def _delete_plan(self):
        row = self.listw.currentRow()
        if 0 <= row < len(self.project.lightplans):
            self.project.lightplans.pop(row)
            self.reload()
            self.changed.emit()

    def _generate(self):
        if not self.project.storyboard:
            QMessageBox.information(
                self, "No storyboard",
                "Add storyboard frames first — Generate from Storyboard creates "
                "one lighting plan per frame, seeded from its Lighting Setup.")
            return
        added = self.project.merge_lightplans_from_storyboard()
        if added:
            self.reload()
            self.listw.setCurrentRow(len(self.project.lightplans) - 1)
            self.changed.emit()
        else:
            QMessageBox.information(self, "Up to date",
                                    "Every storyboard frame already has a plan.")

    def _select_plan(self, row):
        if 0 <= row < len(self.project.lightplans):
            self._show_plan(self.project.lightplans[row])
        else:
            self._show_plan(None)

    # ---------- bind a plan ----------
    def _show_plan(self, lp):
        self._current = lp
        self._fx_idx = -1
        self._loading = True
        enabled = lp is not None
        self.scroll.setEnabled(enabled)
        self.canvas.setEnabled(enabled)
        if lp is None:
            self.plan_title.setText("Lighting Plan")
            for w in self.meta_widgets.values():
                self._set_widget(w, "")
            self.canvas.set_plan(None)
            self._render_ref(None)
            self._show_fixture(-1)
            self._update_legend()
            self._loading = False
            return
        self.plan_title.setText(lp.get("name") or "Lighting Plan")
        for f, w in self.meta_widgets.items():
            self._set_widget(w, lp.get(f, ""))
        self.canvas.set_plan(lp)
        self._render_ref(lp.get("reference_image", ""))
        self._show_fixture(-1)
        self._update_legend()
        self._loading = False

    @staticmethod
    def _set_widget(w, val):
        w.blockSignals(True)
        if isinstance(w, QComboBox):
            if val and w.findText(val) < 0:
                w.addItem(val)
            w.setCurrentText(val)
        elif isinstance(w, QPlainTextEdit):
            w.setPlainText(val)
        else:
            w.setText(val)
        w.blockSignals(False)

    def _commit_meta(self, key, value):
        if self._loading or self._current is None:
            return
        self._current[key] = value
        if key == "name":
            row = self.listw.currentRow()
            if 0 <= row < self.listw.count():
                self.listw.item(row).setText(value or "Lighting Setup")
            self.plan_title.setText(value or "Lighting Plan")
        self.changed.emit()

    # ---------- fixtures ----------
    def _fixtures(self):
        return self._current.get("fixtures", []) if self._current else []

    def _add_fixture(self, ftype):
        if self._current is None:
            return
        # place near a sensible default for the type
        defaults = {"key": (0.28, 0.32), "fill": (0.72, 0.40),
                    "back": (0.58, 0.16), "diffusion": (0.30, 0.22),
                    "practical": (0.82, 0.30), "flag": (0.74, 0.44),
                    "ambient": (0.86, 0.68)}
        x, y = defaults.get(ftype, (0.5, 0.3))
        self._current.setdefault("fixtures", []).append(new_fixture(ftype, x, y))
        self.canvas.set_plan(self._current)
        self._show_fixture(len(self._fixtures()) - 1)
        self._update_legend()
        self.changed.emit()

    def _delete_fixture(self):
        if self._current is None or not (0 <= self._fx_idx < len(self._fixtures())):
            return
        self._fixtures().pop(self._fx_idx)
        self.canvas.set_plan(self._current)
        self._show_fixture(-1)
        self._update_legend()
        self.changed.emit()

    def _on_canvas_select(self, idx):
        self._show_fixture(idx)

    def _on_canvas_changed(self):
        # positions moved on the canvas — persist + refresh legend labels
        self.changed.emit()

    def _show_fixture(self, idx):
        self._fx_idx = idx
        fixtures = self._fixtures()
        has = 0 <= idx < len(fixtures)
        self.fx_form.setVisible(has)
        self.fx_hint.setVisible(not has)
        self.canvas.select_fixture(idx if has else -1)
        if not has:
            return
        fx = fixtures[idx]
        self._loading = True
        for key, w in self.fx_widgets.items():
            if key == "type":
                i = w.findData(fx.get("type", "key"))
                w.blockSignals(True); w.setCurrentIndex(max(0, i)); w.blockSignals(False)
            else:
                self._set_widget(w, fx.get(key, ""))
        self._loading = False

    def _commit_fixture(self, key, value):
        if self._loading or not (0 <= self._fx_idx < len(self._fixtures())):
            return
        fx = self._fixtures()[self._fx_idx]
        fx[key] = value
        if key == "type":
            # keep a human label in sync and recolour the node
            fx["label"] = FIXTURE_TYPES.get(value, {}).get("label", value)
            self.canvas.set_plan(self._current)
            self.canvas.select_fixture(self._fx_idx)
        self._update_legend()
        self.changed.emit()

    # ---------- legend ----------
    def _update_legend(self):
        fixtures = self._fixtures()
        if not fixtures:
            self.legend.setText("<i>No fixtures yet. Use ADD above.</i>")
            return
        rows = []
        for i, fx in enumerate(fixtures):
            meta = FIXTURE_TYPES.get(fx.get("type", "key"), {})
            color = meta.get("color", "#888888")
            title = fx.get("label") or meta.get("label", "Light")
            bits = [b for b in (fx.get("unit"), fx.get("modifier"),
                                fx.get("intensity"), fx.get("gel")) if b and b != "None"]
            detail = " · ".join(bits)
            note = fx.get("notes", "").strip()
            line = (f"<div style='margin:3px 0;'>"
                    f"<span style='color:{color};font-weight:700;'>&#9679; {i+1}. "
                    f"{title}</span>")
            if detail:
                line += f"<br/><span style='color:#9a9ca6;'>{detail}</span>"
            if note:
                line += f"<br/><span style='color:#9a9ca6;'>{note}</span>"
            line += "</div>"
            rows.append(line)
        self.legend.setText("".join(rows))

    # ---------- reference image ----------
    def _set_ref_image(self):
        if self._current is None:
            return
        path, _ = QFileDialog.getOpenFileName(
            self, "Choose reference frame", "",
            "Images (*.png *.jpg *.jpeg *.webp *.gif);;All files (*)")
        if not path:
            return
        self._current["reference_image"] = path
        self._render_ref(path)
        self.changed.emit()

    def _clear_ref_image(self):
        if self._current is None:
            return
        self._current["reference_image"] = ""
        self._render_ref(None)
        self.changed.emit()

    def _render_ref(self, path):
        if path and os.path.exists(path):
            pix = QPixmap(path)
            if not pix.isNull():
                self.ref_image.setPixmap(pix.scaled(
                    288, 162, Qt.AspectRatioMode.KeepAspectRatio,
                    Qt.TransformationMode.SmoothTransformation))
                return
        self.ref_image.setText("No reference")
        self.ref_image.setPixmap(QPixmap())

    # ---------- Phase 2 hook: draft a plan from the reference frame ----------
    def _draft_from_frame(self):
        if self._current is None:
            return
        path = self._current.get("reference_image", "")
        if not path or not os.path.exists(path):
            QMessageBox.information(
                self, "Set a reference frame",
                "Add a reference frame first, then Draft from Frame will analyse "
                "it and propose a fixture layout.")
            return
        from . import lighting_ai
        try:
            fixtures, notes = lighting_ai.draft_from_image(path)
        except lighting_ai.NotConfigured as e:
            QMessageBox.information(self, "AI drafting not configured", str(e))
            return
        except Exception as e:
            QMessageBox.warning(self, "Draft failed", str(e))
            return
        if not fixtures:
            QMessageBox.information(self, "No suggestion",
                                    "The analysis didn't return a usable layout.")
            return
        self._current["fixtures"] = fixtures
        if notes and not self._current.get("set_notes"):
            self._current["set_notes"] = notes
            self._set_widget(self.set_notes, notes)
        self.canvas.set_plan(self._current)
        self._show_fixture(-1)
        self._update_legend()
        self.changed.emit()

    # ---------- export helpers ----------
    def current_plan(self):
        return self._current

    def render_diagram_png(self, path, scale=2):
        """Render the current plan's diagram to a print-friendly PNG (always on
        the light palette, no selection highlight). Returns True on success."""
        if self._current is None:
            return False
        from PyQt6.QtGui import QImage
        was_dark = self.canvas._dark
        self.canvas.select_fixture(-1)
        if was_dark:
            self.canvas.set_dark(False)
        scene = self.canvas.scene()
        rect = scene.sceneRect()
        img = QImage(int(rect.width() * scale), int(rect.height() * scale),
                     QImage.Format.Format_RGB32)
        img.fill(Qt.GlobalColor.white)
        p = QPainter(img)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        scene.render(p, QRectF(0, 0, img.width(), img.height()), rect)
        p.end()
        ok = img.save(path)
        if was_dark:
            self.canvas.set_dark(True)
            self.canvas.select_fixture(self._fx_idx)
        return ok

    def _set_view(self, mode):
        self.plan_btn.setChecked(mode == "plan")
        self.room_btn.setChecked(mode == "room")
        self.canvas.set_mode(mode)
        # keep the current fixture highlighted after the rebuild
        self.canvas.select_fixture(self._fx_idx)

    # ---------- theme / rebind ----------
    def set_dark(self, dark):
        self.canvas.set_dark(dark)

    def rebind(self, project):
        self.project = project
        self.reload()
