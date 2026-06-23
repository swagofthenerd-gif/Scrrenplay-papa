"""
Call Sheets tab. Left: list of call sheets (one per shoot day). Right: an
editable form with the exact fields StudioBinder uses on a film call sheet
(date, general call, location, nearest hospital, weather, sunrise/sunset,
notes, bulletins) plus an embedded day schedule and crew call grid.
Exports a clean plain-text call sheet ready to print or paste into an email.
"""

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QListWidget, QListWidgetItem,
    QLineEdit, QPlainTextEdit, QLabel, QToolButton, QFrame, QFormLayout,
    QScrollArea, QFileDialog, QSplitter)
from PyQt6.QtCore import Qt, pyqtSignal

from .datagrid import DataGrid
from .project import Project, CallSheet


CS_SCHEDULE_COLS = ["Scene", "INT/EXT", "Set / Location", "D/N", "Cast", "Pages"]
CS_CREW_COLS = ["Name", "Role", "Department", "Call Time", "Phone"]


class CallSheetsTab(QWidget):
    changed = pyqtSignal()

    def __init__(self, project: Project, parent=None):
        super().__init__(parent)
        self.project = project
        self._current = None
        self._loading = False

        root = QHBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # --- left: list of sheets ---
        left = QFrame()
        left.setObjectName("csList")
        left.setFixedWidth(220)
        ll = QVBoxLayout(left)
        ll.setContentsMargins(12, 14, 12, 12)
        ll.setSpacing(8)
        cap = QLabel("CALL SHEETS")
        cap.setObjectName("caption")
        ll.addWidget(cap)
        self.listw = QListWidget()
        self.listw.setObjectName("nav")
        self.listw.setFrameShape(QFrame.Shape.NoFrame)
        self.listw.currentRowChanged.connect(self._select)
        ll.addWidget(self.listw, 1)
        row = QHBoxLayout()
        addb = QToolButton(); addb.setObjectName("gridBtn"); addb.setText("+ New")
        addb.clicked.connect(self._add)
        delb = QToolButton(); delb.setObjectName("gridBtn"); delb.setText("Delete")
        delb.clicked.connect(self._delete)
        row.addWidget(addb); row.addWidget(delb)
        ll.addLayout(row)
        root.addWidget(left)

        # --- right: form ---
        self.scroll = QScrollArea()
        self.scroll.setObjectName("csScroll")
        self.scroll.setWidgetResizable(True)
        self.scroll.setFrameShape(QFrame.Shape.NoFrame)
        self.form_host = QWidget()
        self.scroll.setWidget(self.form_host)
        fh = QVBoxLayout(self.form_host)
        fh.setContentsMargins(24, 20, 24, 28)
        fh.setSpacing(16)

        head = QHBoxLayout()
        title = QLabel("Call Sheet")
        title.setObjectName("tabHeading")
        head.addWidget(title)
        head.addStretch(1)
        exp = QToolButton(); exp.setObjectName("gridBtn")
        exp.setText("Export Call Sheet (.txt)")
        exp.clicked.connect(self._export)
        head.addWidget(exp)
        fh.addLayout(head)

        # core fields
        self.f = {}
        grid = QFormLayout()
        grid.setHorizontalSpacing(18)
        grid.setVerticalSpacing(10)
        def add_field(key, label, multiline=False):
            if multiline:
                w = QPlainTextEdit(); w.setFixedHeight(60)
                w.textChanged.connect(self._commit)
            else:
                w = QLineEdit(); w.textChanged.connect(self._commit)
            w.setObjectName("csField")
            self.f[key] = w
            grid.addRow(label, w)

        # two-column field block
        cols = QHBoxLayout()
        leftform = QFormLayout(); rightform = QFormLayout()
        leftform.setHorizontalSpacing(14); rightform.setHorizontalSpacing(14)
        leftform.setVerticalSpacing(10); rightform.setVerticalSpacing(10)

        def field(target, key, label):
            w = QLineEdit(); w.setObjectName("csField")
            w.textChanged.connect(self._commit)
            self.f[key] = w
            target.addRow(label, w)

        field(leftform, "title", "Title")
        field(leftform, "date", "Date")
        field(leftform, "general_call", "General Call")
        field(leftform, "shoot_day", "Shoot Day")
        field(leftform, "location", "Location Name")
        field(rightform, "address", "Address")
        field(rightform, "nearest_hospital", "Nearest Hospital")
        field(rightform, "weather", "Weather")
        field(rightform, "sunrise", "Sunrise")
        field(rightform, "sunset", "Sunset")

        lwrap = QFrame(); lwrap.setLayout(leftform)
        rwrap = QFrame(); rwrap.setLayout(rightform)
        cols.addWidget(lwrap, 1); cols.addWidget(rwrap, 1)
        fh.addLayout(cols)

        # notes + bulletins
        fh.addWidget(self._section_label("Notes"))
        self.f["notes"] = QPlainTextEdit(); self.f["notes"].setObjectName("csField")
        self.f["notes"].setFixedHeight(56)
        self.f["notes"].textChanged.connect(self._commit)
        fh.addWidget(self.f["notes"])

        fh.addWidget(self._section_label("Bulletins / Safety"))
        self.f["bulletins"] = QPlainTextEdit(); self.f["bulletins"].setObjectName("csField")
        self.f["bulletins"].setFixedHeight(56)
        self.f["bulletins"].textChanged.connect(self._commit)
        fh.addWidget(self.f["bulletins"])

        # embedded schedule
        fh.addWidget(self._section_label("Day Schedule"))
        self.sched_grid = DataGrid(CS_SCHEDULE_COLS, [],
                                   dropdowns={"INT/EXT": ["INT", "EXT", "INT/EXT"],
                                              "D/N": ["D", "N"]})
        self.sched_grid.setMinimumHeight(180)
        self.sched_grid.changed.connect(self.changed.emit)
        fh.addWidget(self.sched_grid)

        # embedded crew call
        fh.addWidget(self._section_label("Crew Call"))
        from .project import DEPARTMENTS
        self.crew_grid = DataGrid(
            CS_CREW_COLS, [],
            dropdowns={"Name": self.project.contact_names,
                       "Department": DEPARTMENTS})
        self.crew_grid.setMinimumHeight(180)
        self.crew_grid.changed.connect(self._crew_autofill)
        import_btn = self.crew_grid.layout().itemAt(0).layout()
        ib = QToolButton(); ib.setObjectName("gridBtn")
        ib.setText("⟳ Pull from Contacts")
        ib.clicked.connect(self._pull_contacts)
        import_btn.insertWidget(import_btn.count() - 4, ib)
        fh.addWidget(self.crew_grid)

        root.addWidget(self.scroll, 1)

        self.reload()

    def _pull_contacts(self):
        if self._current is None:
            return
        existing = {c.get("Name", "") for c in self._current.crew}
        added = 0
        for ct in self.project.contacts:
            nm = ct.get("Name", "").strip()
            if nm and nm not in existing:
                self._current.crew.append({
                    "Name": nm, "Role": ct.get("Role", ""),
                    "Department": ct.get("Department", ""),
                    "Call Time": ct.get("Call Time", ""),
                    "Phone": ct.get("Phone", "")})
                existing.add(nm)
                added += 1
        if added:
            self.crew_grid.reload()
            self.changed.emit()

    def _crew_autofill(self):
        # when a crew Name matches a contact, fill blank Role/Dept/Phone
        by_name = {c.get("Name", ""): c for c in self.project.contacts}
        changed = False
        for row in self.crew_grid.rows:
            nm = row.get("Name", "")
            ct = by_name.get(nm)
            if ct:
                for src, dst in (("Role", "Role"), ("Department", "Department"),
                                 ("Phone", "Phone")):
                    if not row.get(dst) and ct.get(src):
                        row[dst] = ct[src]
                        changed = True
        if changed:
            self.crew_grid.reload()
        self.changed.emit()

    def _section_label(self, text):
        l = QLabel(text)
        l.setObjectName("csSection")
        return l

    # ---------- list management ----------
    def reload(self):
        self.listw.clear()
        for cs in self.project.call_sheets:
            self.listw.addItem(QListWidgetItem(cs.title or "(untitled)"))
        if self.project.call_sheets:
            self.listw.setCurrentRow(0)
        else:
            self._show(None)

    def _add(self):
        cs = CallSheet(title=f"Shoot Day {len(self.project.call_sheets)+1}")
        self.project.call_sheets.append(cs)
        self.reload()
        self.listw.setCurrentRow(len(self.project.call_sheets) - 1)
        self.changed.emit()

    def _delete(self):
        row = self.listw.currentRow()
        if 0 <= row < len(self.project.call_sheets):
            self.project.call_sheets.pop(row)
            self.reload()
            self.changed.emit()

    def _select(self, row):
        if 0 <= row < len(self.project.call_sheets):
            self._show(self.project.call_sheets[row])
        else:
            self._show(None)

    # ---------- form binding ----------
    def _show(self, cs):
        self._current = cs
        self._loading = True
        enabled = cs is not None
        self.form_host.setEnabled(enabled)
        if cs is None:
            for w in self.f.values():
                w.blockSignals(True)
                (w.clear() if hasattr(w, "clear") else None)
                w.blockSignals(False)
            self.sched_grid.rows = []; self.sched_grid.reload()
            self.crew_grid.rows = []; self.crew_grid.reload()
            self._loading = False
            return
        for key, w in self.f.items():
            val = getattr(cs, key, "")
            w.blockSignals(True)
            if isinstance(w, QPlainTextEdit):
                w.setPlainText(val)
            else:
                w.setText(val)
            w.blockSignals(False)
        self.sched_grid.rows = cs.schedule
        self.sched_grid.reload()
        self.crew_grid.rows = cs.crew
        self.crew_grid.reload()
        self._loading = False

    def _commit(self):
        if self._loading or self._current is None:
            return
        cs = self._current
        for key, w in self.f.items():
            if isinstance(w, QPlainTextEdit):
                setattr(cs, key, w.toPlainText())
            else:
                setattr(cs, key, w.text())
        # refresh list label if title changed
        row = self.listw.currentRow()
        if 0 <= row < self.listw.count():
            self.listw.item(row).setText(cs.title or "(untitled)")
        self.changed.emit()

    def rebind(self, project):
        self.project = project
        self.reload()

    # ---------- export ----------
    def _export(self):
        cs = self._current
        if cs is None:
            return
        path, _ = QFileDialog.getSaveFileName(
            self, "Export Call Sheet",
            (cs.title or "call_sheet") + ".txt", "Text (*.txt)")
        if not path:
            return
        if not path.endswith(".txt"):
            path += ".txt"
        with open(path, "w", encoding="utf-8") as fp:
            fp.write(self._render_text(cs))

    def _render_text(self, cs: CallSheet) -> str:
        L = []
        bar = "=" * 64
        L.append(bar)
        L.append(f"  {self.project.title.upper()}")
        L.append(f"  CALL SHEET — {cs.title}")
        L.append(bar)
        L.append(f"Date: {cs.date:<24}Shoot Day: {cs.shoot_day}")
        L.append(f"General Call: {cs.general_call}")
        L.append("")
        L.append(f"Location: {cs.location}")
        L.append(f"Address:  {cs.address}")
        L.append(f"Nearest Hospital: {cs.nearest_hospital}")
        L.append(f"Weather: {cs.weather}    Sunrise: {cs.sunrise}    Sunset: {cs.sunset}")
        if cs.notes.strip():
            L.append("")
            L.append("NOTES:")
            L.append(cs.notes.strip())
        if cs.bulletins.strip():
            L.append("")
            L.append("BULLETINS / SAFETY:")
            L.append(cs.bulletins.strip())
        if cs.schedule:
            L.append("")
            L.append("-" * 64)
            L.append("SCHEDULE")
            L.append("-" * 64)
            for s in cs.schedule:
                L.append(f"  Sc {s.get('Scene',''):<5} {s.get('INT/EXT',''):<8} "
                         f"{s.get('Set / Location',''):<24} {s.get('D/N',''):<3} "
                         f"Cast: {s.get('Cast','')}  Pgs: {s.get('Pages','')}")
        if cs.crew:
            L.append("")
            L.append("-" * 64)
            L.append("CREW CALL")
            L.append("-" * 64)
            for c in cs.crew:
                L.append(f"  {c.get('Call Time',''):<8} {c.get('Name',''):<20} "
                         f"{c.get('Role',''):<18} {c.get('Department','')}")
        L.append("")
        L.append(bar)
        return "\n".join(L) + "\n"
