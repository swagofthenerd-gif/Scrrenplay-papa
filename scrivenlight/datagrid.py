"""
DataGrid: a reusable spreadsheet-style table used by the Shot List, Schedule,
Contacts, and Budget tabs. Binds to a list[dict] (the model rows) and keeps it
in sync. Supports per-column dropdowns, checkbox columns, add/duplicate/delete
rows, reordering, and CSV export.
"""

import csv
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTableWidget, QTableWidgetItem,
    QToolButton, QComboBox, QHeaderView, QAbstractItemView, QFileDialog,
    QLabel, QCheckBox, QFrame)
from PyQt6.QtCore import Qt, pyqtSignal


class DataGrid(QWidget):
    changed = pyqtSignal()

    def __init__(self, columns, rows, dropdowns=None, checkbox_cols=None,
                 numeric_cols=None, title="", parent=None):
        super().__init__(parent)
        self.columns = columns
        self.rows = rows                      # the live model list (list[dict])
        self.dropdowns = dropdowns or {}      # {col_name: [options]}
        self.checkbox_cols = set(checkbox_cols or [])
        self.numeric_cols = set(numeric_cols or [])
        self._loading = False
        self._undo_stack = []
        self._redo_stack = []
        self._editing_row = None
        self._editing_before = None

        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 16, 20, 16)
        layout.setSpacing(12)

        # toolbar
        bar = QHBoxLayout()
        bar.setSpacing(8)
        if title:
            t = QLabel(title)
            t.setObjectName("tabHeading")
            bar.addWidget(t)
        bar.addStretch(1)
        self._mkbtn(bar, "+ Add Row", self.add_row)
        self._mkbtn(bar, "Duplicate", self.duplicate_row)
        self._mkbtn(bar, "Delete", self.delete_row)
        self._mkbtn(bar, "Export CSV", self.export_csv)
        layout.addLayout(bar)

        # table
        self.table = QTableWidget()
        self.table.setObjectName("dataGrid")
        self.table.setColumnCount(len(columns))
        self.table.setHorizontalHeaderLabels(columns)
        self.table.verticalHeader().setVisible(True)
        self.table.setSelectionBehavior(
            QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setAlternatingRowColors(True)
        self.table.horizontalHeader().setSectionResizeMode(
            QHeaderView.ResizeMode.Interactive)
        self.table.horizontalHeader().setStretchLastSection(True)
        self.table.itemChanged.connect(self._on_item_changed)
        layout.addWidget(self.table)

        self.reload()

    def _mkbtn(self, bar, text, slot):
        b = QToolButton()
        b.setObjectName("gridBtn")
        b.setText(text)
        b.clicked.connect(slot)
        bar.addWidget(b)
        return b

    # ---------- binding ----------
    def reload(self):
        self._loading = True
        self.table.setRowCount(0)
        for r in self.rows:
            self._append_widget_row(r)
        self._loading = False

    def _append_widget_row(self, rowdict):
        row = self.table.rowCount()
        self.table.insertRow(row)
        for col, name in enumerate(self.columns):
            val = str(rowdict.get(name, ""))
            if name in self.dropdowns:
                combo = QComboBox()
                combo.setEditable(True)
                combo.addItem("")
                opts = self.dropdowns[name]
                if callable(opts):
                    opts = opts()
                combo.addItems(list(opts))
                if val:
                    if combo.findText(val) < 0:
                        combo.addItem(val)
                    combo.setCurrentText(val)
                combo.currentTextChanged.connect(
                    lambda text, rr=row, cc=name: self._set(rr, cc, text))
                self.table.setCellWidget(row, col, combo)
            elif name in self.checkbox_cols:
                holder = QWidget()
                h = QHBoxLayout(holder)
                h.setContentsMargins(0, 0, 0, 0)
                h.setAlignment(Qt.AlignmentFlag.AlignCenter)
                cb = QCheckBox()
                cb.setChecked(val.lower() in ("1", "true", "yes", "x", "✓"))
                cb.stateChanged.connect(
                    lambda st, rr=row, cc=name:
                        self._set(rr, cc, "✓" if st else ""))
                h.addWidget(cb)
                self.table.setCellWidget(row, col, holder)
            else:
                item = QTableWidgetItem(val)
                self.table.setItem(row, col, item)

    # ---------- editing ----------
    def _on_item_changed(self, item):
        if self._loading:
            return
        row, col = item.row(), item.column()
        name = self.columns[col]
        if row < len(self.rows):
            if self.rows[row].get(name, "") != item.text():
                self._snapshot()
            self.rows[row][name] = item.text()
            if name in self.numeric_cols:
                self._recompute(row)
            self.changed.emit()

    def _set(self, row, col_name, value):
        if self._loading:
            return
        if row < len(self.rows):
            if self.rows[row].get(col_name, "") != value:
                self._snapshot()
            self.rows[row][col_name] = value
            self.changed.emit()

    def _recompute(self, row):
        """Hook for derived columns. Budget overrides via subclass-like check."""
        # Subtotal = Qty * Rate when those columns exist
        r = self.rows[row]
        if "Qty" in r and "Rate" in r and "Subtotal" in r:
            try:
                qty = float(str(r.get("Qty", "") or 0))
                rate = float(str(r.get("Rate", "") or 0).replace(",", "").replace("$", ""))
                r["Subtotal"] = f"{qty * rate:.2f}"
                self._loading = True
                col = self.columns.index("Subtotal")
                self.table.setItem(
                    row, col, QTableWidgetItem(r["Subtotal"]))
                self._loading = False
            except (ValueError, KeyError):
                pass

    # ---------- undo/redo (snapshot-based) ----------
    def _snapshot(self):
        import copy
        self._undo_stack.append(copy.deepcopy(self.rows))
        if len(self._undo_stack) > 50:
            self._undo_stack.pop(0)
        self._redo_stack.clear()

    def undo(self):
        if not self._undo_stack:
            return
        import copy
        self._redo_stack.append(copy.deepcopy(self.rows))
        snap = self._undo_stack.pop()
        self.rows[:] = snap
        self.reload()
        self.changed.emit()

    def redo(self):
        if not self._redo_stack:
            return
        import copy
        self._undo_stack.append(copy.deepcopy(self.rows))
        snap = self._redo_stack.pop()
        self.rows[:] = snap
        self.reload()
        self.changed.emit()

    # ---------- row ops ----------
    def add_row(self):
        self._snapshot()
        new = {c: "" for c in self.columns}
        self.rows.append(new)
        self._loading = True
        self._append_widget_row(new)
        self._loading = False
        self.changed.emit()

    def duplicate_row(self):
        row = self.table.currentRow()
        if row < 0 or row >= len(self.rows):
            return
        self._snapshot()
        clone = dict(self.rows[row])
        self.rows.insert(row + 1, clone)
        self.reload()
        self.changed.emit()

    def delete_row(self):
        row = self.table.currentRow()
        if row < 0 or row >= len(self.rows):
            return
        self._snapshot()
        self.rows.pop(row)
        self.reload()
        self.changed.emit()

    def export_csv(self):
        path, _ = QFileDialog.getSaveFileName(
            self, "Export CSV", "export.csv", "CSV (*.csv)")
        if not path:
            return
        if not path.endswith(".csv"):
            path += ".csv"
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=self.columns)
            w.writeheader()
            for r in self.rows:
                w.writerow({c: r.get(c, "") for c in self.columns})

    def total_of(self, column):
        total = 0.0
        for r in self.rows:
            try:
                total += float(str(r.get(column, "") or 0).replace(",", "").replace("$", ""))
            except ValueError:
                pass
        return total
