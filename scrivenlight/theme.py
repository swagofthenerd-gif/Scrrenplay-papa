"""Minimal, modern stylesheets. Two palettes: a warm dark and a soft light."""

DARK_QSS = """
* { font-family: "Inter", "Segoe UI", "Cantarell", sans-serif; }

QMainWindow, QWidget { background: #14151a; color: #e6e7ea; }

QMenuBar { background: #14151a; color: #c9cad0; border: none; padding: 2px 6px; }
QMenuBar::item { background: transparent; padding: 6px 10px; border-radius: 6px; }
QMenuBar::item:selected { background: #24262e; }
QMenu { background: #1c1e25; color: #e6e7ea; border: 1px solid #2a2d36; border-radius: 8px; padding: 6px; }
QMenu::item { padding: 6px 22px; border-radius: 6px; }
QMenu::item:selected { background: #2f323c; }

#sidebar { background: #101116; border-right: 1px solid #20222a; }
#docTitle { font-size: 16px; font-weight: 600; color: #f2f3f5; padding-bottom: 6px; }
#caption { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: #6b6e78; padding: 8px 0 2px 2px; }

#nav { background: transparent; border: none; outline: none; }
#nav::item { color: #b7b9c2; padding: 8px 10px; border-radius: 7px; margin: 1px 0; }
#nav::item:hover { background: #1b1d24; }
#nav::item:selected { background: #2b2e38; color: #ffffff; }

#editorWrap { background: #14151a; }
#topbar { background: #14151a; border-bottom: 1px solid #20222a; }
#statusbar { background: #101116; border-top: 1px solid #20222a; color: #777a85; font-size: 12px; }
#statusActive { color: #cfd1d8; font-weight: 600; }

QLabel { color: #9a9ca6; font-size: 13px; }

#elementCombo {
    background: #1d1f27; color: #e6e7ea; border: 1px solid #2c2f3a;
    border-radius: 7px; padding: 5px 12px; min-width: 150px;
}
#elementCombo:hover { border-color: #3a3e4b; }
#elementCombo::drop-down { border: none; width: 22px; }
#elementCombo QAbstractItemView {
    background: #1c1e25; color: #e6e7ea; border: 1px solid #2c2f3a;
    border-radius: 8px; selection-background-color: #2f323c; outline: none;
}

#ghostBtn {
    background: transparent; color: #b7b9c2; border: 1px solid #2c2f3a;
    border-radius: 7px; padding: 6px 14px;
}
#ghostBtn:hover { background: #1d1f27; color: #fff; border-color: #3a3e4b; }

#pageScroll { background: #0d0e12; border: none; }
#pageHolder { background: #0d0e12; }

#page {
    background: #fbfbf9;
    border-radius: 4px;
}

#editor {
    background: #fbfbf9;
    color: #1a1a1a;
    border: none;
    padding: 64px 70px 64px 96px;   /* paper margins (top right bottom left) */
    selection-background-color: #c9d9ff;
    selection-color: #101010;
}

QScrollBar:vertical { background: transparent; width: 12px; margin: 4px; }
QScrollBar::handle:vertical { background: #2c2f3a; border-radius: 6px; min-height: 30px; }
QScrollBar::handle:vertical:hover { background: #3a3e4b; }
QScrollBar::add-line, QScrollBar::sub-line { height: 0; }
QScrollBar::add-page, QScrollBar::sub-page { background: transparent; }
"""


