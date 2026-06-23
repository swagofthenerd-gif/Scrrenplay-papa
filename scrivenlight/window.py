"""
Main window: a tabbed production workspace (StudioBinder-style).

Tabs:
  Script      — screenplay editor + scene navigator
  Shot List   — per-shot grid (size, angle, movement, lens, gear…)
  Schedule    — stripboard shooting schedule
  Call Sheets — per-day call sheets with crew call + day schedule
  Contacts    — cast & crew directory
  Budget      — line-item budget with live total

Everything lives in one Project saved to a single .slt file.
"""

import os
from PyQt6.QtWidgets import (
    QMainWindow, QTabWidget, QFileDialog, QMessageBox, QWidget, QVBoxLayout,
    QLabel, QFrame, QHBoxLayout, QToolButton, QLineEdit)
from PyQt6.QtGui import QAction, QKeySequence
from PyQt6.QtCore import Qt

from .project import Project
from .model import Screenplay
from .elements import ElementType
from .theme import DARK_QSS, LIGHT_QSS
from .tab_script import ScriptTab
from .tab_storyboard import StoryboardTab
from .tabs_grid import ShotListTab, ScheduleTab, ContactsTab, BudgetTab
from .tabs_callsheet import CallSheetsTab


APP_NAME = "ScrivenLight"
FILE_FILTER = "ScrivenLight Project (*.slt);;Fountain (*.fountain);;All files (*)"


