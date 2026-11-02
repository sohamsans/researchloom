# Getting Started & Installation Guide

ResearchLoom is distributed across multiple platforms: standalone Android APK, desktop binaries (Windows & macOS), and local development environments.

---

## 📱 Android Tablet Installation (Xiaomi Pad 7, Galaxy Tab, Pixel Tablet)

1. Download the latest `ResearchLoom-android-tablet.apk` from [Releases](https://github.com/sohamsans/researchloom/releases/latest).
2. On your tablet, enable **Install unknown apps** for your browser or file manager in Android Settings.
3. Tap the downloaded APK to install.
4. **Seamless Upgrades**: When a new version is released, install the updated APK directly over the existing app. Because the release keystore signature is permanent and `android:hasFragileUserData="true"` is enabled, your research papers, notes, and local settings are preserved automatically without uninstalling.

---

## 💻 Standalone Desktop (Windows & macOS)

### Windows
1. Download `ResearchLoom.exe` or `ResearchLoom-windows-x64.zip`.
2. Extract and run `ResearchLoom.exe`.
3. Standalone mode automatically boots the local FastAPI backend and SQLite database under `%APPDATA%\ResearchLoom`.

### macOS (Apple Silicon M1/M2/M3)
1. Download `ResearchLoom-macOS-arm64.dmg`.
2. Drag `ResearchLoom.app` into your Applications folder.

---

## 🛠️ Local Development & Source Setup

### Prerequisites
- Node.js 20+
- Python 3.12+
- Git

### Steps
```bash
# 1. Clone repository
git clone https://github.com/sohamsans/researchloom.git
cd researchloom

# 2. Setup backend
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 3. Setup frontend (in a separate terminal)
cd ../frontend
npm install
npm run dev
```
Navigate to `http://localhost:5173` in your browser.
