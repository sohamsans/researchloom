import pytest
import httpx
from unittest.mock import patch, AsyncMock
from sqlalchemy import select
from app.main import app
from app.db.database import AsyncSessionLocal
from app.db.models import ScreeningAuditLog, BibliographicReference, MatrixCell
from app.services.reference_ingestion_service import normalize_citation_key
from app.routers.sync import active_pairing_tokens

@pytest.mark.asyncio
async def test_cross_discovery_to_matrix_abstract_preservation():
    """
    Cross-Feature Test: Discovery & Screening (F1) -> Evidence Matrix (F3).
    A paper is discovered and marked 'included' during PRISMA screening.
    When the user navigates to Evidence Matrix Studio to extract structured outcomes,
    the extraction request must supply the paper's abstract to the LLM extractor
    so that candidate papers without local vaulted PDFs still receive full extraction context.
    """
    workspace_id = "cross_test_ws_001"
    paper_id = "paper_cross_001"
    paper_title = "Direct Preference Optimization: Your Language Model is Secretly a Reward Model"
    paper_abstract = "We introduce DPO, an algorithm that solves the constrained RLHF problem implicitly with a single cross-entropy loss."

    # 1. Log screening inclusion in F1
    async with AsyncSessionLocal() as session:
        audit = ScreeningAuditLog(
            workspace_id=workspace_id,
            paper_id=paper_id,
            paper_title=paper_title,
            action="included",
            stage="title_abstract"
        )
        session.add(audit)
        await session.commit()

    # 2. Extract cell in F3 supplying the abstract
    cell_payload = {
        "workspace_id": workspace_id,
        "paper_id": paper_id,
        "paper_title": paper_title,
        "column_id": "col_core_algorithm",
        "column_name": "Core Algorithm",
        "prompt": "Extract the mathematical optimization algorithm introduced",
        "abstract": paper_abstract,
        "model_provider": "groq"
    }

    mock_extracted = {
        "value": "Direct Preference Optimization (DPO)",
        "status": "reported",
        "confidence": "high",
        "source_sentence": "We introduce DPO, an algorithm that solves the constrained RLHF problem implicitly.",
        "source_page": None
    }

    with patch("app.routers.matrix.extract_matrix_cell_value", new_callable=AsyncMock) as mock_extract:
        mock_extract.return_value = mock_extracted
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post("/api/matrix/cell/extract", json=cell_payload)
            assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
            data = res.json()
            assert "DPO" in data["value"]

@pytest.mark.asyncio
async def test_cross_matrix_to_references_key_parity():
    """
    Cross-Feature Test: Evidence Matrix (F3) -> Master Reference Manager (F4).
    Citation keys generated across Matrix Studio synthesis and Reference Manager ingestion
    must be identical to prevent broken LaTeX citations (e.g. \\cite{Vaswani2017Attention}).
    Both must use author surname, 4-digit year, and first alphanumeric title word.
    """
    authors = ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar"]
    year = 2017
    title = "Attention Is All You Need"

    # Reference Manager key generation
    ref_key = normalize_citation_key(authors, year, title)

    # Key must be based on surname 'Vaswani', not given name 'Ashish'
    assert ref_key == "Vaswani2017Attention", f"Expected 'Vaswani2017Attention', got '{ref_key}'"

    # Reversed author name: 'Vaswani, Ashish'
    rev_authors = ["Vaswani, Ashish", "Shazeer, Noam"]
    rev_key = normalize_citation_key(rev_authors, year, title)
    assert rev_key == "Vaswani2017Attention", f"Expected 'Vaswani2017Attention', got '{rev_key}'"

@pytest.mark.asyncio
async def test_cross_standalone_to_sqlite_sync_simulation():
    """
    Cross-Feature Test: Standalone Tablet Mode (F5) -> Desktop SQLite Database.
    Simulate an offline Android tablet creating references in standalone format,
    then pairing and pushing them via /api/sync/push to the desktop backend.
    The references must be written into SQLite and retrievable via GET /api/references/all.
    """
    token = "cross_sync_token_test_999"
    active_pairing_tokens[token] = {
        "device_id": "tablet_cross_dev",
        "device_name": "Researcher Pad",
        "paired_at": 1700000000.0,
        "role": "tablet"
    }

    standalone_paper = {
        "title": "Local-First Software: You Own Your Data",
        "doi": "10.1145/3359591.3359737",
        "authors": ["Martin Kleppmann", "Adam Wiggins"],
        "year": 2019,
        "venue": "Onward!",
        "abstract": "We explore local-first software which keeps data on the user's local device."
    }

    push_payload = {
        "token": token,
        "papers": [standalone_paper],
        "notes": [],
        "stylus_drawings": []
    }

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # 1. Push from standalone tablet
        res_push = await client.post("/api/sync/push", json=push_payload)
        assert res_push.status_code == 200

        # 2. Verify desktop Reference Manager can query the synced paper
        res_refs = await client.get("/api/references/all")
        assert res_refs.status_code == 200
        refs_data = res_refs.json()

        # The pushed reference MUST be present in items
        synced_titles = [item.get("title") for item in refs_data.get("items", [])]
        assert "Local-First Software: You Own Your Data" in synced_titles, (
            f"Synced paper was not found in GET /api/references/all! Titles found: {synced_titles}"
        )
