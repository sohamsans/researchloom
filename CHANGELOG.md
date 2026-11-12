# Changelog

All notable changes, bug fixes, and architectural enhancements to ResearchLoom (Samhita) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v4.3.9] - 2026-11-12

### Fixed & Enhanced
- **Cross-Feature Interaction & Adversarial 5-Critic Remediation**:
  - **F1: Literature Discovery & Screening**:
    - Eliminated PRISMA statistics double-counting on repeated screening updates via descending audit deduplication by `paper_id`.
    - Resolved silent preprint dropouts on arXiv requests by switching to HTTPS and enabling `follow_redirects=True`.
    - Implemented monotonic field-level metadata coalescing to prevent verified DOIs and PDFs from being overwritten.
    - Added terminal state handling in screening triage hotkey loop when reaching the final candidate paper.
  - **F2: Flow Map Canvas Studio**:
    - Centralized all network requests using `getApiBase()`, `getAuthHeader()`, and `safeFetchJson`, enabling seamless operation on Android tablets and remote desktop servers.
    - Implemented immutable shallow-cloned nodes in topological DAG auto-layout.
    - Added maximum out-degree cycle-peeling to prevent infinite layout loops or collapse on cyclic citation graphs.
    - Added multi-canvas `localStorage` persistence fallback for offline operation.
  - **F3: Evidence Matrix Studio**:
    - Added `abstract` fallback context in cell extraction and registered `/api/matrix/cell/extract` route alias.
    - Added token short-circuiting for human-verified cells (`is_human_edited == True`) to preserve researcher inputs and prevent unnecessary LLM API calls.
    - Enforced a 15-paper row selection guard keeping comparative synthesis prompts within Groq free-tier token limits ($\approx 5,024$ tokens vs 6,000 TPM limit).
    - Aligned offline citation keys to author surname conventions (`Vaswani2017`).
  - **F4: Master Reference Manager**:
    - Implemented balance-aware BibTeX tokenizer handling curly brace depth, quoted values, escaped characters (`\{`, `\}`), and unquoted numeric years/volumes (`year = 2024`), fixing invalid `Nd` citation keys and truncated titles.
    - Added client-side keyword and publication year filtering to offline Reference Manager.
  - **F5: Standalone Sync & Storage**:
    - Configured SQLite connection listener with `PRAGMA journal_mode=WAL;` and `PRAGMA busy_timeout=10000;`, eliminating concurrency lock collisions.
    - Implemented atomic SQLite persistence for `/api/sync/push` and `/api/sync/eod/commit` with intra-batch citation key collision disambiguation (`_1`, `_2`) and visual stylus drawing notes.
    - Exported `gatherEodCommitPayload()` to sync real references and notes from local browser storage.
  - **F6: Composition Studios**:
    - Added display math regex `/^\s*(\\begin\{(equation|align|gather|multline|flalign)\*?\}|\\\[|\$\$)/` in Writing Studio to eliminate duplicate nested `\begin{equation}` environments.
    - Added dedicated stylus note routing and "To Studio" action button in Stylus Studio.
    - Fixed DataSheet LaTeX table exporter type coercion for numbers and added comprehensive escaping (`\%`, `\_`, `\&`, `\#`, `\$`, `\^`, `\~`).
  - **F7: Web Clipper & Council**:
    - Authored in-app `WebClipperModal.tsx` styled with anti-slop dark zinc design tokens, connected to `/api/clipper/ingest` with offline fallback.
    - Forwarded user queries directly to `MultiLLMCouncilService.deliberate(...)`.

---

## [v4.3.8] - 2026-11-07

