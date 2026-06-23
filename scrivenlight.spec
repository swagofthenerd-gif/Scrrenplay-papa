# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for ScrivenLight — produces a native app on whatever OS it's
run on. PyInstaller does NOT cross-compile: run this on Windows to get a
Windows build, on macOS to get a macOS build.

  Windows:   pyinstaller scrivenlight.spec
  macOS:     pyinstaller scrivenlight.spec

Output lands in dist/.
"""
import sys
from pathlib import Path

block_cipher = None
APP_NAME = "ScrivenLight"

# PyInstaller injects SPECPATH at runtime; fall back to cwd if absent.
try:
    SPECPATH  # noqa: F821
except NameError:
    SPECPATH = str(Path(".").resolve())

# --- icon per platform (the build scripts create these next to the spec) ---
if sys.platform == "darwin":
    icon_file = "scrivenlight.icns"
elif sys.platform == "win32":
    icon_file = "scrivenlight.ico"
else:
    icon_file = None  # Linux uses the .desktop/.svg via install.sh

# reportlab ships data files (fonts) and several lazily-imported submodules
# that PyInstaller's static analysis can miss — declare them explicitly.
hidden = [
    "reportlab.graphics.barcode.common",
    "reportlab.graphics.barcode.code128",
    "reportlab.graphics.barcode.code39",
    "reportlab.graphics.barcode.code93",
    "reportlab.graphics.barcode.usps",
    "reportlab.graphics.barcode.usps4s",
    "reportlab.graphics.barcode.ecc200datamatrix",
    "reportlab.pdfbase._fontdata",
    "reportlab.lib.utils",
]

datas = []
try:
    from PyInstaller.utils.hooks import collect_data_files
    datas += collect_data_files("reportlab")
except Exception:
    pass

a = Analysis(
    ["main.py"],
    pathex=[str(Path(SPECPATH))],
    binaries=[],
    datas=datas,
    hiddenimports=hidden,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # trim weight: things we never use
        "tkinter", "matplotlib", "numpy.tests", "PyQt6.QtWebEngineCore",
        "PyQt6.QtWebEngineWidgets", "PyQt6.Qt3DCore", "PyQt6.QtBluetooth",
        "PyQt6.QtMultimedia", "PyQt6.QtPositioning", "PyQt6.QtSql",
        "PyQt6.QtNetwork", "PyQt6.QtQml", "PyQt6.QtQuick",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# ---- onedir (portable folder) executable ----
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name=APP_NAME,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,            # GUI app: no terminal window
    disable_windowed_traceback=False,
    argv_emulation=True,      # lets macOS open .slt files passed by Finder
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=icon_file,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name=APP_NAME,
)

# ---- macOS .app bundle ----
if sys.platform == "darwin":
    app = BUNDLE(
        coll,
        name=f"{APP_NAME}.app",
        icon=icon_file,
        bundle_identifier="com.scrivenlight.app",
        info_plist={
            "CFBundleName": APP_NAME,
            "CFBundleDisplayName": APP_NAME,
            "CFBundleShortVersionString": "1.0.0",
            "CFBundleVersion": "1.0.0",
            "NSHighResolutionCapable": True,
            "LSMinimumSystemVersion": "11.0",
            # register the .slt and .fountain document types
            "CFBundleDocumentTypes": [
                {
                    "CFBundleTypeName": "ScrivenLight Project",
                    "CFBundleTypeExtensions": ["slt"],
                    "CFBundleTypeRole": "Editor",
                    "LSHandlerRank": "Owner",
                },
                {
                    "CFBundleTypeName": "Fountain Screenplay",
                    "CFBundleTypeExtensions": ["fountain"],
                    "CFBundleTypeRole": "Editor",
                    "LSHandlerRank": "Alternate",
                },
            ],
        },
    )
