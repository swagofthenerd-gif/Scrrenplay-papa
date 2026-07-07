"""
Storyboard tab — the detailed pre-production board.

Left: a scrollable list of frames (thumbnails + scene/shot label).
Right: an editor for the selected frame with EVERY pre-production aspect,
grouped into collapsible-feeling sections:
  Frame        — image, scene, shot, setup, size, angle, movement, subject, desc
  Camera       — body, support
  Lens         — lens series, focal length, aperture, filter
  Exposure     — frame rate, shutter, ISO, white balance, resolution/codec
  Lighting     — setup, key, fill, background
  Production    — sound, VFX, props, wardrobe/makeup, location, takes, time, notes

Frames bind to project.storyboard (list of dicts). Images are stored as file
paths so the .slt stays small and portable.
"""

from PyQt6.QtWidgets import (
    QWidget, QHBoxLayout, QVBoxLayout, QListWidget, QListWidgetItem,
    QLineEdit, QPlainTextEdit, QComboBox, QLabel, QToolButton, QFrame,
    QScrollArea, QFileDialog, QGridLayout)
from PyQt6.QtGui import QPixmap
from PyQt6.QtCore import Qt, pyqtSignal

from .project import (Project, STORYBOARD_FIELDS, STORYBOARD_DROPDOWNS,
                      new_storyboard_frame)


# field -> (label, kind)  kind: 'line' | 'text' | dropdown via STORYBOARD_DROPDOWNS
FIELD_LABELS = {
    "scene": "Scene", "shot": "Shot #", "setup": "Setup #",
    "shot_size": "Shot Size", "camera_angle": "Camera Angle",
    "movement": "Movement", "subject": "Subject", "description": "Description",
    "camera_body": "Camera Body", "support": "Support / Rig",
    "lens": "Lens Series", "focal_length": "Focal Length",
    "aperture": "Aperture (T-stop)", "filter": "Filter",
    "frame_rate": "Frame Rate (fps)", "shutter": "Shutter",
    "iso": "ISO / EI", "white_balance": "White Balance (K)",
    "resolution_codec": "Resolution / Codec",
    "lighting_setup": "Lighting Setup", "key_light": "Key Light",
    "fill_light": "Fill Light", "background_light": "Background Light",
    "sound": "Sound", "vfx": "VFX", "props": "Props",
    "wardrobe_makeup": "Wardrobe / Makeup", "location": "Location",
    "est_takes": "Est. Takes", "est_time_min": "Est. Time (min)",
    "notes": "Notes",
}

SECTIONS = [
    ("Frame", ["scene", "shot", "setup", "shot_size", "camera_angle",
               "movement", "subject", "description"]),
    ("Camera", ["camera_body", "support"]),
    ("Lens", ["lens", "focal_length", "aperture", "filter"]),
    ("Exposure", ["frame_rate", "shutter", "iso", "white_balance",
                  "resolution_codec"]),
    ("Lighting", ["lighting_setup", "key_light", "fill_light",
                  "background_light"]),
    ("Production", ["sound", "vfx", "props", "wardrobe_makeup", "location",
                    "est_takes", "est_time_min", "notes"]),
]