### Added
- **Top 5 Community Research Features**:
  1. **Dual-Lineage Forward & Backward Citation Snowballing (`snowball_service.py` & `FlowMapCanvas.tsx`)**:
     - Recursive OpenAlex polite pool citation traversal resolving predecessor roots (works cited by seed) and successor branches (works citing seed).
     - Interactive dual lineage layout in `FlowMapCanvas`: predecessors expand leftward in amber tones (`#arrowhead-amber`), successors expand rightward in cyan tones (`#arrowhead-cyan`).
     - Spatial collision prevention with 152px horizontal clearance guaranteeing seed paper and hub folders are never occluded.
  2. **Evidence Matrix Comparative Synthesis Drafter (`matrix_synthesis_service.py` & `EvidenceMatrixStudio.tsx`)**:
     - Dynamic multi-row paper selection with 4 analytical lenses: `contrastive` (head-to-head methodology comparison), `discrepancies` (conflicting empirical findings), `consensus` (shared theoretical baselines), and `gaps` (underexplored research vectors).
     - Strict character budgeting: dynamic per-paper ceiling $\lfloor 9,500 / N \rfloor \le 12,000$ characters total payload respecting lightweight cloud models.
     - Whitelist verification firewall ensuring every `\cite{AuthorYear}` matches loaded papers.
     - 1-click injection directly into `WritingStudio` inserting synthesized LaTeX subsections and BibTeX entries before `\end{document}`.
  3. **Publication-Ready PRISMA 2020 Flow Diagram Exporter (`PRISMAFlowDiagram.tsx`)**:
     - Vector SVG export via direct DOM `XMLSerializer` blob download.
     - High-resolution 300 DPI publication PDF export rasterized via HTML5 canvas.
     - 1-click Overleaf native LaTeX TikZ code generator producing standalone compilable `.tex` diagram files.
  4. **Automated BibTeX Sanitizer, Deduplicator & Key Formatter (`bulk_download_service.py`)**:
     - Standardized citation key generation: `[FirstAuthorLastName][Year][FirstMeaningfulTitleWord]` (e.g., `Vaswani2017Attention`).
     - Latin diacritics transliteration (`Ł` $\to$ `L`, `Ø` $\to$ `O`, `ß` $\to$ `ss`).
     - Key collision cascade with alphabetic suffix disambiguation (`a`–`z`, `aa`–`zz`).
     - Parity-aware negative lookbehind LaTeX escaping (`(?<!\\)((?:\\\\)*)(&)` $\to$ `\1\\&`) and inline math block protection (`(\$(?:\\\$|[^$])+\$)`).
  5. **1-Click Zotero & Better BibTeX Collection Importer (`reference_ingestion_service.py` & `MasterReferenceManager.tsx`)**:
     - Drag-and-drop `.bib` and `.csl-json` dropzone with atomic duplicate merging by DOI and key collision disambiguation.
     - Crossref validation shields: 🟢 Verified (metadata confirmed with DOI resolver), 🟡 Unverified with 1-click live Crossref lookup under `asyncio.Semaphore(5)` rate limiting.
     - Upgraded Master Reference Manager to anti-slop dark zinc aesthetic (`bg-zinc-950`, `border-zinc-800`).

---

## [v4.3.7] - 2026-11-05

### Added
- **Multi-LLM Council Deliberation Engine**:
  - Independent multi-model cross-examination across Groq, Gemini, Anthropic Claude, and OpenAI GPT models with consensus voting.
- **Academic Anti-Noise Filter**:
  - Automatically identifies and filters out journal cover pages, tables of contents, editorials, and website snippets before LLM ingestion.
- **Loom Clipper & Google Scholar Ingestion**:
  - Companion browser extension allowing 1-click clipping and live relevance checking directly on Google Scholar search results.
- **P2P Local Sync & Vault Encryption**:
  - LAN-based peer discovery with AES-256 Fernet encrypted paper payloads.

---

## [v4.3.5] - 2026-11-03

### Added
- **Visual Identity Separation (Writing Studio vs Stylus Studio)**:
  - Updated Writing Studio navigation across sidebars and headers to use the dedicated document authoring icon (`FileEdit`). Stylus Studio cleanly retains the precision pen icon (`PenTool`).
- **Touch & Tablet Multi-Touch Support in Flow Maps (`FlowMapCanvas.tsx`)**:
  - Migrated node card dragging (Papers, Folders, Sticky Notes) and canvas panning to W3C Pointer Events (`onPointerDown`, `setPointerCapture`, `touch-none`).
  - Added native multi-touch 2-finger pinch-to-zoom and canvas panning on tablets without drag cancellation or gesture conflicts.
