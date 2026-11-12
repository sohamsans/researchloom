# ResearchLoom (Samhita / संहिता)

**ResearchLoom** (also known as **Samhita** — from Sanskrit *संहिता*, meaning *"methodically gathered and joined together"*) is an autonomous academic literature synthesis engine, flow canvas explorer, and interactive research workbench. It discovers scientific literature across open academic indexes, deduplicates candidate records, executes a two-stage relevance triage and extraction pipeline, archives full-text PDFs into a private local document vault, and provides an interactive research assistant with KaTeX formula rendering and LaTeX manuscript authoring. Users can freely toggle their preferred workspace identity between **ResearchLoom** and **Samhita** anytime in the application profile settings.

---

## Live Walkthrough Demo

![ResearchLoom Feature Walkthrough](docs/demo/researchloom_demo.gif)

> A complete high-resolution MP4 video walkthrough is also available at [`docs/demo/researchloom_demo.mp4`](docs/demo/researchloom_demo.mp4).

---

## Screenshots & Visual Walkthrough

### 1. Literature Discovery & Candidate Search
![Literature Discovery Workbench](docs/screenshots/01_discover_workbench.png)

### 2. Scientific Formula Blocks & Model Chaining
![Scientific Formula Blocks](docs/screenshots/06_formula_blocks.png)

### 3. Systematic Review & PRISMA 2020 Screening
![PRISMA 2020 Screening Workflow](docs/screenshots/04_prisma_screening.png)

### 4. Interactive Data Sheets & Experiment Tables
![Research Data Sheets](docs/screenshots/07_data_sheets.png)

### 5. Writing Studio & Academic Manuscript Editor
![Academic Writing Studio](docs/screenshots/03_latex_studio.png)

---

## Architecture Overview

```
                                  [ User Query ]
                                         |
                                         v
   +--------------------------------------------------------------------------+
   |                       Academic Discovery Cascade                         |
   |   OpenAlex Polite Pool | arXiv API | Crossref | Europe PMC | DOAJ        |
   +--------------------------------------------------------------------------+
                                         |
                                         v
   +--------------------------------------------------------------------------+
   |                      Deduplication & Pre-Filtering                       |
   |              Normalized DOI matching & Alphanumeric Hashing              |
   +--------------------------------------------------------------------------+
                                         |
                                         v
   +--------------------------------------------------------------------------+
   |                      Two-Stage Synthesis Pipeline                        |
   |   Stage 1: Batch Abstract Triage (Relevance scoring 1-5 & rationale)     |
   |   Stage 2: Section Slicing & Deep Extraction (Problems, methods, gaps)   |
   +--------------------------------------------------------------------------+
                                         |
                    +--------------------+--------------------+
                    |                                         |
                    v                                         v
   +----------------------------------+     +----------------------------------+
   |      Local Document Vault        |     |     Interactive Chat Assistant   |
   |  In-app PDF retrieval & viewer   |     |  Grounded Q&A, KaTeX rendering,  |
   |  Saved to 'ResearchLoom Papers'  |     |  clickable citation pill badges  |
   +----------------------------------+     +----------------------------------+
```

---

## Features

