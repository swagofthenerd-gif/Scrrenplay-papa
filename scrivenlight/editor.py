"""
The screenplay editor. Built on QTextEdit with a custom document layout.

Each paragraph in the QTextDocument corresponds to one screenplay Block.
The block's ElementType is stored in the paragraph's userState, and we apply
margins / casing / alignment per paragraph via QTextBlockFormat.

Key behaviors implemented:
  * Tab        -> cycle element type (Final Draft style)
  * Enter      -> commit current block, create the "natural next" element
  * Auto-upper -> scene headings / character / transition typed in caps live
  * Smart scene-heading detection (INT./EXT.)
  * Character & scene-location autocomplete popup
"""

from PyQt6.QtWidgets import (QTextEdit, QCompleter, QApplication)
from PyQt6.QtGui import (QTextCharFormat, QTextBlockFormat, QFont, QTextCursor,
                         QKeyEvent, QColor)
from PyQt6.QtCore import Qt, QStringListModel, pyqtSignal

from .elements import (ElementType, STYLES, PAGE_WIDTH_IN, LEFT_EDGE_IN,
                       RIGHT_EDGE_IN, guess_element_for_text, SCENE_PREFIXES)
from .model import Screenplay, Block


PT_PER_IN = 72.0
# Courier 12pt: each character is 0.1 inch wide => 7.2pt.
FONT_PT = 12