- **Stylus Engine Smoothing & Geometric Shape Auto-Snap (`StylusStudio.tsx`)**:
  - **Catmull-Rom Smoothing**: Vector paths smoothed through multi-point bezier curves, eliminating digitizer noise.
  - **Geometric Shape Recognition**: Toggleable "Snap" feature recognizing hand-drawn circles, ellipses, rectangles, triangles, and straight lines via isoperimetric quotient and corner detection.
  - **Hardware Button Tool Cycling**: Single-clicking physical stylus barrel buttons (Xiaomi Smart Pen, S-Pen) sequentially cycles tools (`Pen` $\to$ `Highlighter` $\to$ `Stroke Eraser` $\to$ `Pixel Eraser` $\to$ `Pen`).
- **OEM Shortcut Neutralization in `MainActivity.java`**:
  - Intercepted and consumed Xiaomi HyperOS / MIUI stylus button signals (`KEYCODE_PAGE_UP`, `KEYCODE_PAGE_DOWN`, `BUTTON_STYLUS_PRIMARY`, `BUTTON_STYLUS_SECONDARY`), preventing unwanted launches of Xiaomi Notes or the partial screenshot editor while sketching in ResearchLoom. Standard system 3-finger swipe screenshots remain intact.
- **Permanent Keystore & In-Place APK Upgrades**:
  - Added dedicated `researchloom-release.keystore` signing configuration for both `debug` and `release` Gradle builds with V1 + V2 signing enabled, preventing `INSTALL_FAILED_UPDATE_INCOMPATIBLE` signature mismatch errors when updating APKs.
  - Added `android:hasFragileUserData="true"` in `AndroidManifest.xml` to prompt users to retain local databases and paper vaults upon uninstallation.
  - Upgraded Android adaptive launcher icons with ResearchLoom's signature Obsidian Silver architectural book folio.

---

## [v4.3.4] - 2026-11-02

### Added
- **Dual Eraser Engine (Stroke Eraser & Pixel Eraser)**:
  - **Stroke Eraser**: High-precision vector line intersection calculation via segment distance algorithms (`distToSegment`), allowing researchers to delete entire intersected strokes in one touch.
  - **Pixel Eraser**: Raster canvas erasure using `destination-out` composite operation, enabling pixel-perfect partial erasing and fine-tuned formula cleanup.
  - Interactive eraser menu with live mode switching and status notifications.
- **Xiaomi Smart Pen & Native Stylus Hardware Button Scheme**:
  - Full support for Xiaomi Smart Pen 2 and Focus Pen (Xiaomi Pad 7 / Pad 6 series) proprietary hardware button schemes:
    - Native `dispatchKeyEvent` interception in `MainActivity.java` capturing `KEYCODE_PAGE_UP` (92) and `KEYCODE_PAGE_DOWN` (93), bridging directly to web canvas without scrolling interference.
    - Native `dispatchGenericMotionEvent` capturing `BUTTON_STYLUS_PRIMARY` and `BUTTON_STYLUS_SECONDARY` events.
    - Global web bridge (`window.handleStylusButton` and `xiaomi_stylus_button` custom event) seamlessly toggling eraser or switching eraser modes.
    - Physical barrel button hold detection (`e.button === 2 || e.buttons & 2`) for temporary eraser activation while sketching.
- **Dynamic Responsive Scaling Across All Tablet Form Factors & Orientations**:
  - Responsive layout scaling supporting Xiaomi Pad 7 (3:2 aspect ratio, 2880×1800), Samsung Galaxy Tab (16:10), and iPad (4:3) in both landscape and portrait orientations.
  - Fixed horizontal UI header and toolbar clipping:
    - Auto-collapses sidebar on viewports `< 1280px` (with persistent quick-toggle button in the header).
    - Reduced sidebar margin from fixed `ml-16` to `ml-0` on mobile/tablets when collapsed, preventing canvas clipping.
    - Made header and stylus toolbars fully flexible and responsive with prioritized breakpoints.

---

