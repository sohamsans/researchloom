# Implementation Plan: Deep Synthesis Capacity, Unified Project Chat Session & Chunked Bulk Downloads

## 1. Problem Statement & Root Cause Mapping
After pooling 774 papers across consecutive search queries, the user encountered 4 critical workflow bottlenecks:
1. **Under-synthesis:** 774 candidate papers synthesized into only 6 papers.
   - *Root Cause:* Hardcoded `if len(filtered) >= 6: break` in `backend/app/services/pipeline.py:217`!
2. **Chat Fragmentation:** Typing multiple search queries in the same research chat session creates a new chat/notebook entry in the sidebar for every query.
   - *Root Cause:* In `frontend/src/App.tsx:295-314`, `recordSearchHistory(params.topic, ...)` runs on every search with `queryHash = topic...`, generating a new sidebar notebook entry for every search term.
3. **Synthesis Topic Scope:** Synthesis currently only considers the single topic entered last, ignoring the earlier pooled queries.
   - *Root Cause:* In `frontend/src/App.tsx:436`, `runSelectedPipeline({ topic: lastRequestParams.topic, ... })` only passes the last topic instead of the joined composite topic representing all pooled queries.
4. **Bulk Download Hang on Large Pools (774 papers):** Clicking "Download ZIP" on 774 papers gets stuck loading forever.
   - *Root Cause:* Single monolithic HTTP POST attempting to download 774 papers in-memory before returning a response, exceeding browser timeouts (Netlify 26s, browser connection limits) and RAM. The UI lacks chunking/pagination controls (e.g. download in batches of 50-100) and real-time progress feedback.

---

## 2. Multi-Pass Critic & Anti-Hallucination Review (5-Pass Review)

### Round 1: Correctness & Edge Cases
- **Synthesis Cap:** What happens if the user selects 50, 100, or 700 papers?
  - LLM Stage 1 Triage can batch-process hundreds of papers quickly in chunks.
  - LLM Stage 2 Deep Extraction involves full-text / abstract parsing with LLM calls. If we send 700 papers into Stage 2 simultaneously, rate limits will trigger and cost/latency will explode.
  - *Correct Strategy:* Allow user to configure or choose synthesis depth (`max_synthesis_count`: default 30, options up to 100 for deep extraction). For all selected papers passing threshold, include them in the synthesized pool. Papers beyond the deep LLM limit receive graceful structured abstract synthesis so NO selected paper is thrown away!
- **Composite Topic:** If pooled queries are `["quantum computing", "error correction", "surface codes"]`, the synthesis prompt and literature review matrix must be unified: `"quantum computing; error correction; surface codes"`.

### Round 2: Anti-Hallucination Check
- All endpoints and schemas must match existing contracts:
  - `SelectedPipelineRequest` in `backend/app/models/schemas.py`: add `max_synthesis_count: Optional[int] = Field(default=30, ge=1, le=200)`.
  - `frontend/src/types/index.ts`: update `SelectedPipelineRequest` to include `max_synthesis_count?: number`.
  - Bulk download uses existing `/api/vault/bulk-download` with paper slices or client-side batching.

### Round 3: Desktop & Cloud Compatibility
- Works identically on Windows standalone executable (`ResearchLoom.exe`) and web version (`Netlify + Render`).
- File paths use `os.path.join` and forward slashes in TypeScript. Zero platform-specific regressions.

### Round 4: Token & Resource Efficiency
- LLM triage batches remain capped at lean abstracts (180 words).
- Bulk downloads are chunked into 50-paper batches with progress bar so neither the server memory nor browser times out.

### Round 5: User Experience & Continuity
- **Unified Chat Session:** A project session maintains a single persistent `sessionId` in `App.tsx`. Consecutive searches update the existing session's topic list (`topic: pooledQueries.join(' + ')`) rather than appending separate notebook items to `researchloom_local_searches`. Only create a new session when clicking `onNewReview` ("New review").
- **Chunked Download UI:** When downloading large pools (>50 papers), provide a clear chunk selector dropdown or batch downloader in `CandidatePreviewTable.tsx` (e.g. "Download Batch 1 (1–50)", "Download Batch 2 (51–100)", etc., or download selected in progressive batches with live progress bar).

---

## 3. Detailed Implementation Steps
1. **Backend Schema & Pipeline Refactor:**
   - Modify `backend/app/models/schemas.py` to add `max_synthesis_count: Optional[int] = 30` to `SelectedPipelineRequest`.
   - Modify `backend/app/services/pipeline.py` to remove the hardcoded `len(filtered) >= 6: break`. Use `max_deep = request.max_synthesis_count or 30` (capped at 50 for deep full-text extraction; any remaining candidate papers passing triage score receive structured fallback synthesis so no selected paper is dropped).
2. **Frontend Type & App Session Logic:**
   - Modify `frontend/src/types/index.ts` to include `max_synthesis_count?: number` on `SelectedPipelineRequest`.
   - In `frontend/src/App.tsx`, introduce persistent `sessionId` state.
   - Refactor `recordSearchHistory` to update the active session's notebook record when consecutively searching/pooling within the same review session, rather than spawning duplicate entries.
   - In `handleProceedToSynthesis`, construct the composite topic `compositeTopic = queryHistory.length > 0 ? queryHistory.join('; ') : lastRequestParams.topic` and pass it to `runSelectedPipeline`.
3. **Chunked Bulk Download in `CandidatePreviewTable.tsx` & `api.ts`:**
   - In `CandidatePreviewTable.tsx`, add batch/chunk options for pools > 50 papers (e.g. batch size selector 50/100, download batch range 1-50, 51-100, or progressive chunk downloader with progress bar).
   - In `App.tsx` and `api.ts`, handle chunked downloading gracefully without freezing.
4. **Verification & Testing:**
   - Test backend pipeline with composite topic and high paper count.
   - Build frontend (`npm run build`).
   - Update `PROJECT_MEMORY.md` and `CHANGELOG.md` with **BUG-119** and **BUG-120**.