def _pdf():
    from . import pdf_export
    return pdf_export


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle(APP_NAME)
        self.resize(1280, 840)
        self._path = None
        self._dark = True
        self._dirty = False
        self.project = Project()

        self._build_tabs()
        self._build_menu()
        self.apply_theme()
        self.new_document()
        self._setup_autosave()

    # ---------------- tabs ----------------
    def _build_tabs(self):
        central = QWidget()
        outer = QVBoxLayout(central)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)

        # header strip with project title + theme toggle
        header = QFrame()
        header.setObjectName("appHeader")
        header.setFixedHeight(50)
        hl = QHBoxLayout(header)
        hl.setContentsMargins(18, 8, 16, 8)
        self.title_edit = QLineEdit(self.project.title)
        self.title_edit.setObjectName("projectTitle")
        self.title_edit.setFrame(False)
        self.title_edit.textChanged.connect(self._title_changed)
        hl.addWidget(self.title_edit, 1)
        self.theme_btn = QToolButton()
        self.theme_btn.setObjectName("ghostBtn")
        self.theme_btn.clicked.connect(self.toggle_theme)
        hl.addWidget(self.theme_btn)
        outer.addWidget(header)

        self.tabs = QTabWidget()
        self.tabs.setObjectName("mainTabs")
        self.tabs.setDocumentMode(True)

        self.script_tab = ScriptTab()
        self.shotlist_tab = ShotListTab(self.project)
        self.storyboard_tab = StoryboardTab(self.project)
        self.schedule_tab = ScheduleTab(self.project)
        self.callsheets_tab = CallSheetsTab(self.project)
        self.contacts_tab = ContactsTab(self.project)
        self.budget_tab = BudgetTab(self.project)

        for w in (self.script_tab, self.shotlist_tab, self.storyboard_tab,
                  self.schedule_tab, self.callsheets_tab, self.contacts_tab,
                  self.budget_tab):
            w.changed.connect(self._mark_dirty)

        self.tabs.addTab(self.script_tab, "  Script  ")
        self.tabs.addTab(self.shotlist_tab, "  Shot List  ")
        self.tabs.addTab(self.storyboard_tab, "  Storyboard  ")
        self.tabs.addTab(self.schedule_tab, "  Schedule  ")
        self.tabs.addTab(self.callsheets_tab, "  Call Sheets  ")
        self.tabs.addTab(self.contacts_tab, "  Contacts  ")
        self.tabs.addTab(self.budget_tab, "  Budget  ")
        outer.addWidget(self.tabs, 1)

        self.setCentralWidget(central)

    # ---------------- menu ----------------
    def _build_menu(self):
        m = self.menuBar()
        filem = m.addMenu("&File")
        self._add(filem, "New Project", "Ctrl+N", self.new_document)
        self._add(filem, "Open…", "Ctrl+O", self.open_document)
        self._add(filem, "Save", "Ctrl+S", self.save_document)
        self._add(filem, "Save As…", "Ctrl+Shift+S", self.save_as)
        filem.addSeparator()
        self._add(filem, "Import Screenplay (Fountain)…", "", self.import_fountain)
        self._add(filem, "Export Screenplay (Fountain)…", "", self.export_fountain)
        filem.addSeparator()
        pdfm = filem.addMenu("Export PDF")
        self._add(pdfm, "Call Sheet (current)…", "", self.export_callsheet_pdf)
        self._add(pdfm, "Shot List…", "", self.export_shotlist_pdf)
        self._add(pdfm, "Storyboard…", "", self.export_storyboard_pdf)
        filem.addSeparator()
        self._add(filem, "Quit", "Ctrl+Q", self.close)

        editm = m.addMenu("&Edit")
        self._add(editm, "Undo", "Ctrl+Z", self._undo)
        self._add(editm, "Redo", "Ctrl+Shift+Z", self._redo)

        fmt = m.addMenu("F&ormat")
        keys = {ElementType.SCENE_HEADING: "Ctrl+1", ElementType.ACTION: "Ctrl+2",
                ElementType.CHARACTER: "Ctrl+3", ElementType.DIALOGUE: "Ctrl+4",
                ElementType.PARENTHETICAL: "Ctrl+5", ElementType.TRANSITION: "Ctrl+6"}
        from .elements import STYLES
        for et, k in keys.items():
            a = QAction(STYLES[et].name, self)
            a.setShortcut(QKeySequence(k))
            a.triggered.connect(lambda _, e=et: self.script_tab.set_element(e))
            fmt.addAction(a)

        go = m.addMenu("&Go")
        names = ["Script", "Shot List", "Storyboard", "Schedule",
                 "Call Sheets", "Contacts", "Budget"]
        for i, n in enumerate(names):
            a = QAction(n, self)
            a.setShortcut(QKeySequence(f"Ctrl+{i+1}" if i == 0 else f"Alt+{i+1}"))
            a.triggered.connect(lambda _, idx=i: self.tabs.setCurrentIndex(idx))
            go.addAction(a)

        viewm = m.addMenu("&View")
        self._add(viewm, "Toggle Theme", "Ctrl+D", self.toggle_theme)
        self._add(viewm, "Toggle Scene List", "Ctrl+B",
                  lambda: self.script_tab.toggle_sidebar())

    def _add(self, menu, name, shortcut, slot):
        a = QAction(name, self)
        if shortcut:
            a.setShortcut(QKeySequence(shortcut))
        a.triggered.connect(slot)
        menu.addAction(a)
        return a

    # ---------------- undo/redo dispatch ----------------
    def _active_grid(self):
        w = self.tabs.currentWidget()
        if w is self.script_tab:
            return None
        return getattr(w, "grid", None)

    def _undo(self):
        grid = self._active_grid()
        if grid is not None:
            grid.undo()
        else:
            self.script_tab.editor.undo()

    def _redo(self):
        grid = self._active_grid()
        if grid is not None:
            grid.redo()
        else:
            self.script_tab.editor.redo()

    # ---------------- autosave ----------------
    def _setup_autosave(self):
        from PyQt6.QtCore import QTimer
        self._autosave_timer = QTimer(self)
        self._autosave_timer.setInterval(30000)  # 30s
        self._autosave_timer.timeout.connect(self._autosave)
        self._autosave_timer.start()

    def _autosave(self):
        if not self._dirty:
            return
        try:
            self._sync_project_from_ui()
            if self._path:
                self.project.save(self._path)
                self._dirty = False
                self._update_title()
            else:
                import os
                recov = os.path.join(
                    os.path.expanduser("~"), ".scrivenlight_recovery.slt")
                self.project.save(recov)
        except Exception:
            pass

    # ---------------- theme ----------------
    def apply_theme(self):
        self.setStyleSheet(DARK_QSS if self._dark else LIGHT_QSS)
        self.theme_btn.setText("☀  Light" if self._dark else "☾  Dark")

    def toggle_theme(self):
        self._dark = not self._dark
        self.apply_theme()

    # ---------------- document ----------------
    def new_document(self):
        if not self._confirm_discard():
            return
        from .model import Block
        sp = Screenplay(title="Untitled")
        sp.blocks = [Block(ElementType.SCENE_HEADING.value, "")]
        self.project = Project(title="Untitled Production", screenplay=sp)
        self._rebind_all()
        self._path = None
        self._dirty = False
        self._update_title()

    def _rebind_all(self):
        self.title_edit.blockSignals(True)
        self.title_edit.setText(self.project.title)
        self.title_edit.blockSignals(False)
        self.script_tab.load(self.project.screenplay)
        self.shotlist_tab.rebind(self.project)
        self.storyboard_tab.rebind(self.project)
        self.schedule_tab.rebind(self.project)
        self.callsheets_tab.rebind(self.project)
        self.contacts_tab.rebind(self.project)
        self.budget_tab.rebind(self.project)

    def open_document(self):
        if not self._confirm_discard():
            return
        path, _ = QFileDialog.getOpenFileName(self, "Open", "", FILE_FILTER)
        if not path:
            return
        try:
            if path.endswith(".fountain"):
                with open(path, encoding="utf-8") as f:
                    sp = Screenplay.from_fountain(f.read())
                self.project = Project(title=sp.title or "Untitled Production",
                                       screenplay=sp)
            else:
                self.project = Project.load(path)
        except Exception as e:
            QMessageBox.critical(self, "Open failed", str(e))
            return
        self._rebind_all()
        self._path = path if not path.endswith(".fountain") else None
        self._dirty = False
        self._update_title()

    def _sync_project_from_ui(self):
        self.project.title = self.title_edit.text()
        self.project.screenplay = self.script_tab.extract(
            self.project.title, self.project.author)

    def save_document(self):
        if not self._path:
            return self.save_as()
        self._do_save(self._path)

    def save_as(self):
        path, _ = QFileDialog.getSaveFileName(
            self, "Save As", (self.project.title or "project") + ".slt",
            FILE_FILTER)
        if not path:
            return
        if not os.path.splitext(path)[1]:
            path += ".slt"
        self._do_save(path)

    def _do_save(self, path):
        self._sync_project_from_ui()
        try:
            self.project.save(path)
        except Exception as e:
            QMessageBox.critical(self, "Save failed", str(e))
            return
        self._path = path
        self._dirty = False
        self._update_title()

    def import_fountain(self):
        if not self._confirm_discard():
            return
        path, _ = QFileDialog.getOpenFileName(
            self, "Import Fountain", "", "Fountain (*.fountain);;All files (*)")
        if not path:
            return
        with open(path, encoding="utf-8") as f:
            sp = Screenplay.from_fountain(f.read())
        self.project.screenplay = sp
        if sp.title:
            self.project.title = sp.title
        self._rebind_all()
        self._dirty = True
        self._update_title()

    def export_fountain(self):
        self._sync_project_from_ui()
        path, _ = QFileDialog.getSaveFileName(
            self, "Export Fountain", (self.project.title or "screenplay") + ".fountain",
            "Fountain (*.fountain)")
        if not path:
            return
        if not path.endswith(".fountain"):
            path += ".fountain"
        with open(path, "w", encoding="utf-8") as f:
            f.write(self.project.screenplay.to_fountain())

    # ---------------- PDF export ----------------
    def _pdf_save_path(self, default_name):
        path, _ = QFileDialog.getSaveFileName(
            self, "Export PDF", default_name + ".pdf", "PDF (*.pdf)")
        if path and not path.endswith(".pdf"):
            path += ".pdf"
        return path

    def export_callsheet_pdf(self):
        cs = self.callsheets_tab._current
        if cs is None:
            QMessageBox.information(self, "No call sheet",
                                    "Select or create a call sheet first.")
            return
        path = self._pdf_save_path(cs.title or "call_sheet")
        if not path:
            return
        self._sync_project_from_ui()
        self._run_pdf(lambda: _pdf().export_call_sheet_pdf(self.project, cs, path), path)

    def export_shotlist_pdf(self):
        path = self._pdf_save_path((self.project.title or "shot_list") + "_shots")
        if not path:
            return
        self._sync_project_from_ui()
        self._run_pdf(lambda: _pdf().export_shot_list_pdf(self.project, path), path)

    def export_storyboard_pdf(self):
        path = self._pdf_save_path((self.project.title or "storyboard") + "_board")
        if not path:
            return
        self._sync_project_from_ui()
        self._run_pdf(lambda: _pdf().export_storyboard_pdf(self.project, path), path)

    def _run_pdf(self, fn, path):
        try:
            fn()
            QMessageBox.information(self, "PDF exported", f"Saved:\n{path}")
        except RuntimeError as e:
            QMessageBox.warning(self, "PDF export", str(e))
        except Exception as e:
            QMessageBox.critical(self, "PDF export failed", str(e))

    def _title_changed(self, text):
        self.project.title = text
        self._mark_dirty()

    def _mark_dirty(self):
        self._dirty = True
        self._update_title()

    def _update_title(self):
        name = os.path.basename(self._path) if self._path else "Untitled"
        star = " •" if self._dirty else ""
        self.setWindowTitle(f"{name}{star} — {APP_NAME}")

    def _confirm_discard(self):
        if not self._dirty:
            return True
        r = QMessageBox.question(
            self, "Unsaved changes", "Discard unsaved changes?",
            QMessageBox.StandardButton.Save | QMessageBox.StandardButton.Discard |
            QMessageBox.StandardButton.Cancel)
        if r == QMessageBox.StandardButton.Save:
            self.save_document()
            return not self._dirty
        return r == QMessageBox.StandardButton.Discard

    def closeEvent(self, e):
        if self._confirm_discard():
            e.accept()
        else:
            e.ignore()
