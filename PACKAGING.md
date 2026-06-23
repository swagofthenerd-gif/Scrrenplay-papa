# Packaging ScrivenLight for Windows & macOS

This folder contains everything needed to build native, distributable versions
of ScrivenLight. **Important:** PyInstaller does not cross-compile. You build the
Windows app **on Windows** and the macOS app **on a Mac**. The same project files
and `scrivenlight.spec` work on both — only the build command differs.

You do not need to write any code. Each platform has a one-command script.

---

## macOS (you can do this on your office Mac today)

**Requirements:** macOS 11+, Python 3.9 or newer (from <https://python.org> or
`brew install python`).

```bash
cd scrivenlight
bash build_macos.sh
```

When it finishes, open the `dist/` folder. You'll have three things:

| File | What it is |
|---|---|
| `ScrivenLight.app` | The app. Double-click to run. |
| `ScrivenLight-mac.dmg` | **Installable** disk image. Open it, drag the app to Applications. |
| `ScrivenLight-mac-portable.zip` | **Portable.** Unzip and run the `.app` from anywhere — a USB stick, Downloads, wherever. No install. |

**First launch (unsigned build):** macOS Gatekeeper will block an unsigned app
the first time. Right-click the app ▸ **Open** ▸ confirm. After that it opens
normally. This is expected for any app not signed with an Apple Developer ID —
see "Signing" below if you want to remove that step.

---

## Windows (run on a Windows 10/11 machine)

**Requirements:** Windows 10/11, Python 3.9+ from <https://python.org>
(check **"Add Python to PATH"** during install).

Double-click `build_windows.bat`, or from a terminal:

```bat
cd scrivenlight
build_windows.bat
```

In `dist\` you'll get:

| File | What it is |
|---|---|
| `ScrivenLight\` (folder) | **Portable.** Copy the whole folder anywhere and run `ScrivenLight.exe`. No install. |
| `ScrivenLight-win-portable.zip` | The portable folder, zipped for sharing. |

**For a real installer** (`ScrivenLight-Setup.exe` with Start Menu shortcut,
file associations, and an uninstaller): install **Inno Setup** (free) from
<https://jrsoftware.org/isdl.php>, then either re-run `build_windows.bat` (it
auto-detects Inno Setup) or run:

```bat
iscc installer_windows.iss
```

The installer appears in `Output\ScrivenLight-Setup.exe`.

**First launch (unsigned build):** Windows SmartScreen may show "Windows
protected your PC." Click **More info ▸ Run anyway**. This goes away once the app
is signed with a code-signing certificate (see below).

---

## What gets bundled

Both builds are fully self-contained. Your users do **not** need Python, PyQt6,
or reportlab installed — everything (the Python runtime, Qt, the PDF engine) is
packaged inside the app. The `scrivenlight.spec` already:

- includes reportlab's data files and lazily-imported submodules (so PDF export
  works in the frozen app),
- trims unused Qt modules (WebEngine, Multimedia, SQL, QML, …) to keep size down,
- sets the app icon per platform,
- registers `.slt` and `.fountain` as document types.

Approximate output size: ~120–180 MB per platform (Qt is large). That's normal
for a bundled Qt app.

---

## Icons

- `scrivenlight.ico` — Windows icon (multi-resolution), already generated.
- `scrivenlight_1024.png` — master icon. `build_macos.sh` turns this into
  `scrivenlight.icns` automatically using Apple's `iconutil`.

To change the icon, replace `scrivenlight_1024.png` with your own 1024×1024 PNG
and rebuild; regenerate the `.ico` with any icon tool or:
`python -c "from PIL import Image; Image.open('scrivenlight_1024.png').save('scrivenlight.ico', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])"`

---

## Signing & notarization (optional, for wide distribution)

The builds above work for yourself and your crew. If you want to distribute
without security warnings:

**macOS** — you need an Apple Developer account ($99/yr). After building:
```bash
codesign --deep --force --options runtime --sign "Developer ID Application: Your Name (TEAMID)" dist/ScrivenLight.app
xcrun notarytool submit dist/ScrivenLight-mac.dmg --apple-id you@email.com --team-id TEAMID --wait
xcrun stapler staple dist/ScrivenLight.app
```

**Windows** — you need a code-signing certificate (from a CA like DigiCert /
Sectigo, or an EV cert for instant SmartScreen trust):
```bat
signtool sign /fd SHA256 /a /tr http://timestamp.digicert.com /td SHA256 dist\ScrivenLight\ScrivenLight.exe
```

These are optional. Without them the app is identical in function; users just
do the one-time "open anyway" step described above.

---

## Troubleshooting

- **"PyQt6 failed to install"** — make sure you're on 64-bit Python 3.9–3.12.
  PyQt6 has no 32-bit wheels.
- **App launches then immediately quits** — run the executable from a terminal
  to see the error (`dist/ScrivenLight/ScrivenLight.exe` on Windows, or
  `dist/ScrivenLight.app/Contents/MacOS/ScrivenLight` on Mac). The most common
  cause is a missing hidden import; add it to `hidden = [...]` in the spec.
- **PDF export does nothing in the frozen app** — confirm reportlab installed in
  the build venv before PyInstaller ran; the spec collects its data files only
  if it's importable at build time.