LIGHT_QSS = """
* { font-family: "Inter", "Segoe UI", "Cantarell", sans-serif; }

QMainWindow, QWidget { background: #f4f4f2; color: #21232a; }

QMenuBar { background: #f4f4f2; color: #3a3d46; border: none; padding: 2px 6px; }
QMenuBar::item { background: transparent; padding: 6px 10px; border-radius: 6px; }
QMenuBar::item:selected { background: #e4e5e2; }
QMenu { background: #ffffff; color: #21232a; border: 1px solid #dcdde0; border-radius: 8px; padding: 6px; }
QMenu::item { padding: 6px 22px; border-radius: 6px; }
QMenu::item:selected { background: #ecedf0; }

#sidebar { background: #ecece9; border-right: 1px solid #dddedb; }
#docTitle { font-size: 16px; font-weight: 600; color: #1a1c22; padding-bottom: 6px; }
#caption { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: #9a9c9f; padding: 8px 0 2px 2px; }

#nav { background: transparent; border: none; outline: none; }
#nav::item { color: #4a4d55; padding: 8px 10px; border-radius: 7px; margin: 1px 0; }
#nav::item:hover { background: #e2e2df; }
#nav::item:selected { background: #d6d7d3; color: #111; }

#editorWrap { background: #f4f4f2; }
#topbar { background: #f4f4f2; border-bottom: 1px solid #e0e1de; }
#statusbar { background: #ecece9; border-top: 1px solid #dddedb; color: #8a8c8f; font-size: 12px; }
#statusActive { color: #3a3d46; font-weight: 600; }

QLabel { color: #6b6e76; font-size: 13px; }

#elementCombo {
    background: #ffffff; color: #21232a; border: 1px solid #d4d5d8;
    border-radius: 7px; padding: 5px 12px; min-width: 150px;
}
#elementCombo:hover { border-color: #bcbdc1; }
#elementCombo::drop-down { border: none; width: 22px; }
#elementCombo QAbstractItemView {
    background: #ffffff; color: #21232a; border: 1px solid #d4d5d8;
    border-radius: 8px; selection-background-color: #ecedf0; outline: none;
}

#ghostBtn {
    background: transparent; color: #4a4d55; border: 1px solid #d4d5d8;
    border-radius: 7px; padding: 6px 14px;
}
#ghostBtn:hover { background: #ffffff; color: #111; border-color: #bcbdc1; }

#pageScroll { background: #dcdcd8; border: none; }
#pageHolder { background: #dcdcd8; }

#page { background: #ffffff; border-radius: 4px; }

#editor {
    background: #ffffff;
    color: #1a1a1a;
    border: none;
    padding: 64px 70px 64px 96px;
    selection-background-color: #c9d9ff;
    selection-color: #101010;
}

QScrollBar:vertical { background: transparent; width: 12px; margin: 4px; }
QScrollBar::handle:vertical { background: #c8c9c5; border-radius: 6px; min-height: 30px; }
QScrollBar::handle:vertical:hover { background: #b3b4b0; }
QScrollBar::add-line, QScrollBar::sub-line { height: 0; }
QScrollBar::add-page, QScrollBar::sub-page { background: transparent; }
"""


# ---- additional styles for tabbed production workspace ----

_TABS_DARK = """
#appHeader { background: #101116; border-bottom: 1px solid #20222a; }
#projectTitle {
    background: transparent; color: #f2f3f5; font-size: 17px; font-weight: 600;
    border: none; padding: 4px 2px;
}
#projectTitle:focus { background: #1b1d24; border-radius: 6px; }
#hint { color: #6b6e78; font-size: 12px; }

QTabWidget::pane { border: none; background: #14151a; }
QTabBar { background: #101116; }
QTabBar::tab {
    background: transparent; color: #9a9ca6; padding: 10px 18px;
    border: none; border-bottom: 2px solid transparent; font-size: 13px;
}
QTabBar::tab:hover { color: #d4d6dc; }
QTabBar::tab:selected { color: #ffffff; border-bottom: 2px solid #6f8cff; }

#tabHeading { font-size: 16px; font-weight: 600; color: #f2f3f5; }
#csSection {
    font-size: 11px; font-weight: 700; letter-spacing: 1px; color: #7d8090;
    padding-top: 6px;
}

#gridBtn {
    background: #1d1f27; color: #d4d6dc; border: 1px solid #2c2f3a;
    border-radius: 7px; padding: 6px 12px; font-size: 12px;
}
#gridBtn:hover { background: #262934; color: #fff; border-color: #3a3e4b; }

#dataGrid {
    background: #16171d; color: #e6e7ea; gridline-color: #24262e;
    border: 1px solid #24262e; border-radius: 8px;
}
#dataGrid::item:selected { background: #2b3350; color: #fff; }
#dataGrid::item:alternate { background: #14151a; }
QHeaderView::section {
    background: #1c1e25; color: #b7b9c2; padding: 7px 8px;
    border: none; border-right: 1px solid #24262e; border-bottom: 1px solid #24262e;
    font-weight: 600; font-size: 12px;
}
QTableWidget QComboBox {
    background: #1d1f27; color: #e6e7ea; border: 1px solid #2c2f3a;
    border-radius: 5px; padding: 2px 6px;
}
QTableCornerButton::section { background: #1c1e25; border: none; }

#csList { background: #101116; border-right: 1px solid #20222a; }
#csScroll, #csField { color: #e6e7ea; }
#csField {
    background: #1a1c22; color: #e6e7ea; border: 1px solid #2a2d36;
    border-radius: 6px; padding: 6px 8px;
}
#csField:focus { border-color: #4d5670; }

#totalBar { background: #101116; border-top: 1px solid #20222a; }
#totalValue { color: #8fe0a0; font-size: 18px; font-weight: 700; }
"""

