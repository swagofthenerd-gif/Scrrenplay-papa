#!/usr/bin/env python3
"""ScrivenLight entry point."""
import sys
from PyQt6.QtWidgets import QApplication
from PyQt6.QtGui import QFont

from scrivenlight.window import MainWindow, APP_NAME


def main():
    QApplication.setApplicationName(APP_NAME)
    QApplication.setDesktopFileName("scrivenlight")
    app = QApplication(sys.argv)
    app.setFont(QFont("Inter", 10))
    win = MainWindow()

    if len(sys.argv) > 1:
        path = sys.argv[1]
        try:
            from scrivenlight.project import Project
            from scrivenlight.model import Screenplay
            if path.endswith(".fountain"):
                with open(path, encoding="utf-8") as f:
                    sp = Screenplay.from_fountain(f.read())
                win.project = Project(title=sp.title or "Untitled Production",
                                      screenplay=sp)
                win._path = None
            else:
                win.project = Project.load(path)
                win._path = path
            win._rebind_all()
            win._dirty = False
            win._update_title()
        except Exception as e:
            print(f"Could not open {path}: {e}")

    win.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
