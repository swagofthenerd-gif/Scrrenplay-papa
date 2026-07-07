"""Properties panel: edits whatever is selected in the PlotScene.

Every commit goes through EditFieldCommand so it is undoable. Widgets are
rebuilt per selection kind; self.fields maps model field name -> widget.
"""
from __future__ import annotations

from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import (QCheckBox, QComboBox, QDoubleSpinBox, QFormLayout,
                             QLabel, QLineEdit, QPushButton, QSpinBox,
                             QVBoxLayout, QWidget, QHBoxLayout, QPlainTextEdit)

from .commands import EditFieldCommand, find_obj
from .rig import ROLES

CT_PRESETS = [("Tungsten 3200K", 3200), ("Daylight 5600K", 5600),
              ("Warm practical 2400K", 2400), ("Cool window 6500K", 6500)]

MODIFIERS = ["", "softbox", "book light", "bounce board", "fresnel",
             "LED panel", "practical lamp in frame", "tube", "beauty dish",
             "8x8 diffusion", "lantern / china ball"]


class PropertiesPanel(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.scene = None
        self.current_kind = "plot"
        self.current_id = ""
        self.fields = {}
        self._loading = False
        self._layout = QVBoxLayout(self)
        self._layout.setContentsMargins(8, 8, 8, 8)
        self._form_host = QWidget()
        self._layout.addWidget(self._form_host)
        self._layout.addStretch(1)

    def set_scene(self, scene):
        self.scene = scene
        scene.selectionTarget.connect(self.show_target)
        self.show_target("plot", "")

    # ------------------------------------------------------------ forms
    def show_target(self, kind: str, obj_id: str):
        self.current_kind, self.current_id = kind, obj_id
        self.fields = {}
        self._form_host.deleteLater()
        self._form_host = QWidget()
        form = QFormLayout(self._form_host)
        self._layout.insertWidget(0, self._form_host)
        obj = self._target()
        if obj is None:
            return
        self._loading = True
        builder = {"light": self._light_form, "subject": self._subject_form,
                   "camera": self._camera_form, "set": self._set_form,
                   "move": self._move_form, "plot": self._plot_form}[kind]
        builder(form, obj)
        self._loading = False

    def _target(self):
        if self.scene is None:
            return None
        if self.current_kind == "plot":
            return self.scene.plot
        return find_obj(self.scene.plot, self.current_kind, self.current_id)

    # each _*_form registers widgets in self.fields and wires commit
    def _light_form(self, form, light):
        role = QComboBox(); role.addItems(list(ROLES))
        role.setCurrentText(light.role)
        self._reg(form, "Role", "role", role,
                  role.currentTextChanged, role.currentText)
        inten = self._spin(0.0, 2.0, 0.05, light.intensity)
        self._reg(form, "Intensity", "intensity", inten,
                  inten.valueChanged, inten.value)
        soft = self._spin(0.0, 1.0, 0.05, light.softness)
        self._reg(form, "Softness", "softness", soft,
                  soft.valueChanged, soft.value)
        elev = self._spin(-90.0, 90.0, 1.0, light.elevation_deg)
        self._reg(form, "Elevation °", "elevation_deg", elev,
                  elev.valueChanged, elev.value)
        ct = QSpinBox(); ct.setRange(1500, 12000); ct.setSingleStep(100)
        ct.setValue(light.color_temp_k)
        self._reg(form, "Color temp K", "color_temp_k", ct,
                  ct.valueChanged, ct.value)
        presets = QHBoxLayout()
        for label, k in CT_PRESETS:
            b = QPushButton(label.split()[0]); b.setToolTip(label)
            b.clicked.connect(lambda _, kk=k: (ct.setValue(kk),
                                               self.commit_field("color_temp_k")))
            presets.addWidget(b)
        host = QWidget(); host.setLayout(presets)
        form.addRow("", host)
        gel = QLineEdit(light.color_hex)
        self._reg(form, "Gel hex", "color_hex", gel,
                  gel.editingFinished, gel.text)
        mod = QComboBox(); mod.setEditable(True); mod.addItems(MODIFIERS)
        mod.setCurrentText(light.modifier)
        self._reg(form, "Modifier", "modifier", mod,
                  mod.currentTextChanged, mod.currentText)
        notes = QLineEdit(light.notes)
        self._reg(form, "Notes", "notes", notes,
                  notes.editingFinished, notes.text)

    def _subject_form(self, form, s):
        name = QLineEdit(s.name)
        self._reg(form, "Name", "name", name, name.editingFinished, name.text)
        facing = self._spin(-180.0, 180.0, 5.0, s.facing_deg)
        self._reg(form, "Facing °", "facing_deg", facing,
                  facing.valueChanged, facing.value)
        primary = QCheckBox("Primary (breakdown reference)")
        primary.setChecked(s.primary)
        primary.toggled.connect(lambda v: self._set_primary(v))
        form.addRow("", primary)
        self.fields["primary"] = primary

    def _camera_form(self, form, c):
        label = QLineEdit(c.label)
        self._reg(form, "Label", "label", label,
                  label.editingFinished, label.text)
        aim = self._spin(-180.0, 180.0, 5.0, c.aim_deg)
        self._reg(form, "Aim °", "aim_deg", aim, aim.valueChanged, aim.value)

    def _set_form(self, form, e):
        form.addRow(QLabel(f"Set element: {e.kind}"))
        label = QLineEdit(e.label)
        self._reg(form, "Label", "label", label,
                  label.editingFinished, label.text)

    def _move_form(self, form, m):
        label = QLineEdit(m.label)
        self._reg(form, "Label", "label", label,
                  label.editingFinished, label.text)

    def _plot_form(self, form, plot):
        name = QLineEdit(plot.name)
        self._reg(form, "Setup name", "name", name,
                  name.editingFinished, name.text)
        mood = QLineEdit(plot.mood)
        self._reg(form, "Mood", "mood", mood, mood.editingFinished, mood.text)
        notes = QLineEdit(plot.notes)
        self._reg(form, "Notes", "notes", notes,
                  notes.editingFinished, notes.text)

    # ------------------------------------------------------------ plumbing
    def _spin(self, lo, hi, step, val):
        w = QDoubleSpinBox()
        w.setRange(lo, hi); w.setSingleStep(step); w.setValue(val)
        return w

    def _reg(self, form, label, field, widget, signal, getter):
        self.fields[field] = widget
        widget._getter = getter
        form.addRow(label, widget)
        signal.connect(lambda *_: self.commit_field(field))

    def commit_field(self, field: str):
        if self._loading:
            return
        obj = self._target()
        if obj is None:
            return
        new = self.fields[field]._getter()
        old = getattr(obj, field)
        if type(old) is int:
            new = int(new)
        if new == old:
            return
        self.scene.undo_stack.push(EditFieldCommand(
            self.scene, self.current_kind, self.current_id, field, old, new))

    def _set_primary(self, value: bool):
        if self._loading or not value:
            return
        # exactly one primary: clear others directly, set this one undoably
        for s in self.scene.plot.subjects:
            s.primary = False
        self.scene.undo_stack.push(EditFieldCommand(
            self.scene, "subject", self.current_id, "primary", False, True))
