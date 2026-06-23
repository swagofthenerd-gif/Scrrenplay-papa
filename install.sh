#!/usr/bin/env bash
# ScrivenLight installer for Fedora 44.
# Installs into ~/.local (no root required) and registers the app menu entry.
set -euo pipefail

APP_ID="scrivenlight"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREFIX="${HOME}/.local"
LIB_DIR="${PREFIX}/lib/${APP_ID}"
BIN_DIR="${PREFIX}/bin"
DESKTOP_DIR="${PREFIX}/share/applications"
ICON_DIR="${PREFIX}/share/icons/hicolor/scalable/apps"

echo "==> Installing system dependency (PyQt6) via dnf if missing…"
if ! python3 -c "import PyQt6" 2>/dev/null; then
  if command -v dnf >/dev/null; then
    sudo dnf install -y python3-pyqt6 || {
      echo "dnf install failed; falling back to pip --user"
      python3 -m pip install --user PyQt6
    }
  else
    python3 -m pip install --user PyQt6
  fi
fi

echo "==> Installing reportlab (for PDF export) if missing…"
if ! python3 -c "import reportlab" 2>/dev/null; then
  if command -v dnf >/dev/null; then
    sudo dnf install -y python3-reportlab || python3 -m pip install --user reportlab
  else
    python3 -m pip install --user reportlab
  fi
fi

echo "==> Copying application files to ${LIB_DIR}"
rm -rf "${LIB_DIR}"
mkdir -p "${LIB_DIR}"
cp -r "${SRC_DIR}/scrivenlight" "${LIB_DIR}/"
cp "${SRC_DIR}/main.py" "${LIB_DIR}/"

echo "==> Creating launcher at ${BIN_DIR}/${APP_ID}"
mkdir -p "${BIN_DIR}"
cat > "${BIN_DIR}/${APP_ID}" <<EOF
#!/usr/bin/env bash
exec python3 "${LIB_DIR}/main.py" "\$@"
EOF
chmod +x "${BIN_DIR}/${APP_ID}"

echo "==> Installing icon and desktop entry"
mkdir -p "${ICON_DIR}" "${DESKTOP_DIR}"
cp "${SRC_DIR}/${APP_ID}.svg" "${ICON_DIR}/${APP_ID}.svg"
cp "${SRC_DIR}/${APP_ID}.desktop" "${DESKTOP_DIR}/${APP_ID}.desktop"

update-desktop-database "${DESKTOP_DIR}" 2>/dev/null || true
gtk-update-icon-cache "${PREFIX}/share/icons/hicolor" 2>/dev/null || true

echo ""
echo "✓ ScrivenLight installed."
echo "  Launch from your app menu, or run:  ${APP_ID}"
echo "  (Ensure ${BIN_DIR} is on your PATH.)"