## [v4.3.3] - 2026-11-02

### Added
- **Dedicated Standalone Android Tablet Port**:
  - Independent runtime capability for Android tablets (Samsung Galaxy Tab, Google Pixel Tablet, Lenovo Tab) operating 100% autonomously without desktop connection.
  - Client-side academic discovery engine (`standaloneClient.ts`) querying OpenAlex Polite Pool and arXiv search APIs directly from device.
  - Direct client BYOK LLM synthesis pipeline (Groq `llama-3.1-8b-instant`, Google Gemini `gemini-1.5-flash`, and OpenRouter) with client-side deduplication.
- **Native Stylus Studio & Mathematical Scratchpad (`StylusStudio.tsx`)**:
  - Primary navigation workspace with full W3C Pointer Events Level 3 tracking and sub-millisecond drawing latency.
  - Dynamic hardware pressure curve modulation: $\text{lineWidth} = \text{baseSize} \times (0.35 + 1.65 \times \text{pressure})$.
  - Strict palm rejection ignoring touch inputs during active pen contact or hover.
  - S-Pen hardware side-button auto-eraser toggle (`e.buttons === 32`).
  - Direct workflow exports to Interactive Flow Maps and LaTeX Studio.
- **Multi-Platform CI/CD Automated Releases**:
  - GitHub Actions automated matrix building and attaching `ResearchLoom-android-tablet.apk`, `ResearchLoom-macOS-arm64.dmg`, and `ResearchLoom.exe`.

### Changed
- Refactored desktop navigation header to eliminate companion bridge popups, maintaining a clean, distraction-free desktop environment.

---

## [v4.3.2] - 2026-11-02

### Added
- **Automated Multi-Platform Release Pipeline**:
  - Cross-platform release packaging for Windows (`.exe` standalone portable and `.zip` archive) and macOS (`.dmg` drag-and-drop installer for Apple Silicon).
  - Automated GitHub Actions tagging release distribution.
- **Hardware Stylus Integration**:
  - Tablet screen declarations (`largeScreens="true"`, `xlargeScreens="true"`) and multitouch hardware declarations in Android manifest.

### Changed
- Polished desktop header controls by removing experimental wireless tablet bridge buttons.

---

## [v4.3.1] - 2026-11-01

### Fixed
- **Screening & Review Matrix API Router Normalization**:
  - Resolved `HTTP 405 Method Not Allowed` on `/api/screening/decision` and `HTTP 404 Not Found` on `/api/matrix/workspace` caused by inconsistent route prefixing (`/screening` and `/matrix` vs `/api/screening` and `/api/matrix`).
  - Added full test coverage verifying live endpoint status returns `200 OK`.
- **Systematic Screening Decisions & Audit Log**:
  - Fixed database schema integration for `screening_audit_log` so include, exclude, and maybe decisions persist with timestamp, criteria justification, and reviewer provenance.
- **Evidence Matrix AI Extraction**:
  - Connected `useAuth()` runtime keys to `EvidenceMatrixStudio.tsx`, allowing cell extractions to execute seamlessly across configured BYOK providers (Groq, Gemini) with fallback to manual editing.
- **UI Clipping & Header Element Overlap**:
  - Resolved layout collision between header action items and the literature sources sidebar.
  - Implemented responsive breakpoints for header controls with container truncation on medium widths and reserved margin padding (`mr-80 md:mr-96`) for the center stage when sidebars are open.
- **Flow Map Jitter & Dragging Reflows**:
  - Eliminated CSS transitions triggering layout reflows on `.antigravity-card` during active drag operations.
  - Decoupled single-click drag from selection state so moving cards and notes is fluid and 60 FPS.
  - Restricted paper detail drawer opening strictly to double-click events.
- **Elimination of Native Browser Dialogs**:
  - Replaced raw browser `alert()`, `confirm()`, and `prompt()` popups across Flow Maps, LaTeX Studio, Formula Blocks, Literature Table, and Matrix Studio with accessible, dark-themed `NativeDialogContext` modals and toast notifications supporting keyboard shortcuts (`Escape` to cancel, `Enter` to confirm).
