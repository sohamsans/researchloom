# Changelog

All notable changes, bug fixes, and architectural enhancements to ResearchLoom (Samhita) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