class ScreenplayEditor(QTextEdit):
    contentChanged = pyqtSignal()
    elementChanged = pyqtSignal(str)   # emits current element display name

    def __init__(self, parent=None):
        super().__init__(parent)
        self._px_per_in = 96.0          # logical; refined on first layout
        self._suppress = False
        self._completer = None
        self._char_names = set()
        self._locations = set()

        font = QFont("Courier New")
        font.setStyleHint(QFont.StyleHint.Monospace)
        font.setPointSize(FONT_PT)
        font.setFixedPitch(True)
        self.setFont(font)

        self.setAcceptRichText(False)
        self.setTabChangesFocus(False)
        self.setCursorWidth(2)
        self.document().setDocumentMargin(0)

        self._setup_completer()
        self.textChanged.connect(self._on_text_changed)
        self.cursorPositionChanged.connect(self._on_cursor_moved)

    # ---------- public API ----------
    def load_screenplay(self, sp: Screenplay):
        self._suppress = True
        doc = self.document()
        doc.clear()
        cursor = QTextCursor(doc)
        first = True
        for b in sp.blocks:
            if not first:
                cursor.insertBlock()
            first = False
            cursor.block().setUserState(self._state_for(b.etype()))
            cursor.insertText(self._cased(b.text, b.etype()))
        self._suppress = False
        self._reformat_all()
        self._rebuild_vocab()
        self.moveCursor(QTextCursor.MoveOperation.Start)
        self._emit_current_element()

    def extract_screenplay(self, title="Untitled", author="") -> Screenplay:
        sp = Screenplay(title=title, author=author)
        block = self.document().begin()
        while block.isValid():
            etype = self._type_from_state(block.userState())
            sp.blocks.append(Block(etype.value, block.text()))
            block = block.next()
        if not sp.blocks:
            sp.blocks = [Block(ElementType.SCENE_HEADING.value, "")]
        return sp

    def set_current_element(self, etype: ElementType):
        cursor = self.textCursor()
        cursor.block().setUserState(self._state_for(etype))
        self._format_block(cursor.block())
        self._apply_case_to_block(cursor.block(), etype)
        self._emit_current_element()
        self.contentChanged.emit()

    def current_element(self) -> ElementType:
        return self._type_from_state(self.textCursor().block().userState())

    # ---------- element state encoding ----------
    _ORDER = list(ElementType)

    def _state_for(self, etype: ElementType) -> int:
        return self._ORDER.index(etype)

    def _type_from_state(self, state: int) -> ElementType:
        if state is None or state < 0 or state >= len(self._ORDER):
            return ElementType.ACTION
        return self._ORDER[state]

    # ---------- formatting ----------
    def _px_in(self, inches: float) -> float:
        # Use logical DPI of the widget for accurate inch->px mapping.
        dpi = self.logicalDpiX() or 96.0
        return inches * dpi

    def _format_block(self, qblock):
        etype = self._type_from_state(qblock.userState())
        style = STYLES[etype]
        # Convert page-edge inches to indents relative to the document.
        left_px = self._px_in(style.left_in)
        right_px = self._px_in(style.right_in)

        bf = QTextBlockFormat()
        bf.setLeftMargin(left_px)
        bf.setRightMargin(right_px)
        bf.setTopMargin(self._px_in(0.166) if style.space_before else 0)
        bf.setLineHeight(100, 1)  # single spacing
        if style.align == "right":
            bf.setAlignment(Qt.AlignmentFlag.AlignRight)
        else:
            bf.setAlignment(Qt.AlignmentFlag.AlignLeft)

        cur = QTextCursor(qblock)
        cur.setBlockFormat(bf)

    def _reformat_all(self):
        block = self.document().begin()
        while block.isValid():
            self._format_block(block)
            block = block.next()

    def _cased(self, text: str, etype: ElementType) -> str:
        return text.upper() if STYLES[etype].uppercase else text

    def _apply_case_to_block(self, qblock, etype: ElementType):
        if not STYLES[etype].uppercase:
            return
        text = qblock.text()
        if not text or text == text.upper():
            return
        col = self.textCursor().positionInBlock()
        cur = QTextCursor(qblock)
        cur.movePosition(QTextCursor.MoveOperation.StartOfBlock)
        cur.movePosition(QTextCursor.MoveOperation.EndOfBlock,
                         QTextCursor.MoveMode.KeepAnchor)
        self._suppress = True
        cur.insertText(text.upper())
        self._suppress = False
        nc = self.textCursor()
        nc.setPosition(qblock.position() + min(col, len(text)))
        self.setTextCursor(nc)

    # ---------- completer ----------
    def _setup_completer(self):
        self._completer = QCompleter(self)
        self._completer.setWidget(self)
        self._completer.setCompletionMode(
            QCompleter.CompletionMode.PopupCompletion)
        self._completer.setCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive)
        self._completer.activated.connect(self._insert_completion)
        self._model = QStringListModel(self)
        self._completer.setModel(self._model)

    def _rebuild_vocab(self):
        self._char_names.clear()
        self._locations.clear()
        block = self.document().begin()
        while block.isValid():
            et = self._type_from_state(block.userState())
            t = block.text().strip()
            if et == ElementType.CHARACTER and t:
                self._char_names.add(t.upper())
            elif et == ElementType.SCENE_HEADING and t:
                self._locations.add(t.upper())
            block = block.next()

    def _active_vocab(self):
        et = self.current_element()
        if et == ElementType.CHARACTER:
            return sorted(self._char_names)
        if et == ElementType.SCENE_HEADING:
            base = sorted(self._locations) + list(SCENE_PREFIXES)
            return base
        return []

    def _insert_completion(self, completion: str):
        cur = self.textCursor()
        cur.movePosition(QTextCursor.MoveOperation.StartOfBlock)
        cur.movePosition(QTextCursor.MoveOperation.EndOfBlock,
                         QTextCursor.MoveMode.KeepAnchor)
        cur.insertText(completion)
        self.setTextCursor(cur)

    def _maybe_complete(self):
        vocab = self._active_vocab()
        if not vocab:
            self._completer.popup().hide()
            return
        prefix = self.textCursor().block().text()
        self._model.setStringList(vocab)
        self._completer.setCompletionPrefix(prefix)
        if prefix and self._completer.completionCount() > 0:
            popup = self._completer.popup()
            popup.setCurrentIndex(
                self._completer.completionModel().index(0, 0))
            rect = self.cursorRect()
            rect.setWidth(
                popup.sizeHintForColumn(0)
                + popup.verticalScrollBar().sizeHint().width() + 20)
            self._completer.complete(rect)
        else:
            self._completer.popup().hide()

    # ---------- key handling ----------
    def keyPressEvent(self, e: QKeyEvent):
        popup = self._completer.popup()
        if popup.isVisible():
            if e.key() in (Qt.Key.Key_Enter, Qt.Key.Key_Return,
                           Qt.Key.Key_Escape, Qt.Key.Key_Tab,
                           Qt.Key.Key_Up, Qt.Key.Key_Down):
                e.ignore()
                return

        if e.key() == Qt.Key.Key_Tab:
            self._handle_tab(backwards=False)
            return
        if e.key() == Qt.Key.Key_Backtab:
            self._handle_tab(backwards=True)
            return
        if e.key() in (Qt.Key.Key_Return, Qt.Key.Key_Enter) and \
                not (e.modifiers() & Qt.KeyboardModifier.ShiftModifier):
            self._handle_enter()
            return

        super().keyPressEvent(e)

        # live uppercase + autocompletion after normal typing
        etype = self.current_element()
        if STYLES[etype].uppercase and e.text() and e.text().isprintable():
            self._live_upper()
        if e.text() and (e.text().isalnum() or e.text() in ". /"):
            self._maybe_complete()
        else:
            self._completer.popup().hide()

    def _live_upper(self):
        cur = self.textCursor()
        block = cur.block()
        text = block.text()
        if text and text != text.upper():
            col = cur.positionInBlock()
            self._suppress = True
            c = QTextCursor(block)
            c.movePosition(QTextCursor.MoveOperation.StartOfBlock)
            c.movePosition(QTextCursor.MoveOperation.EndOfBlock,
                           QTextCursor.MoveMode.KeepAnchor)
            c.insertText(text.upper())
            self._suppress = False
            nc = self.textCursor()
            nc.setPosition(block.position() + col)
            self.setTextCursor(nc)

    def _handle_tab(self, backwards: bool):
        et = self.current_element()
        if backwards:
            # cycle backwards through a sensible ring
            ring = [ElementType.SCENE_HEADING, ElementType.ACTION,
                    ElementType.CHARACTER, ElementType.DIALOGUE,
                    ElementType.PARENTHETICAL, ElementType.TRANSITION]
            idx = ring.index(et) if et in ring else 0
            nxt = ring[(idx - 1) % len(ring)]
        else:
            nxt = STYLES[et].tab_to
        self.set_current_element(nxt)

    def _handle_enter(self):
        cur = self.textCursor()
        et = self.current_element()
        text = cur.block().text().strip()

        # Empty action/character line + Enter -> just convert, don't add block
        next_type = STYLES[et].enter_to

        # Smart: empty character line -> revert to action
        if et == ElementType.CHARACTER and not text:
            self.set_current_element(ElementType.ACTION)
            return
        if et == ElementType.PARENTHETICAL and not text:
            self.set_current_element(ElementType.DIALOGUE)
            return

        # Auto-detect scene heading typed as action
        if et == ElementType.ACTION and text:
            guess = guess_element_for_text(text)
            if guess == ElementType.SCENE_HEADING:
                self.set_current_element(ElementType.SCENE_HEADING)
                et = ElementType.SCENE_HEADING
                next_type = STYLES[et].enter_to

        self._suppress = True
        cur.insertBlock()
        cur.block().setUserState(self._state_for(next_type))
        self.setTextCursor(cur)
        self._suppress = False
        self._format_block(cur.block())
        self._rebuild_vocab()
        self._emit_current_element()
        self.contentChanged.emit()

    # ---------- signals ----------
    def _on_text_changed(self):
        if self._suppress:
            return
        self.contentChanged.emit()

    def _on_cursor_moved(self):
        self._emit_current_element()

    def _emit_current_element(self):
        self.elementChanged.emit(STYLES[self.current_element()].name)

    def _emit(self):
        self._emit_current_element()