- **Multi-Engine Academic Discovery**: Searches OpenAlex (100,000 requests/day polite pool), arXiv API, Crossref, Europe PMC, and DOAJ without requiring paid academic subscriptions.
- **Dual-Lineage Forward & Backward Citation Snowballing**: Recursively traverses works cited by any paper (predecessors in amber expanding leftward) and subsequent works citing the paper (successors in cyan expanding rightward) on an interactive 60 FPS canvas with guaranteed collision-free spatial layouts.
- **Evidence Matrix & Comparative Synthesis Drafter**: Multi-paper selection dock allowing researchers to draft structured cross-study syntheses across 4 analytical lenses (`contrastive`, `discrepancies`, `consensus`, `gaps`) with an anti-hallucination citation whitelist and 1-click injection into the Writing Studio.
- **Publication-Ready PRISMA 2020 Flow Diagram Exporter**: Generates vector SVG downloads, 300 DPI high-resolution journal PDFs, and 1-click Overleaf native LaTeX TikZ code utilizing official PRISMA colorways.
- **Automated BibTeX Sanitizer, Deduplicator & Key Formatter**: Standardizes keys into `[Author][Year][ShortTitle]` (e.g. `Vaswani2017Attention`), normalizes Latin diacritics, resolves key collisions with alphabetic suffixes, and applies parity-aware LaTeX escaping.
- **1-Click Zotero & Better BibTeX Collection Importer**: Drag-and-drop `.bib` and `.csl-json` vault ingestion with atomic duplicate merging and live Crossref DOI verification shields (🟢 Verified / 🟡 Unverified).
- **Multi-LLM Council Deliberation Engine**: Independent multi-model cross-examination across Groq, Gemini, Claude, and OpenAI with consensus scoring and disagreement breakdowns.
- **Academic Anti-Noise Filter**: Automatically detects and prunes journal covers, tables of contents, editorial boards, and website fragments before synthesis.
- **Loom Clipper & Google Scholar Companion**: Chrome browser extension providing 1-click literature clipping and live relevance check directly from Google Scholar search results.
- **Two-Stage LLM Evaluation**:
  - **Stage 1 (Batch Triage)**: Evaluates batches of candidate abstracts simultaneously using lightweight, fast models (Groq Llama 3.1 8B or Gemini Flash 8B).
  - **Stage 2 (Deep Extraction)**: Extracts core research questions, methodologies, empirical benchmarks, and research limitations into structured schemas.
- **Local Document Vault (`ResearchLoom Papers`)**: Downloads and caches full-text papers directly inside a local folder on your computer. Includes an inline in-app PDF reader.
- **Interactive Research Chatbot**: Context-grounded conversational interface for asking detailed questions across the synthesized paper collection, with dynamic KaTeX LaTeX rendering and clickable citation badges.
- **Bring Your Own Key (BYOK) Security**: API keys are encrypted locally using AES-256 via Fernet cryptography in SQLite. No keys are hardcoded or shared.

---

## Project Structure

```text
researchloom/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entrypoint and middleware configuration
│   │   ├── config.py            # Environment configuration and settings
│   │   ├── db/                  # SQLite schema and session lifecycle
│   │   ├── models/schemas.py    # Pydantic data models and validation contracts
│   │   ├── services/            # Snowballing, synthesis, citation sanitizer, vault
│   │   └── routers/             # API endpoints (snowball, matrix, references, council)
│   ├── requirements.txt         # Python dependencies
│   ├── Dockerfile               # Container build definition
│   └── litbuddy_app.py          # Native desktop application entrypoint (pywebview)
├── frontend/
│   ├── src/                     # React 18 + TypeScript user interface
│   │   ├── components/          # FlowMap, EvidenceMatrix, PRISMA, WritingStudio
│   │   ├── services/            # API client and client-side Excel exporters
│   │   └── types/               # TypeScript interfaces
│   ├── android/                 # Native Android Capacitor port with Stylus support
│   ├── package.json
│   └── vite.config.ts
├── packaging/
│   └── windows/installer.iss    # Inno Setup 6 modern installer script
├── litbuddy.spec                # PyInstaller specification for Windows
├── litbuddy_mac.spec            # PyInstaller specification for macOS (.app/.dmg)
├── litbuddy_linux.spec          # PyInstaller specification for Linux (.AppImage)
└── build_windows_exe.bat        # Automated Windows desktop build script
```

---

## Standalone Downloads & Multi-Platform Support

ResearchLoom (Samhita) is distributed as a lightweight, 100% offline-ready desktop and tablet application across all major platforms:

### Latest Release: [`v4.3.9`](https://github.com/sohamsans/researchloom/releases/tag/v4.3.9)

