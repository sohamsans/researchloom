import pytest
import httpx
from unittest.mock import patch, AsyncMock
from app.main import app
from app.db.database import AsyncSessionLocal
from app.db.models import MatrixCell
from app.services.reference_ingestion_service import normalize_citation_key

@pytest.mark.asyncio
async def test_matrix_cell_extract_with_fallback_abstract():
    """
    Test that MatrixCellExtractRequest accepts an optional `abstract` parameter,
    allowing candidate papers that have not yet undergone full PDF vaulting or Stage 2
    deep extraction to provide their abstract context to the LLM extractor.
    """
    workspace_id = "test_matrix_extract_ws"
    payload = {
        "workspace_id": workspace_id,
        "paper_id": "test_paper_candidate_001",
        "paper_title": "Efficient Inference for Diffusion Models",
        "paper_doi": "10.1234/test.diff",
        "column_id": "col_sample_size",
        "column_name": "Sample Size",
        "prompt": "Extract the sample size or dataset size evaluated",
        "data_type": "string",
        "abstract": "We evaluate on ImageNet with 50,000 validation images and demonstrate 3x speedup.",
        "model_provider": "groq",
        "model_name": "llama-3.1-8b-instant"
    }

    mock_llm_response = {
        "value": "50,000 validation images",
        "status": "reported",
        "confidence": "high",
        "source_sentence": "We evaluate on ImageNet with 50,000 validation images.",
        "source_page": None
    }

    with patch("app.routers.matrix.extract_matrix_cell_value", new_callable=AsyncMock) as mock_extract:
        mock_extract.return_value = mock_llm_response
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post("/api/matrix/cell/extract", json=payload)
            assert res.status_code == 200, f"Expected 200 OK, got {res.status_code}: {res.text}"
            data = res.json()
            assert data["value"] == "50,000 validation images"
            assert data["status"] == "reported"

            # Verify extract_matrix_cell_value received the abstract
            mock_extract.assert_called_once()
            call_kwargs = mock_extract.call_args[1]
            assert "abstract" in call_kwargs or "50,000 validation images" in str(mock_extract.call_args)

@pytest.mark.asyncio
async def test_matrix_cell_extract_human_edit_protection():
    """
    Test that automated cell extraction does not overwrite existing cell values
    when `is_human_edited == True`, preserving manual researcher inputs.
    """
    workspace_id = "test_matrix_protect_ws"
    paper_id = "paper_human_edited_002"
    column_id = "col_methodology"

    # Seed an existing human-edited cell in SQLite
    async with AsyncSessionLocal() as session:
        cell = MatrixCell(
            workspace_id=workspace_id,
            paper_id=paper_id,
            column_id=column_id,
            value="Double-blind randomized controlled trial with N=120 (Verified by Dr. Smith)",
            status="reported",
            confidence="high",
            is_human_edited=True
        )
        session.add(cell)
        await session.commit()

    payload = {
        "workspace_id": workspace_id,
        "paper_id": paper_id,
        "paper_title": "Evaluation of Drug X",
        "column_id": column_id,
        "column_name": "Methodology",
        "prompt": "Extract the trial design",
        "model_provider": "groq"
    }

    mock_llm_response = {
        "value": "Clinical observation",
        "status": "reported",
        "confidence": "low",
        "source_sentence": "Observations were recorded.",
        "source_page": 1
    }

    with patch("app.routers.matrix.extract_matrix_cell_value", new_callable=AsyncMock) as mock_extract:
        mock_extract.return_value = mock_llm_response
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post("/api/matrix/cell/extract", json=payload)
            assert res.status_code == 200
            data = res.json()

            # The cell value MUST remain the human-edited value, not the machine-extracted value!
            assert "Double-blind randomized controlled trial" in data["value"], (
                f"Automated extraction overwrote human-edited cell! Got: {data['value']}"
            )
            assert data["is_human_edited"] is True, (
                f"Expected is_human_edited to remain True, got {data['is_human_edited']}"
            )

def test_citation_key_generation_uses_author_surname():
    """
    Test that citation key generation extracts the author's surname (last token)
    rather than first name, ensuring consistency with academic standards (e.g. Vaswani2017Attention).
    """
    # 1. "Ashish Vaswani" -> "Vaswani2017Attention"
    key1 = normalize_citation_key(["Ashish Vaswani"], 2017, "Attention Is All You Need")
    assert key1.startswith("Vaswani2017"), f"Expected key starting with Vaswani2017, got {key1}"

    # 2. "Vaswani, Ashish" -> "Vaswani2017Attention"
    key2 = normalize_citation_key(["Vaswani, Ashish"], 2017, "Attention Is All You Need")
    assert key2.startswith("Vaswani2017"), f"Expected key starting with Vaswani2017, got {key2}"

    # 3. Empty authors fallback -> "Unknown2024"
    key3 = normalize_citation_key([], 2024, "Foundations of AI")
    assert key3.startswith("Unknown2024"), f"Expected Unknown2024, got {key3}"