class StoryboardTab(QWidget):
    changed = pyqtSignal()

    def __init__(self, project: Project, parent=None):
        super().__init__(parent)
        self.project = project
        self._current = None
        self._loading = False
        self.widgets = {}

        root = QHBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # ---- left: frame list ----
        left = QFrame()
        left.setObjectName("sbList")
        left.setFixedWidth(210)
        ll = QVBoxLayout(left)
        ll.setContentsMargins(12, 14, 10, 12)
        ll.setSpacing(8)
        cap = QLabel("STORYBOARD FRAMES")
        cap.setObjectName("caption")
        ll.addWidget(cap)
        self.listw = QListWidget()
        self.listw.setObjectName("nav")
        self.listw.setFrameShape(QFrame.Shape.NoFrame)
        self.listw.currentRowChanged.connect(self._select)
        ll.addWidget(self.listw, 1)
        rowb = QHBoxLayout()
        addb = QToolButton(); addb.setObjectName("gridBtn"); addb.setText("+ Frame")
        addb.clicked.connect(self._add)
        delb = QToolButton(); delb.setObjectName("gridBtn"); delb.setText("Delete")
        delb.clicked.connect(self._delete)
        rowb.addWidget(addb); rowb.addWidget(delb)
        ll.addLayout(rowb)
        genb = QToolButton(); genb.setObjectName("gridBtn")
        genb.setText("⟳ Generate from Script")
        genb.clicked.connect(self._generate)
        ll.addWidget(genb)
        root.addWidget(left)

        # ---- right: detailed editor ----
        self.scroll = QScrollArea()
        self.scroll.setObjectName("sbScroll")
        self.scroll.setWidgetResizable(True)
        self.scroll.setFrameShape(QFrame.Shape.NoFrame)
        host = QWidget()
        self.scroll.setWidget(host)
        self.host = host
        hv = QVBoxLayout(host)
        hv.setContentsMargins(22, 18, 22, 26)
        hv.setSpacing(14)

        # header: image + title
        top = QHBoxLayout()
        self.image_label = QLabel("No frame image")
        self.image_label.setObjectName("sbImage")
        self.image_label.setFixedSize(240, 135)
        self.image_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        top.addWidget(self.image_label)
        side = QVBoxLayout()
        self.frame_title = QLabel("Frame")
        self.frame_title.setObjectName("tabHeading")
        side.addWidget(self.frame_title)
        imgbtn = QToolButton(); imgbtn.setObjectName("gridBtn")
        imgbtn.setText("Set Frame Image…")
        imgbtn.clicked.connect(self._set_image)
        side.addWidget(imgbtn)
        clrbtn = QToolButton(); clrbtn.setObjectName("gridBtn")
        clrbtn.setText("Clear Image")
        clrbtn.clicked.connect(self._clear_image)
        side.addWidget(clrbtn)
        side.addStretch(1)
        top.addLayout(side)
        top.addStretch(1)
        hv.addLayout(top)

        # sections of fields
        for sec_name, fields in SECTIONS:
            lbl = QLabel(sec_name.upper())
            lbl.setObjectName("sbSection")
            hv.addWidget(lbl)
            grid = QGridLayout()
            grid.setHorizontalSpacing(14)
            grid.setVerticalSpacing(8)
            col = 0; rown = 0
            for f in fields:
                if f in ("description", "notes"):
                    # full-width text
                    if col != 0:
                        rown += 1; col = 0
                    cell = self._make_text(f)
                    grid.addWidget(self._field_label(f), rown, 0)
                    grid.addWidget(cell, rown, 1, 1, 3)
                    rown += 1
                    continue
                grid.addWidget(self._field_label(f), rown, col)
                grid.addWidget(self._make_input(f), rown, col + 1)
                col += 2
                if col >= 4:
                    col = 0; rown += 1
            hv.addLayout(grid)
            if sec_name == "Lighting":
                self._add_lightplot_buttons(hv)

        root.addWidget(self.scroll, 1)
        self.reload()

    # ---------- lightplot integration ----------
    def _add_lightplot_buttons(self, hv):
        from .lightplot_bridge import lightplot_available
        if not lightplot_available():
            return
        from .lightplot_bridge import export_storyboard_pdf
        row = QHBoxLayout()
        plot_btn = QToolButton(); plot_btn.setObjectName("gridBtn")
        plot_btn.setText("Open Light Plot…")
        plot_btn.clicked.connect(self._open_light_plot)
        pdf_btn = QToolButton(); pdf_btn.setObjectName("gridBtn")
        pdf_btn.setText("Export Lighting PDF…")
        pdf_btn.clicked.connect(
            lambda: export_storyboard_pdf(self, self.project))
        row.addWidget(plot_btn)
        row.addWidget(pdf_btn)
        row.addStretch(1)
        hv.addLayout(row)

    def _open_light_plot(self):
        if self._current is None:
            return
        from .lightplot_bridge import open_plot_dialog
        if open_plot_dialog(self, self._current):
            self._show(self._current)   # refresh autofilled fields
            self.changed.emit()

    # ---------- widget builders ----------
    def _field_label(self, f):
        l = QLabel(FIELD_LABELS.get(f, f))
        l.setObjectName("sbFieldLabel")
        return l

    def _make_input(self, f):
        if f in STORYBOARD_DROPDOWNS:
            w = QComboBox(); w.setEditable(True)
            w.addItem("")
            w.addItems(STORYBOARD_DROPDOWNS[f])
            w.currentTextChanged.connect(lambda t, k=f: self._commit_field(k, t))
        else:
            w = QLineEdit(); w.setObjectName("csField")
            w.textChanged.connect(lambda t, k=f: self._commit_field(k, t))
        self.widgets[f] = w
        return w

    def _make_text(self, f):
        w = QPlainTextEdit(); w.setObjectName("csField"); w.setFixedHeight(52)
        w.textChanged.connect(lambda k=f: self._commit_field(
            k, self.widgets[k].toPlainText()))
        self.widgets[f] = w
        return w

    # ---------- list ----------
    def reload(self):
        self.listw.clear()
        for fr in self.project.storyboard:
            self.listw.addItem(QListWidgetItem(self._label_for(fr)))
        if self.project.storyboard:
            self.listw.setCurrentRow(0)
        else:
            self._show(None)

    def _label_for(self, fr):
        sc = fr.get("scene", "") or "?"
        sh = fr.get("shot", "") or "?"
        subj = fr.get("subject", "") or "(frame)"
        return f"Sc {sc} / Sh {sh} — {subj}"

    def _add(self):
        from .project import autofill_frame, project_camera_default
        fr = new_storyboard_frame()
        # New coverage is assumed to belong to the scene you're currently on,
        # and the next shot number within it. This is what makes scene-level
        # inheritance meaningful.
        cur = self._current
        if cur is not None and cur.get("scene"):
            fr["scene"] = cur["scene"]
            # next shot number within this scene
            shots = [self._int(f.get("shot", "")) for f in self.project.storyboard
                     if str(f.get("scene", "")).strip() == str(cur["scene"]).strip()]
            nxt = (max([s for s in shots if s is not None], default=0) + 1)
            fr["shot"] = str(nxt)
        else:
            # no scene context: at least keep the project camera consistent
            cam = project_camera_default(self.project.storyboard)
            if cam:
                fr["camera_body"] = cam
        self.project.storyboard.append(fr)
        filled = autofill_frame(self.project.storyboard, fr,
                                fr.get("scene", ""))
        self.reload()
        self.listw.setCurrentRow(len(self.project.storyboard) - 1)
        self._flash_autofill(filled)
        self.changed.emit()

    @staticmethod
    def _int(v):
        try:
            return int(str(v).strip())
        except (ValueError, TypeError):
            return None

    def _flash_autofill(self, filled):
        if not filled:
            return
        try:
            from PyQt6.QtWidgets import QToolTip
            from PyQt6.QtGui import QCursor
            n = len(filled)
            QToolTip.showText(QCursor.pos(),
                              f"Auto-filled {n} field" + ("s" if n != 1 else "")
                              + " from this scene")
        except Exception:
            pass

    def _delete(self):
        row = self.listw.currentRow()
        if 0 <= row < len(self.project.storyboard):
            self.project.storyboard.pop(row)
            self.reload()
            self.changed.emit()

    def _generate(self):
        existing = {(f.get("scene", ""), f.get("shot", ""))
                    for f in self.project.storyboard}
        from .elements import ElementType
        scene_no = 0; added = 0
        for b in self.project.screenplay.blocks:
            if b.etype() == ElementType.SCENE_HEADING:
                scene_no += 1
                key = (str(scene_no), "1")
                if key in existing:
                    continue
                fr = new_storyboard_frame()
                fr["scene"] = str(scene_no)
                fr["shot"] = "1"
                fr["subject"] = b.text.strip()
                fr["location"] = b.text.strip()
                self.project.storyboard.append(fr)
                # carry the project camera body forward so a generated board
                # is consistent without re-typing the body on every scene
                from .project import autofill_frame
                autofill_frame(self.project.storyboard, fr, str(scene_no))
                added += 1
        if added:
            self.reload()
            self.changed.emit()

    def _select(self, row):
        if 0 <= row < len(self.project.storyboard):
            self._show(self.project.storyboard[row])
        else:
            self._show(None)

    # ---------- binding ----------
    def _show(self, fr):
        self._current = fr
        self._loading = True
        self.host.setEnabled(fr is not None)
        if fr is None:
            for w in self.widgets.values():
                w.blockSignals(True)
                if isinstance(w, QComboBox):
                    w.setCurrentText("")
                elif isinstance(w, QPlainTextEdit):
                    w.setPlainText("")
                else:
                    w.setText("")
                w.blockSignals(False)
            self._render_image(None)
            self.frame_title.setText("Frame")
            self._loading = False
            return
        for f, w in self.widgets.items():
            val = fr.get(f, "")
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
        self.frame_title.setText(self._label_for(fr))
        self._render_image(fr.get("frame_image", ""))
        self._loading = False

    def _commit_field(self, key, value):
        if self._loading or self._current is None:
            return
        self._current[key] = value
        if key in ("scene", "shot", "subject"):
            row = self.listw.currentRow()
            if 0 <= row < self.listw.count():
                self.listw.item(row).setText(self._label_for(self._current))
            self.frame_title.setText(self._label_for(self._current))
        self.changed.emit()

    # ---------- image ----------
    def _set_image(self):
        if self._current is None:
            return
        path, _ = QFileDialog.getOpenFileName(
            self, "Choose frame image", "",
            "Images (*.png *.jpg *.jpeg *.webp *.gif);;All files (*)")
        if not path:
            return
        self._current["frame_image"] = path
        self._render_image(path)
        self.changed.emit()

    def _clear_image(self):
        if self._current is None:
            return
        self._current["frame_image"] = ""
        self._render_image(None)
        self.changed.emit()

    def _render_image(self, path):
        if path:
            pix = QPixmap(path)
            if not pix.isNull():
                self.image_label.setPixmap(pix.scaled(
                    240, 135, Qt.AspectRatioMode.KeepAspectRatio,
                    Qt.TransformationMode.SmoothTransformation))
                return
        self.image_label.setText("No frame image")
        self.image_label.setPixmap(QPixmap())

    def rebind(self, project):
        self.project = project
        self.reload()
