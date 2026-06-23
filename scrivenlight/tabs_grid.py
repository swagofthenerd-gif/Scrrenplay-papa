"""
Production tab widgets built on DataGrid. Each binds to a list on the Project
and exposes a 'changed' signal so the main window can mark the doc dirty.
"""

from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QToolButton,
                             QLabel, QFrame)
from PyQt6.QtCore import Qt, pyqtSignal

from .datagrid import DataGrid
from .project import (
    Project, SHOT_COLUMNS, SHOT_SIZES, CAMERA_ANGLES, MOVEMENTS,
    SCHEDULE_COLUMNS, CONTACT_COLUMNS, DEPARTMENTS,
    BUDGET_COLUMNS, BUDGET_CATEGORIES)


class ShotListTab(QWidget):
    changed = pyqtSignal()

    def __init__(self, project: Project, parent=None):
        super().__init__(parent)
        self.project = project
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self.grid = DataGrid(
            SHOT_COLUMNS, project.shots,
            dropdowns={
                "Shot Size": SHOT_SIZES,
                "Camera Angle": CAMERA_ANGLES,
                "Movement": MOVEMENTS,
            },
            checkbox_cols={"Done"},
            title="Shot List",
        )
        self.grid.changed.connect(self.changed.emit)

        # extra button: generate from script
        gen = QToolButton()
        gen.setObjectName("gridBtn")
        gen.setText("⟳ Generate from Script")
        gen.clicked.connect(self._generate)
        # insert into the grid's toolbar (it's the first hbox)
        toolbar = self.grid.layout().itemAt(0).layout()
        toolbar.insertWidget(toolbar.count() - 4, gen)

        layout.addWidget(self.grid)

    def _generate(self):
        added = self.project.merge_shots_from_script()
        if added:
            self.grid.reload()
            self.changed.emit()
        self._announce(added, "shot")

    def _announce(self, added, noun):
        try:
            from PyQt6.QtWidgets import QToolTip
            from PyQt6.QtGui import QCursor
            msg = (f"Added {added} {noun} row" + ("s" if added != 1 else "")
                   if added else "All scenes already in the list")
            QToolTip.showText(QCursor.pos(), msg)
        except Exception:
            pass

    def rebind(self, project):
        self.project = project
        self.grid.rows = project.shots
        self.grid.reload()


class ScheduleTab(QWidget):
    changed = pyqtSignal()

    def __init__(self, project: Project, parent=None):
        super().__init__(parent)
        self.project = project
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self.grid = DataGrid(
            SCHEDULE_COLUMNS, project.schedule,
            dropdowns={"INT/EXT": ["INT", "EXT", "INT/EXT"],
                       "D/N": ["D", "N", "Dawn", "Dusk"],
                       "Cast": project.cast_names},
            title="Shooting Schedule (Stripboard)",
        )
        self.grid.changed.connect(self.changed.emit)

        gen = QToolButton()
        gen.setObjectName("gridBtn")
        gen.setText("⟳ Generate from Script")
        gen.clicked.connect(self._generate)
        toolbar = self.grid.layout().itemAt(0).layout()
        toolbar.insertWidget(toolbar.count() - 4, gen)

        layout.addWidget(self.grid)

    def _generate(self):
        added = self.project.merge_schedule_from_script()
        if added:
            self.grid.reload()
            self.changed.emit()

    def rebind(self, project):
        self.project = project
        self.grid.rows = project.schedule
        self.grid.reload()


class ContactsTab(QWidget):
    changed = pyqtSignal()

    def __init__(self, project: Project, parent=None):
        super().__init__(parent)
        self.project = project
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        self.grid = DataGrid(
            CONTACT_COLUMNS, project.contacts,
            dropdowns={"Department": DEPARTMENTS},
            title="Cast & Crew Contacts",
        )
        self.grid.changed.connect(self.changed.emit)
        layout.addWidget(self.grid)

    def rebind(self, project):
        self.project = project
        self.grid.rows = project.contacts
        self.grid.reload()


class BudgetTab(QWidget):
    changed = pyqtSignal()

    def __init__(self, project: Project, parent=None):
        super().__init__(parent)
        self.project = project
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self.grid = DataGrid(
            BUDGET_COLUMNS, project.budget,
            dropdowns={"Category": BUDGET_CATEGORIES},
            numeric_cols={"Qty", "Rate", "Subtotal"},
            title="Production Budget",
        )
        self.grid.changed.connect(self._on_change)

        # total bar
        total_bar = QFrame()
        total_bar.setObjectName("totalBar")
        tb = QHBoxLayout(total_bar)
        tb.setContentsMargins(20, 8, 24, 8)
        tb.addStretch(1)
        tb.addWidget(QLabel("TOTAL:"))
        self.total_lbl = QLabel("$0.00")
        self.total_lbl.setObjectName("totalValue")
        tb.addWidget(self.total_lbl)

        layout.addWidget(self.grid)
        layout.addWidget(total_bar)
        self._update_total()

    def _on_change(self):
        self._update_total()
        self.changed.emit()

    def _update_total(self):
        total = self.grid.total_of("Subtotal")
        self.total_lbl.setText(f"${total:,.2f}")

    def rebind(self, project):
        self.project = project
        self.grid.rows = project.budget
        self.grid.reload()
        self._update_total()