- **Data Sheets Column Deletion**:
  - Added interactive column deletion with confirmation modals in `DataSheetStudio.tsx`, allowing users to delete unwanted columns along with their associated cell values.

---

## [v4.3.0] - 2026-11-01

### Added
- **Guided Research Objective Synthesis Workflow**:
  - Implemented an objective alignment step before multi-topic candidate synthesis. When pooling multiple diverse queries (e.g. *rocket engine modeling*, *solid rocket motors*, *supercavitation*, *underwater ramjets*), unrelated papers in peripheral domains are filtered out based on the user's explicit research goal or overarching inquiry.
  - Added `SynthesisObjectiveModal.tsx` triggering from the candidate preview table upon clicking "Synthesize Selected". Surfaces active pooled queries, provides a prompt area for custom objective input, and generates dynamic 1-click suggested focus anchors derived from the search topics.
  - Supports bypass via "Standard Synthesis" for users who prefer unguided broad screening.
  - Backend schema extended with `research_goal: Optional[str] = None` in `SelectedPipelineRequest`.
  - Updated LLM Stage 1 batch triage to evaluate candidate relevance strictly against the research objective when provided, scoring off-target matches 1-2.
  - Stage 2 deep extraction contextualizes `core_problem` and `critical_remarks` through the lens of the research goal.

---

## [v4.2.0-beta.3] - 2026-10-13

### Fixed
- **BUG-121 (Sidebar Chat Fragmentation — Persistent Session ID)**:
  - Root cause: `activeSessionId` was initialized as `session_${Date.now()}` in React `useState` but never persisted to localStorage. Every page refresh generated a new session ID, causing `recordSearchHistory` to treat each refresh as a new notebook, creating one sidebar entry per page load.
  - Fix: `useState` initializer now reads `rl_active_session_id` from localStorage on mount and returns the stored ID if present. Writes back to localStorage on first creation. `resetToNewReview` generates a fresh session ID, persists it, AND removes the old `litbuddy_active_session` key. Consecutive searches within the same session now reliably update the same sidebar entry.

- **BUG-122 (Vault DB Count Discrepancy — Silent IntegrityError on Duplicate Paper)**:
  - Root cause: `fetch_and_vault_paper` called `session.add(vault_entry)` then caught `IntegrityError` silently when a paper with the same `vault_id` already existed. 700 papers on disk had 0 DB records because they were all re-downloads of previously cached entries.
  - Fix: switched to explicit `session.get(PaperDocumentVault, vault_id)` upsert pattern — if the record exists, update `file_path`, `file_size_bytes`, `file_sha256`, `source_resolved`, and increment `download_count`; if not, insert fresh. No `IntegrityError` possible.

- **BUG-123 (Triage Slowness on Large Pools — Sequential Chunk Processing)**:
  - Root cause: `batch_triage` processed 64 sequential LLM API calls (chunk_size=12 on 774 papers) — each call waited for the prior to finish. Total triage time: 2-3 minutes.
  - Fix: refactored `batch_triage` to build all chunks upfront, then run concurrently with `asyncio.Semaphore(4)` — 4 chunks at a time. ~4x reduction in wall-clock triage time for large pools (from ~3 min to ~45s).

- **BUG-124 (Vault Disk/DB Reconciliation — No Recovery Path for Existing Downloads)**:
  - Added `POST /api/vault/sync-disk` backend endpoint: scans `LitBuddy Papers/` directory for all PDFs, skips tiny/corrupted files (<10 KB), matches against existing DB records by file_path and vault_id prefix, and creates missing vault DB entries for any unregistered PDFs. Returns a full report with counts.
  - Added "Sync Vault" button in the Downloads Manager UI (`DownloadManagerView.tsx`) that calls this endpoint, surfaces the result in the action notice, and refreshes the list. Allows one-click reconciliation after bulk downloads.

- **BUG-125 (Frontend Chat Duplication & Multi-Query History Preservation)**:
  - `Sidebar.tsx`: Added dual-layer deduplication in `refreshSearches` comparing both normalized topic keys and query hashes when merging backend DiscoveryCache with local storage, eliminating ghost/duplicate chats.
  - `App.tsx`: Preserved and restored the full multi-query history array (`parsed.queries`) when selecting previous notebooks from the sidebar, keeping query tags interactive.