_TABS_LIGHT = """
#appHeader { background: #ecece9; border-bottom: 1px solid #dddedb; }
#projectTitle {
    background: transparent; color: #1a1c22; font-size: 17px; font-weight: 600;
    border: none; padding: 4px 2px;
}
#projectTitle:focus { background: #ffffff; border-radius: 6px; }
#hint { color: #9a9c9f; font-size: 12px; }

QTabWidget::pane { border: none; background: #f4f4f2; }
QTabBar { background: #ecece9; }
QTabBar::tab {
    background: transparent; color: #6b6e76; padding: 10px 18px;
    border: none; border-bottom: 2px solid transparent; font-size: 13px;
}
QTabBar::tab:hover { color: #2a2c33; }
QTabBar::tab:selected { color: #111; border-bottom: 2px solid #4d6bff; }

#tabHeading { font-size: 16px; font-weight: 600; color: #1a1c22; }
#csSection {
    font-size: 11px; font-weight: 700; letter-spacing: 1px; color: #8a8c90;
    padding-top: 6px;
}

#gridBtn {
    background: #ffffff; color: #3a3d46; border: 1px solid #d4d5d8;
    border-radius: 7px; padding: 6px 12px; font-size: 12px;
}
#gridBtn:hover { background: #f3f3f1; color: #111; border-color: #bcbdc1; }

#dataGrid {
    background: #ffffff; color: #21232a; gridline-color: #e6e7e4;
    border: 1px solid #e0e1de; border-radius: 8px;
}
#dataGrid::item:selected { background: #d8e0ff; color: #111; }
#dataGrid::item:alternate { background: #f7f7f5; }
QHeaderView::section {
    background: #efefec; color: #4a4d55; padding: 7px 8px;
    border: none; border-right: 1px solid #e0e1de; border-bottom: 1px solid #e0e1de;
    font-weight: 600; font-size: 12px;
}
QTableWidget QComboBox {
    background: #ffffff; color: #21232a; border: 1px solid #d4d5d8;
    border-radius: 5px; padding: 2px 6px;
}
QTableCornerButton::section { background: #efefec; border: none; }

#csList { background: #ecece9; border-right: 1px solid #dddedb; }
#csField {
    background: #ffffff; color: #21232a; border: 1px solid #d4d5d8;
    border-radius: 6px; padding: 6px 8px;
}
#csField:focus { border-color: #aeb6d8; }

#totalBar { background: #ecece9; border-top: 1px solid #dddedb; }
#totalValue { color: #1f9d57; font-size: 18px; font-weight: 700; }
"""

DARK_QSS = DARK_QSS + _TABS_DARK
LIGHT_QSS = LIGHT_QSS + _TABS_LIGHT


# ---- storyboard tab styles ----
_SB_DARK = """
#sbList { background: #101116; border-right: 1px solid #20222a; }
#sbScroll { background: #14151a; }
#sbImage {
    background: #0d0e12; border: 1px solid #2a2d36; border-radius: 8px;
    color: #6b6e78; font-size: 12px;
}
#sbSection {
    font-size: 11px; font-weight: 700; letter-spacing: 1.2px; color: #6f8cff;
    padding: 10px 0 2px 0; border-bottom: 1px solid #20222a;
}
#sbFieldLabel { color: #9a9ca6; font-size: 12px; }
"""
_SB_LIGHT = """
#sbList { background: #ecece9; border-right: 1px solid #dddedb; }
#sbScroll { background: #f4f4f2; }
#sbImage {
    background: #e8e8e5; border: 1px solid #d4d5d8; border-radius: 8px;
    color: #8a8c90; font-size: 12px;
}
#sbSection {
    font-size: 11px; font-weight: 700; letter-spacing: 1.2px; color: #4d6bff;
    padding: 10px 0 2px 0; border-bottom: 1px solid #e0e1de;
}
#sbFieldLabel { color: #6b6e76; font-size: 12px; }
"""
DARK_QSS = DARK_QSS + _SB_DARK
LIGHT_QSS = LIGHT_QSS + _SB_LIGHT
