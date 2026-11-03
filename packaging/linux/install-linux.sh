#!/usr/bin/env bash
# Quick desktop integration script for Linux users running from archive
set -e

INSTALL_DIR="${HOME}/.local/share/ResearchLoom"
DESKTOP_DIR="${HOME}/.local/share/applications"
ICONS_DIR="${HOME}/.local/share/icons/hicolor/512x512/apps"

mkdir -p "${INSTALL_DIR}"
mkdir -p "${DESKTOP_DIR}"
mkdir -p "${ICONS_DIR}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Copy files
cp "${SCRIPT_DIR}/ResearchLoom-linux-x86_64" "${INSTALL_DIR}/ResearchLoom"
chmod +x "${INSTALL_DIR}/ResearchLoom"
cp "${SCRIPT_DIR}/icon.png" "${ICONS_DIR}/researchloom.png"

# Install desktop entry
cat << 'EOF' > "${DESKTOP_DIR}/com.sohamsans.researchloom.desktop"
[Desktop Entry]
Type=Application
Name=ResearchLoom
GenericName=Academic Research Workbench
Comment=Autonomous academic literature synthesis engine, flow canvas explorer, and local vault
Exec=sh -c '"$HOME/.local/share/ResearchLoom/ResearchLoom"' %F
Icon=researchloom
Terminal=false
Categories=Office;Science;Education;
MimeType=application/pdf;text/x-tex;
StartupWMClass=ResearchLoom (Samhita)
Keywords=Research;Literature;Review;Synthesis;Academic;Papers;arXiv;PDF;LaTeX;
EOF

chmod +x "${DESKTOP_DIR}/com.sohamsans.researchloom.desktop"

echo "ResearchLoom successfully installed to ~/.local/share/ResearchLoom!"
echo "You can launch it from your desktop applications menu."
