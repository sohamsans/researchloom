# Task Plan: Research Loom Production Implementation

- [x] Phase 1: Automated Evidence Extraction Matrix & Click-to-Source Verification <!-- id: 0 -->
  - [x] 1.1 Backend Models & Schema (`backend/app/models/matrix.py`, `backend/app/models/schemas.py`) <!-- id: 1 -->
  - [x] 1.2 Layout-Aware Table Extraction & Extraction Service (`backend/app/services/matrix_service.py`) <!-- id: 2 -->
  - [x] 1.3 FastAPI REST Endpoints for Dynamic Matrix (`backend/app/routers/matrix.py`) <!-- id: 3 -->
  - [x] 1.4 Frontend Dynamic Column Builder & Matrix UI (`frontend/src/components/matrix/EvidenceMatrixStudio.tsx`) <!-- id: 4 -->
  - [x] 1.5 Click-to-Source PDF Bounding Box Viewer Integration (`frontend/src/components/PdfViewerModal.tsx`) <!-- id: 5 -->
  - [x] 1.6 Verification & Matrix Test Suite <!-- id: 6 -->

- [x] Phase 2: Systematic Screening & PRISMA 2020 Workflow <!-- id: 7 -->
  - [x] 2.1 Screening Audit Database & Endpoints (`backend/app/routers/screening.py`) <!-- id: 8 -->
  - [x] 2.2 Keyboard Hotkey Triage Interface (`J`/`K`/`L`) & Exclusion Taxonomy <!-- id: 9 -->
  - [x] 2.3 Interactive Vector PRISMA 2020 Flowchart (`PRISMAFlowDiagram.tsx`) <!-- id: 10 -->

- [x] Phase 3: The "Loom" Citation & Lineage Graph (Miro Canvas Extension) <!-- id: 11 -->
  - [x] 3.1 Open Scholarly Graph Seed Expansion & Edge Classification <!-- id: 12 -->
  - [x] 3.2 Chronological Swimlane Timeline View & Viewport Frustum Culling <!-- id: 13 -->
  - [x] 3.3 Semantic Research Frames & Lasso Multi-Select <!-- id: 14 -->

- [x] Phase 4: Grounded Literature Review Writer & Academic Editor <!-- id: 15 -->
  - [x] 4.1 Inline `@` Citation Autocomplete & Reactive Key Sync <!-- id: 16 -->
  - [x] 4.2 Sentence-Level Grounded Synthesis Assistant <!-- id: 17 -->
  - [x] 4.3 Unverified Claim Diff Flagging Engine (Green/Amber/Red) <!-- id: 18 -->

- [x] Phase 5: Ingestion, Zotero Sync, Packaging & Final Release <!-- id: 19 -->
  - [x] 5.1 Zotero Web API & Drag-and-Drop BibTeX/RIS Parser <!-- id: 20 -->
  - [x] 5.2 Build & Test Verification (`tsc && vite build`, `LitBuddy.exe`) <!-- id: 21 -->
  - [x] 5.3 Documentation, Release Notes & Git Commit <!-- id: 22 -->
