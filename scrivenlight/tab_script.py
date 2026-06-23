"""
Script tab: the screenplay editor with its scene navigator sidebar.
Extracted from the original single-window layout so it can live inside the
tabbed production workspace.
"""

from PyQt6.QtWidgets import (
    QWidget, QHBoxLayout, QVBoxLayout, QListWidget, QListWidgetItem,
    QLabel, QFrame, QComboBox, QToolButton, QScrollArea)
from PyQt6.QtGui import QFont
from PyQt6.QtCore import Qt, QTimer, pyqtSignal

from .editor import ScreenplayEditor
from .elements import ElementType, STYLES
from .model import Screenplay


class ScriptTab(QWidget):
    changed = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__(parent)
        root = QHBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # scene navigator
        self.sidebar = QFrame()
        self.sidebar.setObjectName("sidebar")
        self.sidebar.setFixedWidth(240)
        sb = QVBoxLayout(self.sidebar)
        sb.setContentsMargins(14, 16, 10, 14)
        sb.setSpacing(8)
        cap = QLabel("SCENES")
        cap.setObjectName("caption")
        sb.addWidget(cap)
        self.nav = QListWidget()
        self.nav.setObjectName("nav")
        self.nav.setFrameShape(QFrame.Shape.NoFrame)
        self.nav.itemClicked.connect(self._jump)
        sb.addWidget(self.nav, 1)
        root.addWidget(self.sidebar)

        # editor column
        col = QFrame()
        col.setObjectName("editorWrap")
        cl = QVBoxLayout(col)
        cl.setContentsMargins(0, 0, 0, 0)
        cl.setSpacing(0)

        bar = QFrame()
        bar.setObjectName("topbar")
        bar.setFixedHeight(46)
        bl = QHBoxLayout(bar)
        bl.setContentsMargins(16, 6, 16, 6)
        bl.addWidget(QLabel("Element:"))
        self.element_combo = QComboBox()
        self.element_combo.setObjectName("elementCombo")
        for et in [ElementType.SCENE_HEADING, ElementType.ACTION,
                   ElementType.CHARACTER, ElementType.DIALOGUE,
                   ElementType.PARENTHETICAL, ElementType.TRANSITION,
                   ElementType.SHOT]:
            self.element_combo.addItem(STYLES[et].name, et.value)
        self.element_combo.currentIndexChanged.connect(self._combo_changed)
        bl.addWidget(self.element_combo)
        bl.addStretch(1)
        self.element_hint = QLabel("Tab to cycle · Enter for next element")
        self.element_hint.setObjectName("hint")
        bl.addWidget(self.element_hint)
        cl.addWidget(bar)

        self.scroll = QScrollArea()
        self.scroll.setObjectName("pageScroll")
        self.scroll.setWidgetResizable(True)
        self.scroll.setFrameShape(QFrame.Shape.NoFrame)
        holder = QWidget()
        holder.setObjectName("pageHolder")
        ph = QVBoxLayout(holder)
        ph.setContentsMargins(0, 28, 0, 60)
        ph.setAlignment(Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignTop)
        self.page = QFrame()
        self.page.setObjectName("page")
        self.page.setFixedWidth(820)
        pl = QVBoxLayout(self.page)
        pl.setContentsMargins(0, 0, 0, 0)
        self.editor = ScreenplayEditor()
        self.editor.setObjectName("editor")
        self.editor.setFrameShape(QFrame.Shape.NoFrame)
        self.editor.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.editor.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.editor.setMinimumHeight(1000)
        self.editor.contentChanged.connect(self._on_content)
        self.editor.elementChanged.connect(self._on_element)
        pl.addWidget(self.editor)
        ph.addWidget(self.page)
        self.scroll.setWidget(holder)
        cl.addWidget(self.scroll, 1)
        root.addWidget(col, 1)

        self.editor.document().documentLayout().documentSizeChanged.connect(
            self._sync_height)

        self._nav_timer = QTimer(self)
        self._nav_timer.setInterval(500)
        self._nav_timer.setSingleShot(True)
        self._nav_timer.timeout.connect(self.refresh_navigator)

    # ---------- public ----------
    def load(self, sp: Screenplay):
        self.editor.load_screenplay(sp)
        self.refresh_navigator()

    def extract(self, title, author) -> Screenplay:
        return self.editor.extract_screenplay(title=title, author=author)

    def set_element(self, et: ElementType):
        self.editor.set_current_element(et)
        self.editor.setFocus()

    def toggle_sidebar(self):
        self.sidebar.setVisible(not self.sidebar.isVisible())

    # ---------- internal ----------
    def _sync_height(self):
        h = int(self.editor.document().size().height()) + 40
        self.editor.setMinimumHeight(max(1000, h))

    def _combo_changed(self, idx):
        val = self.element_combo.itemData(idx)
        if val:
            self.editor.set_current_element(ElementType(val))
            self.editor.setFocus()

    def _on_content(self):
        self._nav_timer.start()
        self.changed.emit()

    def _on_element(self, name):
        i = self.element_combo.findText(name)
        if i >= 0 and i != self.element_combo.currentIndex():
            self.element_combo.blockSignals(True)
            self.element_combo.setCurrentIndex(i)
            self.element_combo.blockSignals(False)

    def refresh_navigator(self):
        self.nav.clear()
        block = self.editor.document().begin()
        idx = 0
        while block.isValid():
            et = self.editor._type_from_state(block.userState())
            if et == ElementType.SCENE_HEADING:
                idx += 1
                text = block.text().strip() or "(untitled scene)"
                item = QListWidgetItem(f"{idx:>2}.  {text}")
                item.setData(Qt.ItemDataRole.UserRole, block.position())
                self.nav.addItem(item)
            block = block.next()

    def _jump(self, item):
        pos = item.data(Qt.ItemDataRole.UserRole)
        cur = self.editor.textCursor()
        cur.setPosition(pos)
        self.editor.setTextCursor(cur)
        self.editor.setFocus()
        rect = self.editor.cursorRect()
        self.scroll.ensureVisible(0, self.page.y() + rect.y(), 0, 120)