- **BUG-126 (README LaTeX Math Parsing Corruption)**:
  - Escaped unescaped dollar signs in `README.md` (`\$300-\$500/year`), preventing markdown renderers from mistakenly parsing standard prose as inline LaTeX math blocks.

---

## [v4.2.0-beta.2] - 2026-10-13

### Fixed
- **BUG-119 (Candidate Pool Under-Synthesis Cap Removal & Unified Multi-Topic Synthesis)**:
  - Eliminated hardcoded 6-paper cap in `pipeline.py` (`len(filtered) >= 6: break`) that artificially truncated large candidate pools (e.g. 774 papers down to 6).
  - Added user-configurable `max_synthesis_count` (up to 100 deep-extracted papers with bounded 14s timeouts) with high-speed structured abstract synthesis for remaining candidates so no selected paper is discarded.
  - Constructed unified composite topic (`queryHistory.join('; ')`) for synthesis, ensuring multi-topic pooled literature reviews synthesize the entire domain scope rather than only the last entered topic.
  - Resolved sidebar chat fragmentation by anchoring searches under persistent `activeSessionId`, updating the project's topic title across consecutive searches without spawning duplicate notebook chats.

- **BUG-120 (Large Pool Bulk Download Chunking & Non-Blocking Safe Zipping)**:
  - Fixed infinite loading hang when downloading large pools (50-700+ papers) by introducing safe chunking (batches of 50 papers) in `CandidatePreviewTable.tsx`.
  - Added batch selector dropdown (`All in chunks`, `Batch 1-50`, `Batch 51-100`, etc.) and real-time visual progress counter (`Zipping X/Y...`) preventing browser connection drops and HTTP timeout crashes.
  - Updated ZIP download archive naming to `researchloom_collection_{count}_papers.zip`.
- **BUG-116 (Gemini and Groq 404 Model Deprecation & Transparent Copilot Diagnostics)**:
  - Migrated obsolete hardcoded Google Gemini endpoints to official `gemini-3.8-flash` (with automated normalization handling legacy `2.0-flash` and `2.5-flash` requests).
  - Migrated obsolete Groq model `llama-3.1-8b-instant` (HTTP 404 `model_not_found`) to Groq's high-speed cloud model `llama-3.3-70b-versatile`.
  - Replaced legacy LitBuddy brand strings with ResearchLoom (Samhita) Copilot in all greetings, prompts, and storage keys.
  - Replaced misleading canned Copilot fallback with genuine error diagnostics surfacing authentic API responses (e.g. quota limits, invalid keys, rate limits).
  - Added `<ModelSwitcherPill />` directly in the Copilot chat drawer header for 1-click model provider changes.

- **BUG-117 (Multi-Query Iterative Candidate Pooling & Deduplication)**:
  - Implemented iterative candidate pooling in `App.tsx` allowing researchers to execute 5-10 distinct keyword queries within the same project.
  - Candidate literature now accumulates into a unified, deduplicated pool matching normalized DOIs and alphanumeric title fingerprints.
  - Added multi-query tag strip in `CandidatePreviewTable.tsx` displaying individual query chips with single-click query deletion and pool resetting.
  - Enabled single-click "Synthesize Selected" on the combined candidate pool across all queried topics.

- **BUG-118 (Bulk PDF Download Failure & Sci-Hub Resolver Syntax Error)**:
  - Fixed syntax error in `scihub_resolver.py` line 29 (`unexpected character after line continuation character`) that broke runtime dynamic import of paper resolvers during `fetch_and_vault_paper()`.
  - Fixed issue where bulk download ZIP bundles contained 0 PDFs (`Successfully Vaulted: 0`).
  - Updated bulk ZIP archive `README.txt` and `manifest.json` branding from LitBuddy to ResearchLoom (Samhita).

---

## [v4.2.0-beta.1] - 2026-10-10