| Operating System | Package Format | Download Link | Features |
| :--- | :--- | :--- | :--- |
| **Windows 10/11 (64-bit)** | Inno Setup Installer (`.exe`) | [`ResearchLoom-Setup.exe`](https://github.com/sohamsans/researchloom/releases/download/v4.3.9/ResearchLoom-Setup.exe) | Desktop shortcuts, system tray auto-minimize, uninstaller |
| **Windows 10/11 (64-bit)** | Portable Standalone (`.exe`) | [`ResearchLoom.exe`](https://github.com/sohamsans/researchloom/releases/download/v4.3.9/ResearchLoom.exe) | Zero-installation, single portable binary |
| **Windows 10/11 (64-bit)** | ZIP Archive (`.zip`) | [`ResearchLoom-windows-x64.zip`](https://github.com/sohamsans/researchloom/releases/download/v4.3.9/ResearchLoom-windows-x64.zip) | Portable zipped bundle |
| **macOS (Apple Silicon M-Series)** | Native Disk Image (`.dmg`) | [`ResearchLoom-macOS-arm64.dmg`](https://github.com/sohamsans/researchloom/releases/download/v4.3.9/ResearchLoom-macOS-arm64.dmg) | Drag-and-drop to Applications folder |
| **Linux (x86_64)** | Universal AppImage (`.AppImage`) | [`ResearchLoom-linux-x86_64.AppImage`](https://github.com/sohamsans/researchloom/releases/download/v4.3.9/ResearchLoom-linux-x86_64.AppImage) | Single-file portable Linux binary (Ubuntu, Fedora, Arch) |
| **Linux (x86_64)** | Tarball Archive (`.tar.gz`) | [`ResearchLoom-linux-x86_64.tar.gz`](https://github.com/sohamsans/researchloom/releases/download/v4.3.9/ResearchLoom-linux-x86_64.tar.gz) | Complete Linux runtime archive |
| **Android Tablets** | Standalone APK (`.apk`) | [`ResearchLoom-android-tablet.apk`](https://github.com/sohamsans/researchloom/releases/download/v4.3.9/ResearchLoom-android-tablet.apk) | Samsung S-Pen & Xiaomi Smart Pen active stylus dynamics |

### Hardware Stylus & Tablet Features (Android)
- **Active Pressure Sensitivity**: Full hardware pressure dynamics (`0.0` - `1.0`) with S-Pen, Xiaomi Smart Pen, and USI active styluses.
- **Physical Barrel Button Integration**: Native hardware button event interception to cycle between Pen, Highlighter, Stroke Eraser, and Pixel Eraser without screen touch.
- **Palm Rejection**: Complete gesture rejection during pen tip contact.
- **Offline Device Storage**: 100% standalone offline literature discovery and local paper vault on tablet.

### Note on Unsigned App Prompts
Because ResearchLoom is a free non-commercial open-source research tool without expensive corporate code-signing certificates:
1. **Windows SmartScreen**: Click **More info** and select **Run anyway**.
2. **macOS Gatekeeper**: On first launch, if macOS displays an unidentified developer prompt, right-click (or Control-click) `ResearchLoom.app` and choose **Open**, then confirm.
3. **Linux**: Run `chmod +x ResearchLoom-linux-x86_64.AppImage` and launch.

---

## Academic Downloading & Polite Pool Advisory

ResearchLoom makes research collection straightforward by querying open academic indexes (OpenAlex, arXiv, Crossref, Europe PMC, Unpaywall, IPFS, Project Gutenberg, and decentralized mirrors). However, please note:

1. **Academic Publisher Paywalls & Captchas**: Major commercial publishers frequently update bot detection and paywalls. While ResearchLoom exhaustively rotates across mirrors, some closed-access or copyright-restricted papers cannot be retrieved automatically. In these instances, researchers can obtain the document through their university library proxy or preferred repository and drag/import the PDF directly into ResearchLoom's local vault.
2. **API Polite Pools & Rate Limits**:
   - Services like OpenAlex and Unpaywall provide generous free access through a Polite Pool when a contact email is attached.
   - ResearchLoom uses a generic local identifier (`autolit@research.local`) by default so your personal email is never distributed to other users.
   - If you run intensive queries or distribute ResearchLoom widely, each user can supply their own contact email in their environment or settings without rate limit conflicts.

---

## Bug Reports, Maintenance & Community Guidelines

We welcome your feedback, ideas, bug reports, and collaborations!

### Issue Resolution Expectations
As a student, ongoing coursework, lab assignments, and academic projects take up substantial time. However, I am committed to maintaining this project diligently:
- **Minor Bugs & Fixes**: Typically triaged and resolved within 2 to 3 days.
- **Major Features & Enhancements**: Significant capability additions will generally take between 7 to 14 days to design, implement, and verify.
- **Always Free Policy**: The promise of ResearchLoom being free is forever. Any proposed feature that requires recurring subscriptions, paid backend servers, or would prevent the software from remaining 100% free and open will have to be skipped over.
- **Continuous Updates**: As I use ResearchLoom daily for my own research work, I will routinely publish refinements, mirror improvements, and workflow updates.

I hope this tool makes your research journey smoother and more productive. Suggestions, contributions, and academic collaborations are warmly welcomed.

*Your fellow researcher,*  
**sohamsans**

### How to Report an Issue
If you encounter any issues, layout quirks, or unexpected behavior:
1. Navigate to the **[GitHub Issues](https://github.com/sohamsans/researchloom/issues)** page.
2. Click **New Issue**.
3. **Attach screenshots** of the application window or affected views (Flow Maps, Writing Studio, Reference Manager, etc.).
4. Describe your operating environment, what you were trying to accomplish, and what occurred.
5. You can also click the **"Report Issue"** or **"GitHub"** buttons directly inside ResearchLoom's header bar or sidebar dock to jump to the issue tracker.

---

## Running Locally

### Option 1: Standalone Windows Application (`ResearchLoom.exe`)

You can run ResearchLoom as a native desktop application without installing Python or Node.js.

1. Compile the executable using the provided build script:
   ```cmd
   build_windows_exe.bat
   ```
2. The compiled binary will be placed at `dist/ResearchLoom.exe`.
3. Launch `ResearchLoom.exe`. It boots the local backend service and opens a dedicated native desktop window.
4. Downloaded papers are automatically saved to `ResearchLoom Papers/` in the same directory.

---

### Option 2: Running from Source

#### Prerequisites
- Python 3.11 or 3.12
- Node.js 18+ and npm

#### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv

# On Windows:
.\.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
uvicorn app.main:app --reload --port 8000
```

The API service runs at `http://127.0.0.1:8000`. OpenAPI documentation is available at `http://127.0.0.1:8000/docs`.

#### 2. Frontend Setup

In a separate terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Configuration

Copy `.env.example` in the `backend/` directory if you wish to configure default server settings:

```ini
DATABASE_URL=sqlite+aiosqlite:///./autolit.db
OPENALEX_EMAIL=your-email@example.com
RESEARCHLOOM_VAULT_DIR=./ResearchLoom Papers
```

API keys for LLM providers (Groq, Google Gemini, OpenRouter) can be entered directly in the application settings dialog upon startup. Keys are stored locally in an encrypted database.

---

## License & Non-Commercial Copyleft Terms

ResearchLoom (Samhita) is licensed under the **[PolyForm Noncommercial License 1.0.0](LICENSE)**.

- **Non-Commercial Only**: You are free to inspect, run, modify, and distribute this software for personal, academic, educational, and research purposes.
- **Commercial Exploitation Strictly Prohibited**: Any use, sale, paid licensing, commercial subscription bundling, SaaS hosting for profit, or commercial closed-sourcing of this software is strictly unlawful and forbidden.
- **Perpetual Open-Source**: All derivative works, modifications, and forks must remain public and open-source under the exact same non-commercial terms.

See [`LICENSE`](LICENSE) for full legal text and conditions.