### Fixed
- **BUG-115 (Persistent Chat & Model Switcher Unification)**:
  - Fixed offline desktop token (`offline_desktop_token`) rejection in `/api/auth/history` by auto-provisioning local SQLite user `offline_user`.
  - Added immediate conversation sync upon chat start and synthesis load so chats are persisted before the first user question is sent.
  - Replaced duplicate Paper Chat model picker with `<ModelSwitcherPill />` directly in the chat context bar with real-time key status.
  - Added per-topic candidate discovery persistence (`litbuddy_saved_discovery_*`) enabling instant 0ms restoration of discovered paper matrices.
  - Auto-switches active LLM provider immediately whenever a new API key is configured or updated in BYOK settings.
- **BUG-114 (Universal LLM & Gemini Q&A Fallback)**:
  - Fixed issue where selecting Google Gemini in BYOK or Model Switcher returned `"No active AI model configured or daily quota exceeded"` despite active green key pill.
  - Corrected legacy/deprecated model strings (`gemini-3.5-flash-lite` -> official current `gemini-2.0-flash` & `gemini-1.5-flash`).
  - Removed strict forced `response_mime_type="application/json"` on freeform conversational Q&A to prevent Google Generative Language schema rejection errors.
  - Hardened failover cascade to only query providers with non-empty configured keys, preserving authentic error reporting rather than masking genuine API feedback.
- **BUG-113 (Cross-View Citation & Formula Insertion)**:
  - Resolved discarded citation and formula payloads when switching between Flow Maps, Reference Manager, and Writing Studio.
- **BUG-112 (Flow Maps Details Drawer Click Events)**:
  - Fixed click bubbling in Flow Maps details drawer that unmounted the side panel before citation or link actions could execute.
- **BUG-111 (Iframe / Webview Nested Scroll Layout)**:
  - Eliminated nested scrollbars in candidate paper preview tables by converting to full-bleed desktop workbench layouts.
- **BUG-110 (Word Document Writing Experience)**:
  - Upgraded Note editor to a full-featured WYSIWYG document editor with centered A4 page formatting and formatting ribbon.
- **BUG-109 (Writing Studio Citations)**:
  - Aggregated SQLite Master Reference Vault (`/api/references/all`) so all downloaded, pooled, and synthesized literature can be cited.
- **BUG-108 (Desktop Cross-Device Account Verification)**:
  - Added cloud authentication probe fallback, local password auto-verification, and deterministic SQLite DB path resolution in standalone desktop executables.
- **BUG-107 (Sidebar Topic Replay Discarding Synthesis)**:
  - Restored 0ms cached synthesis loading upon selecting past notebooks in sidebar history without triggering redundant candidate re-discovery.
- **BUG-106 (Auth & OTP Identifier Resolution)**:
  - Enabled verification by either email or username in `/api/auth/verify-code` and `/api/auth/resend-code`.
- **BUG-105 (Bulk ZIP Timeout on Web Deployments)**:
  - Bounded 6-worker concurrent downloads by an 18-second deadline to eliminate 504 Gateway Timeouts on Netlify and Render proxies.
- **BUG-104 & BUG-103 (PDF Browser Downloads)**:
  - Corrected action mismatch where server batch vaulting did not trigger browser-side file downloads.
- **BUG-102 & BUG-101 (Active Session & Chat Persistence)**:
  - Fixed state wipe on browser refresh (F5) by committing active sessions and conversational turns to `localStorage` and SQLite history.

### Added
- **Dual Workspace Identity**:
  - Full support for dual branding: **ResearchLoom** and **Samhita (संहिता)**, selectable in profile settings.
- **Universal Model Switcher Pill**:
  - Interactive top-header and in-chat dropdown with live key status indicators for Google Gemini Flash, Groq Cloud, OpenRouter Free, DeepSeek, and NVIDIA NIM.
- **Automated BYOK Provider Switching**:
  - Automatically activates newly configured keys upon save without requiring manual selector toggling.
- **Distribution Archive Packaging**:
  - Automated `.zip` compression for standalone Windows executables to prevent browser download false-positive flags.
